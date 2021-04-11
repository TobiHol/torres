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
curl localhost:3000/ascii
```
### POST
initialize game 
```
curl -H 'content-type: application/json' localhost:3000/api -d '{"action" : "init"}'
```

reset game
```
curl -H 'content-type: application/json' localhost:3000/api -d '{"action" : "reset"}'
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

## WEBSOCKET

### Move 

client send move:
```
{
  "type" : "move",
  "data": {
    "action": "block_place",
    "x": 1,
    "y": 2
  }
}
```
data options: 
* {"action": "block_place", "x": 1, "y": 2}
* {"action": "knight_place", "x": 1, "y": 2}
* {"action": "knight_move", "x": 1, "y": 2, "destX": 1, "destY": 3}
* {"action": "turn_end"}
 

server response:
```
{
  "type" : "move_response",
  "data": {
    "valid": true 
  }
}
```

server broadcast if move was valid and server updated game:
```
{
  "type" : "move_update",
  "data": {
    "player": 0,
    "action": "block",
    "x": 1,
    "y": 2
  }
}
```

### Status request
server get a number of request:
```
{
  "type": "status_request"
  "data": [
    "game_state",
    "legal_moves",
    ...
  ]
}
```

server response to client for each request:
```
{
  "type": "game_state_response"
  "data": <torresObject>
}
```
### Game start/end 
server start game
```
{
  "type": "game_start",
  "data": {
    "your_player_id" : getPlayerId(client)
  }
}
```
server end game 
```
{
  "type": "game_end",
  "data": {
    "winner" : 1
  }
}
```

### Error
server response on error
```
{
  "type": "error",
  "data": {
    "message": "some message"
  }
}
```