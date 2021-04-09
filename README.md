# torres-server

## start server

> npm install

> node app.js

## Browser

`localhost:3000` for html representation of the board

## API

### GET
get board state: 
> curl localhost:3000/api
### POST
place block on position (x = 1, y = 2):
> curl -H 'content-type: application/json' localhost:3000/api -d '{ "x" : 1, "y" : 2 }'
