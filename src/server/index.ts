import { createServer } from "http";
import path from "path";

import express from "express";
import { WebSocket, WebSocketServer, createWebSocketStream } from "ws"

import { CloseCode } from "./events";


const app = express();
const httpServer = createServer(app);

const wss = new WebSocketServer({
    server: httpServer, 
    path: "/room",
});

type Game = {
    id: string;
    host: WebSocket;
    player?: WebSocket;
}

const GAMES_LIMIT = process.env.GAMES_LIMIT ?? 20;
const games = new Map<string, Game>()

const generateRoomID = () => {

    let result: string;
    do {
        const numID = 10000 + Math.floor(Math.random() * 9999);
        result = (numID + "").slice(1);
    } while(games.has(result));

    return result;
}

wss.on("connection", (socket, request) => {
    if(!request.url) return socket.close();

    const url = new URL(request.url, "http://example.com");

    const roomCode = url.searchParams.get("code");

    if(roomCode) {

        const game = games.get(roomCode);
        if(!game || game.player) return socket.close(CloseCode.NoRoom);

        game.player = socket;

        const playerStream = createWebSocketStream(socket);
        const hostStream = createWebSocketStream(game.host);

        playerStream.pipe(hostStream);
        hostStream.pipe(playerStream);

        socket.on("close", () => {
            game.host.close(CloseCode.PlayerDisconnected);

            games.delete(roomCode);
        })


        return;
    }

    if(games.size === GAMES_LIMIT) {
        socket.close(CloseCode.CannotCreateRoom);

        return;
    }

    const id = generateRoomID();

    const game: Game = {
        id,
        host: socket
    }

    games.set(id, game);
    socket.send(JSON.stringify({ roomCode: id }));

    socket.on("close", () => {
        game.player?.close(CloseCode.HostDisconnected);
        games.delete(id);
    })
})

app.use(express.static(path.resolve(process.cwd(), "out", "client")));

app.get("/", (_, res) => {
    res.sendFile(path.resolve(process.cwd(), "out", "client", "index.html"))
})

app.get("/check/:id", (req, res) => {
    if(!req.params.id) return res.status(401).send();

    const game = games.get(req.params.id);

    res.json({
        exist: !!game && !game.player
    })
})

httpServer.listen(process.env.PORT ?? 8080, () => {
    console.log(`Server started on port ${process.env.PORT ?? 8080}`)
})