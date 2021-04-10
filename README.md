# torres-server

## start server

```
npm install
node app.js
```

## Browser

`localhost:3000` for html representation of the board

## API

### GET
get board state:
```
curl localhost:3000/api
```
### POST
initialize game 
```
curl -H 'content-type: application/json' localhost:3000/api -d '{ "player" : 0, "action" : "init"}'
```

reset game
```
curl -H 'content-type: application/json' localhost:3000/api -d '{ "player" : 0, "action" : "reset"}'
```

player 0 place block on position (x = 1, y = 2):
```
curl -H 'content-type: application/json' localhost:3000/api -d '{ "player" : 0, "action" : "block", "x" : 1, "y" : 2 }'
```

player 1 place knight on position (x = 1, y = 2):
```

curl -H 'content-type: application/json' localhost:3000/api -d '{ "player" : 1, "action" : "knight", "x" : 1, "y" : 2 }'
```

player 1 move knight from position (x = 1, y = 2) to  position (x = 2, y = 2):
```
curl -H 'content-type: application/json' localhost:3000/api -d '{ "player" : 1, "action" : "move", "x" : 1, "y" : 2, "destX" : 2, "destY" : 2 }'
```

player 1 end turn:
```
curl -H 'content-type: application/json' localhost:3000/api -d '{ "player" : 1, "action" : "end" }'
```
