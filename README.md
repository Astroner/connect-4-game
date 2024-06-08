## Hi there
This is p2p "Connect 4" game

## Host to start the app
### Docker
```sh
docker image build -t connect-4 .
docker container run --rm -d --name connect-4 -p 8080:80 connect-4
```

Then open *http://localhost:8080/*

### Node
```sh
npm i
npm run build
PORT=8080 npm start
```

Then open *http://localhost:8080/*

## How to play
 - Create room
 - Join the room
 - Play "Connect 4"

## Time
This version of the game was created in **8h 22m**

## To do
 - Reconnects
 - Overall code style improvement. Move from "speedrun" style to normal one.