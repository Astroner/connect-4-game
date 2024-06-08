import { GameEvent, GameEventTemplate, Subscription, Player } from "./game.class";

export type RemoteGameEvent =
    | GameEvent
    | GameEventTemplate<"START", { myTurn: Player }>
    | GameEventTemplate<"OPPONENT_RESIGN">
    | GameEventTemplate<"OPPONENT_LEFT">
    | GameEventTemplate<"SOMETHING_WENT_WRONG">

export type RemoteEventHandler = (ev: RemoteGameEvent) => void;

export interface RemoteGame {
    getRoomCode(): Promise<string>;
    putStone(columnIndex: number): void;
    destroy(): void;
    resign(): void;
    subscribe(cb: RemoteEventHandler): Subscription
}