import { env } from "../env";
import { CloseCode } from "../server/events";
import { Subscription } from "./game.class";

import { RemoteEventHandler, RemoteGame, RemoteGameEvent } from "./game.types";
import { GameHostMessage, GamePlayerMessage } from "./messages";

export class GamePlayer implements RemoteGame {
    private listeners = new Set<RemoteEventHandler>();

    private ws: WebSocket;

    private gameOver = false;
    private decoder = new TextDecoder();

    public onError?: (error: "NO_ROOM") => void;

    constructor(private roomCode: string) {
        this.ws = new WebSocket(`${env.SERVER_BASE_PATH}/room?code=${roomCode}`);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
            this.sendMessage({ type: "PLAYER" })
        }

        this.ws.onmessage = (ev) => {
            if(typeof ev.data === "string") return;

            const message: GameHostMessage = JSON.parse(this.decoder.decode(ev.data));

            switch(message.type) {
                case "HOST":
                    this.sendMessage({ type: "PLAYER_READY" });
                    this.sendEvent({ type: "START", myTurn: message.playerTurn })
                    break;
                
                case "ACTIVE_PLAYER_SWITCH":
                    this.sendEvent({ type: "player-change", next: message.next })
                    break;

                case "NEW_STONE":
                    this.sendEvent({
                        type: "new-stone",
                        col: message.col,
                        player: message.player,
                        row: message.row
                    })
                    break;
                
                case "RESIGN":
                    this.gameOver = true;
                    this.sendEvent({
                        type: "OPPONENT_RESIGN"
                    })
                    this.destroy();
                    break;

                case "GAME_OVER":
                    this.gameOver = true;
                    this.sendEvent({
                        type: "game-over",
                        winner: message.winner
                    })
                    this.destroy();
                    break;
            }
        }

        this.ws.onclose = (ev) => {
            if(this.gameOver) return;

            switch(ev.code) {
                case CloseCode.HostDisconnected:
                    this.sendEvent({ type: "OPPONENT_LEFT" });
                    break;
                
                case CloseCode.NoRoom:
                    this.onError && this.onError("NO_ROOM");
                
                default:
                    this.sendEvent({ type: "SOMETHING_WENT_WRONG" });
            }
        }
    }

    async getRoomCode() {
        return this.roomCode;
    }

    putStone(columnIndex: number): void {
        if(this.gameOver) return;

        this.sendMessage({
            type: "PLACE_STONE",
            col: columnIndex
        })
    }

    resign(): void {
        this.gameOver = true;
        this.sendMessage({
            type: "RESIGN"
        })
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

    destroy() {
        this.ws.close();
    }
    
    private sendMessage(ev: GamePlayerMessage) {
        this.ws.send(JSON.stringify(ev));
    }

    private sendEvent(ev: RemoteGameEvent) {
        this.listeners.forEach(cb => cb(ev));
    }
}