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
    "next_player": 0,
    "action": "block",
    "x": 1,
    "y": 2
  }
}
```

### Client Info
client sends info about it to server

{
  "type": "info",
  "data": {
    "type": "human"
  }
}

### Status request
server get a number of request:
```
{
  "type": "status_request"
  "data": [
    "game_state",
    "legal_moves",
    "player_info",
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

```
{
  "type": "player_info_response"
  "data": {
    "playerStatus": ['disconnected', 'connected', ...]
    "playerType": ['random_ai', 'human', ...]
    "id": getPlayerId(client)
  }
}
```
### Game Info 
messages from server when game starts/ends
```
{
  "type": "game_start",
  "data": {
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
server player connect
```
{
  "type": "player_connect",
  "data": {
    "id" : 1
  }
}
```
server player disconnect
```
{
  "type": "player_disconnect",
  "data": {
    "id" : 1
  }
}
```

### Commands
commands that clients can send to the server

to reset the game and then start a new one
{
  "type": "command"
  "data": [
    "game_reset",
    "game_init"
  ]
}

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