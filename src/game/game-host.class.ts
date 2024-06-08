import { env } from "../env";
import { CloseCode } from "../server/events";
import { Game, Player, Subscription } from "./game.class";
import { RemoteEventHandler, RemoteGame, RemoteGameEvent } from "./game.types";
import { GameHostMessage, GamePlayerMessage } from "./messages";

export class GameHost implements RemoteGame{
    private listeners = new Set<RemoteEventHandler>();

    private roomCode: Promise<string>;
    private ws: WebSocket;

    private decoder = new TextDecoder();

    private playerTurn: Player;

    private game = new Game();

    private gameOver = false;

    public onError?: (err: "CANNOT_CREATE_ROOM") => void;

    constructor(
        private hostTurn: Player = Math.random() > .5 ? "FIRST" : "SECOND"
    ) {
        if(hostTurn === "FIRST") {
            this.playerTurn = "SECOND"
        } else {
            this.playerTurn = "FIRST";
        }

        this.ws = new WebSocket(env.SERVER_BASE_PATH + "/room");
        this.ws.binaryType = "arraybuffer";

        this.roomCode = new Promise((res) => {
            const handler = (ev: MessageEvent) => {
                const firstMessage = JSON.parse(ev.data);

                this.ws.removeEventListener("message", handler);
                res(firstMessage.roomCode);
            }

            this.ws.addEventListener("message", handler);
        })

        this.ws.addEventListener("message", (ev: MessageEvent) => {
            if(typeof ev.data === "string") return;
    
            const message: GamePlayerMessage = JSON.parse(this.decoder.decode(ev.data));
    
            switch(message.type) {
                case "PLAYER":
                    this.sendMessage({
                        type: "HOST",
                        playerTurn: this.playerTurn
                    })

                    break;
                
                case "PLAYER_READY": 
                    this.sendEvent({ type: "START", myTurn: this.hostTurn });
                    break;

                case "PLACE_STONE":
                    if(this.playerTurn !== this.game.getActivePlayer()) return;

                    this.game.putStone(message.col);

                    break;

                case "RESIGN": 
                    this.gameOver = true;
                    this.sendEvent({ type: "OPPONENT_RESIGN" });
                    this.destroy();
                    break;
            }
        });

        this.ws.onclose = (ev) => {
            if(this.gameOver) return;

            switch(ev.code) {
                case CloseCode.PlayerDisconnected:
                    this.sendEvent({ type: "OPPONENT_LEFT" });
                    break;
                
                case CloseCode.CannotCreateRoom:
                    this.onError && this.onError("CANNOT_CREATE_ROOM");
                
                default:
                    this.sendEvent({ type: "SOMETHING_WENT_WRONG" });
            }
        }

        this.game.subscribe(ev => {
            switch(ev.type) {
                case "new-stone": 
                    this.sendMessage({
                        type: "NEW_STONE",
                        player: ev.player,
                        col: ev.col,
                        row: ev.row
                    });

                    this.sendEvent(ev);

                    break;
                
                case "player-change":
                    this.sendMessage({
                        type: "ACTIVE_PLAYER_SWITCH",
                        next: ev.next
                    })

                    this.sendEvent(ev);
                    break;

                case "game-over":
                    this.gameOver = true;
                    this.sendMessage({
                        type: "GAME_OVER",
                        winner: ev.winner
                    })
                    this.sendEvent(ev);
                    this.destroy();
                    break;
            }
        })
    }

    resign(): void {
        this.sendMessage({ type: "RESIGN" });
        this.gameOver = true;
        this.destroy();
    }

    subscribe(cb: RemoteEventHandler): Subscription {
        this.listeners.add(cb);

        return {
            unsubscribe: () => {
                this.listeners.delete(cb);
            }
        }
    }

    getRoomCode() {
        return this.roomCode;
    }

    putStone(columnIndex: number) {
        if(this.hostTurn !== this.game.getActivePlayer()) return;

        this.game.putStone(columnIndex);
    }

    destroy() {
        this.ws.close();
    }

    private sendMessage(message: GameHostMessage) {
        this.ws.send(JSON.stringify(message));
    }

    private sendEvent(ev: RemoteGameEvent) {
        this.listeners.forEach(cb => cb(ev));
    }
}