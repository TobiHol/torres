const express = require('express')
const logger = require('morgan')
const app = express()
const WebSocket = require('ws')
const wss = new WebSocket.Server({ noServer: true })
const port = process.env.PORT || 3000

// const indexRouter = require('./routes/index')
// const usersRouter = require('./routes/users')

app.use(express.json())
app.use(logger('dev'))

// app.use('/', indexRouter)
// app.use('/users', usersRouter)

/*
  game init
*/

const numPlayers = 2
const Torres = require('./public/javascripts/torres')
const torres = new Torres()

/*
  express API
*/

app.get('/', function (req, res) {
  res.send(torres.html())
})

app.get('/api', function (req, res) {
  res.send(torres.ascii())
})

// only used for testing
app.post('/api', function (req, res) {
  let success = false
  console.log('Received action : ' + JSON.stringify(req.body))
  if (req.body.action === 'block') {
    success = torres.placeBlock(req.body.player, req.body.x, req.body.y)
  } else if (req.body.action === 'knight') {
    success = torres.placeKnight(req.body.player, req.body.x, req.body.y)
  } else if (req.body.action === 'move') {
    success = torres.moveKnight(req.body.player, req.body.x, req.body.y, req.body.destX, req.body.destY)
  } else if (req.body.action === 'end') {
    success = torres.endTurn(req.body.player)
  } else { console.log('unknown action') }
  console.log(success ? 'action performed' : 'action could not be performed')
  res.send(torres.ascii())
})

/*
  websocket API
*/

let GAME_ON = false
const PLAYERS = new Array(numPlayers).fill(null)
function getPlayerId (obj) {
  return PLAYERS.findIndex((o) => o === obj)
}

wss.on('connection', (ws) => {
  if (wss.clients.size > numPlayers) {
    ws.send(`Already ${numPlayers} players connected.`)
    ws.close()
    return
  }
  PLAYERS[getPlayerId(null)] = ws // assign client to player
  broadcast(`Player ${getPlayerId(ws)} connected.`)
  // start game
  if (wss.clients.size === numPlayers) {
    broadcast('GAME START')
    GAME_ON = true
  }
  ws.on('message', (data) => {
    console.log('received:', data)
    if (!GAME_ON) {
      ws.send('Game has not started yet.')
      return
    }
    let json = null
    try {
      json = JSON.parse(data)
    } catch (error) {
      ws.send('cant parse data')
      return
    }
    let valid = false
    const playerId = getPlayerId(ws)
    if (json.action === 'block') {
      valid = torres.placeBlock(playerId, json.x, json.y)
    } else if (json.action === 'knight') {
      valid = torres.placeKnight(playerId, json.x, json.y)
    } else if (json.action === 'move') {
      valid = torres.moveKnight(playerId, json.x, json.y, json.destX, json.destY)
    } else if (json.action === 'end') {
      valid = torres.endTurn(playerId)
    } else { console.log('unknown action') }
    if (valid) {
      broadcast(`Player ${playerId}: ${data}`)
    } else {
      ws.send(`ILLEGAL MOVE: Player ${playerId}: ${data}`)
    }
  })
  ws.on('close', () => {
    const playerId = getPlayerId(ws)
    PLAYERS[playerId] = null // remove client form players
    broadcast(`Player ${playerId} disconnected.`)
    // end game
    if (GAME_ON) {
      broadcast('GAME END')
      GAME_ON = false
    }
  })
})

function broadcast (message) {
  wss.clients.forEach(function each (client) {
    // if (client.readyState === WebSocket.OPEN) {
    client.send(message)
  })
}

/*
  server setup
*/

// create express server
const server = app.listen(port, () => {
  console.log(`torres server listening at http://localhost:${port}`)
})

// setup websocket on server
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, socket => {
    wss.emit('connection', socket, request)
  })
})
