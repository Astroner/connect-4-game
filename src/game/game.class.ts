export type Player = "FIRST" | "SECOND";

export type GameEventTemplate<T extends string, Data = {}> = Data & {
    type: T;
}

export type GameEvent = 
    | GameEventTemplate<"new-stone", {
        player: Player;
        row: number;
        col: number;
    }>
    | GameEventTemplate<"player-change", { next: Player }>
    | GameEventTemplate<"game-over", { winner: Player | null }>

export type GameEventHandler = (e: GameEvent) => void;

export type Subscription = {
    unsubscribe: VoidFunction
}

export class Game {
    private listeners = new Set<GameEventHandler>();

    private freeCells = 7 * 6;
    private grid: Player[][] = new Array(7)
        .fill(null)
        .map(() => new Array())

    private activePlayer: Player = "FIRST";

    putStone(columnIndex: number) {
        if(columnIndex < 0 || columnIndex > 6) {
            return;
        }

        const col = this.grid[columnIndex];

        if(col.length === 6) {
            return;
        }
        
        col.push(this.activePlayer);

        this.sendEvent({
            type: "new-stone",
            col: columnIndex,
            row: col.length - 1,
            player: this.activePlayer
        })

        this.checkBoardFrom(col.length - 1, columnIndex);
        this.freeCells -= 1;

        if(this.freeCells === 0) {
            this.sendEvent({
                type: "game-over",
                winner: null
            })
            return;
        }

        if(this.activePlayer === "FIRST") {
            this.activePlayer = "SECOND"
        } else {
            this.activePlayer = "FIRST";
        }

        this.sendEvent({
            type: "player-change",
            next: this.activePlayer
        })
    }

    getActivePlayer() {
        return this.activePlayer;
    }

    getBoardState(): ReadonlyArray<ReadonlyArray<Player>> {
        return this.grid;
    }

    subscribe(cb: GameEventHandler): Subscription {
        this.listeners.add(cb);

        return {
            unsubscribe: () => {
                this.listeners.delete(cb);
            }
        }
    }

    private sendEvent(e: GameEvent) {
        this.listeners.forEach(cb => cb(e));
    }

    private checkBoardFrom(row: number, col: number) {
        const playerToCheck = this.grid[col][row];

        const vectors = [
            { col: 1, row: 0 },
            { col: 0, row: 1 },
            { col: 1, row: 1 },
            { col: -1, row: 1 }
        ]

        for(const vector of vectors) {
            let stones = 1;
            let currentRow = row;
            let currentCol = col;
            for(let i = 0; i < 3; i++) {
                currentRow += vector.row;
                currentCol += vector.col;

                if(
                    !this.grid[currentCol]
                    || !this.grid[currentCol][currentRow]
                    || this.grid[currentCol][currentRow] !== playerToCheck
                ) {
                    break;
                }

                stones += 1;
            }

            currentRow = row;
            currentCol = col;
            for(let i = 0; i < 3; i++) {
                currentRow -= vector.row;
                currentCol -= vector.col;

                if(
                    !this.grid[currentCol]
                    || !this.grid[currentCol][currentRow]
                    || this.grid[currentCol][currentRow] !== playerToCheck
                ) {
                    break;
                }

                stones += 1;
            }

            if(stones >= 4) {
                this.sendEvent({
                    type: "game-over",
                    winner: playerToCheck
                })
                return;
            }
        }
    }
}