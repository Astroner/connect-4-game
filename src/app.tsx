import React, { FC, memo, useEffect, useState } from "react";

import { GameHost } from "./game/game-host.class";

import { GamePlayer } from "./game/game-player.class";
import { RemoteGame } from "./game/game.types";
import { Player } from "./game/game.class";

import cn from "./app.module.scss";

export type AppProps = {

}

type Stage = 
    | { type: "INIT" } 
    | { type: "LOADING", code?: string, asHost: boolean } 
    | {
        type: "GAME",
        game: RemoteGame,
        myTurn: Player
    }
    | {
        type: "SOMETHING_WENT_WRONG"
    }
    | {
        type: "ERROR",
        error: "NO_ROOM" | "CANNOT_CREATE_ROOM"
    }

type GameOver = 
    | null
    | {
        type: "LOST"
    }
    | {
        type: "WON",
        reason?: "OPPONENT_LEFT" | "OPPONENT_RESIGNED"
    }
    | {
        type: "DRAW",
    }

type StoneView = 
    | null
    | "MY"
    | "ENEMY"

export const App: FC<AppProps> = memo(props => {

    const [stage, setStage] = useState<Stage>({
        type:"INIT",
    });

    const [roomCode, setRoomCode] = useState("");
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [gameGrid, setGameGrid] = useState<StoneView[][]>(() => {
        return new Array(7).fill(null).map(() => new Array(6).fill(null));
    })
    const [gameOver, setGameOver] = useState<GameOver>(null);
    const [isGameOverHidden, setIsGameOverHidden] = useState(false);

    const resetGame = (myTurn: Player, game: RemoteGame) => {
        setGameGrid(new Array(7).fill(null).map(() => new Array(6).fill(null)));
        setStage({
            type: "GAME",
            game,
            myTurn
        })
        setGameOver(null);
        setIsGameOverHidden(false);
    }

    const connect = () => {
        if(!roomCode) return;

        setStage({ type: "LOADING", code: roomCode, asHost: false })
        setRoomCode("")

        const room = new GamePlayer(roomCode);

        const sub = room.subscribe(e => {
            switch(e.type) {
                case "START": 
                    resetGame(e.myTurn, room);
                    sub.unsubscribe();
                    break;

                case "SOMETHING_WENT_WRONG":
                    setStage({ type: "SOMETHING_WENT_WRONG" });
                    break;
            }
        })

        room.onError = () => {
            setStage({ type: "ERROR", error: "NO_ROOM" });
            sub.unsubscribe();
        }
    }

    const createRoom = async () => {
        setStage({ type: "LOADING", asHost: true })
        
        const room = new GameHost();

        const code = await room.getRoomCode();

        setStage({ type: "LOADING", asHost: true, code });

        const sub = room.subscribe(e => {
            switch(e.type) {
                case "START": 
                    resetGame(e.myTurn, room);
                    sub.unsubscribe();
                    break;

                case "SOMETHING_WENT_WRONG":
                    setStage({ type: "SOMETHING_WENT_WRONG" });
                    break;
            }
        })

        room.onError = () => {
            setStage({ type: "ERROR", error: "CANNOT_CREATE_ROOM" });
            sub.unsubscribe();
        }
    }

    const placeStone = (columnIndex: number) => {
        if(stage.type !== "GAME" || !isMyTurn) return;

        stage.game.putStone(columnIndex);
    }

    const resign = () => {
        if(stage.type !== "GAME") return;
        stage.game.resign();
        setGameOver({ type: "LOST" });
    }

    const finish = () => {
        if(stage.type !== "GAME") return;
        stage.game.destroy()
        setStage({ type: "INIT" });
        setGameOver(null)
    }

    useEffect(() => {
        if(stage.type !== "GAME") return;

        setIsMyTurn(stage.myTurn === "FIRST");

        const sub = stage.game.subscribe(e => {
            switch(e.type) {
                case "player-change":
                    setIsMyTurn(e.next === stage.myTurn);
                    break;

                case "new-stone":
                    setGameGrid(p => {
                        const next = p.slice(0);

                        next[e.col] = next[e.col].slice(0);

                        next[e.col][5 - e.row] = e.player === stage.myTurn ? "MY" : "ENEMY";

                        return next;
                    })
                    break;
                
                case "OPPONENT_LEFT":
                    setGameOver({
                        type: "WON",
                        reason: "OPPONENT_LEFT"
                    })
                    break;

                case "OPPONENT_RESIGN":
                    setGameOver({
                        type: "WON",
                        reason: "OPPONENT_RESIGNED"
                    })
                    break;

                case "SOMETHING_WENT_WRONG":
                    setStage({
                        type: "SOMETHING_WENT_WRONG"
                    })
                    break;

                case "game-over":
                    if(!e.winner) {
                        setGameOver({ type: "DRAW" })
                    } else if(e.winner === stage.myTurn) {
                        setGameOver({ type: "WON" })
                    } else {
                        setGameOver({ type: "LOST" })
                    }
                    break;
            }
        })

        return () => {
            sub.unsubscribe();
        }
    }, [stage])

    return (
        <div className={cn.root}>
            {
                stage.type === "INIT" &&
                (
                    <form className={cn.modal} onSubmit={e => (e.preventDefault(), connect())}>
                        <input placeholder="Room code" value={roomCode} onChange={e => setRoomCode(e.target.value)} />
                        <div className={cn.buttons}>
                            <button type="submit">
                                Join
                            </button>
                            <button type="button" onClick={createRoom}>
                                Create
                            </button>
                        </div>
                    </form>
                )
            }
            {
                stage.type === "LOADING" &&
                (
                    <div className={cn.modal} style={{ fontSize: 20, textAlign: 'center' }}>
                        {stage.asHost && !stage.code && (
                            <div>
                                Creating the room
                            </div>
                        )}
                        {stage.asHost && stage.code && (
                            <>
                                <div>
                                    Waiting for somebody to connect
                                </div>
                                <div style={{ marginTop: 10 }}>
                                    Room code: {stage.code}
                                </div>
                            </>
                        )}
                        {!stage.asHost && (
                            <div>
                                Connecting to the room {stage.code}
                            </div>
                        )}
                    </div>
                )
            }
            {
                stage.type === "GAME" &&
                (
                    <div>
                        <div className={`${cn.modal} ${cn.title}`} style={{ marginBottom: 20 }}>
                            <div>{isMyTurn ? "Your turn" : "Opponents turn"}</div>
                            {
                                isMyTurn && (
                                    <div className={cn['title-stone']}>
                                        <div className={cn['stone--my']} />
                                    </div>
                                )
                            }
                        </div>
                        <div className={cn.modal}>
                            <div className={cn.grid}>
                                {gameGrid.map((col, i) => (
                                    <div
                                        key={i} 
                                        className={isMyTurn ? cn['column--active']: cn['column--default']}
                                        onClick={() => placeStone(i)}
                                    >
                                        {col.map((row, j) => (
                                            <div key={j} className={cn.cell}>
                                                {
                                                    row === "MY"
                                                    ? <div className={cn['stone--my']} />
                                                    : row === "ENEMY" 
                                                    ? (
                                                        <div className={cn['stone--opponent']}>
                                                            <div className={cn['line--left']} />
                                                            <div className={cn['line--right']} />
                                                        </div>
                                                    )
                                                    : null
                                                }
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {
                            gameOver 
                            ? <button className={cn.button} onClick={finish}>Finish</button>
                            : <button className={cn.button} onClick={resign}>Resign</button>
                        }
                    </div>
                )
            }
            {
                stage.type === "ERROR" && (
                    <div>
                        <div className={cn.modal} style={{ fontSize: 20, textAlign: 'center' }}>
                            {
                                stage.error === "CANNOT_CREATE_ROOM"
                                ? "Cannot create room"
                                : "This room doesn't exist"
                            }
                        </div>
                        <button className={cn.button} onClick={() => setStage({ type: "INIT" })}>Back</button>
                    </div>
                )
            }
            {
                gameOver && !isGameOverHidden && (
                    <div className={cn.screen} onClick={() => setIsGameOverHidden(true)}>
                        <div onClick={(e) => e.stopPropagation()}>
                            <div className={`${cn.modal} ${cn.title}`} style={{ justifyContent: 'center', flexDirection: "column" }}>
                                <div>
                                    {
                                        gameOver.type === "DRAW"
                                        ? "Draw"
                                        : gameOver.type === "WON"
                                        ? "You won"
                                        : "You lose"
                                    }
                                </div>
                                {gameOver.type === "WON" && gameOver.reason && (
                                    <div style={{ marginTop: 10, textAlign: 'center' }}>
                                        {
                                            gameOver.reason === "OPPONENT_LEFT"
                                            ? "Your opponent has left the game"
                                            : "Your opponent has resigned"
                                        }
                                    </div>
                                )}
                            </div>
                            <button className={cn.button} onClick={finish}>Finish</button>
                        </div>
                    </div>
                )
            }
        </div>
    )
})