import { Player } from "./game.class";

export type GameMessageTemplate<T, Data = {}> = Data & { type: T };

export type GameCommonMessage = 
    | GameMessageTemplate<"RESIGN">

export type GameHostMessage = 
    | GameCommonMessage
    | GameMessageTemplate<"HOST", {
        playerTurn: Player
    }>
    | GameMessageTemplate<"NEW_STONE", {
        player: Player,
        col: number,
        row: number
    }>
    | GameMessageTemplate<"ACTIVE_PLAYER_SWITCH", {
        next: Player
    }>
    | GameMessageTemplate<"GAME_OVER", {
        winner: Player | null
    }>

export type GamePlayerMessage = 
    | GameCommonMessage
    | GameMessageTemplate<"PLAYER">
    | GameMessageTemplate<"PLAYER_READY">
    | GameMessageTemplate<"PLACE_STONE", { col: number }>
