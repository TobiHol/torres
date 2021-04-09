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

// init game
const numPlayers = 2
const Torres = require('./public/javascripts/torres')
const Player = require('./public/javascripts/player')
const torres = new Torres()
const player1 = new Player(torres, 0)
const player2 = new Player(torres, 1)

// express API
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
  const player = req.body.player ? player2 : player1
  if (req.body.action === 'block') {
    success = player.placeBlock(req.body.x, req.body.y)
  } else if (req.body.action === 'knight') {
    success = player.placeKnight(req.body.x, req.body.y)
  } else if (req.body.action === 'move') {
    success = player.moveKnight(req.body.x, req.body.y, req.body.destX, req.body.destY)
  } else if (req.body.action === 'end') {
    success = player.endTurn()
  } else { console.log('unknown action') }
  console.log(success ? 'action performed' : 'action could not be performed')
  res.send(torres.ascii())
})

// websocket API
wss.on('connection', (ws) => {
  if (wss.clients.size > numPlayers) {
    ws.send(`Already ${numPlayers} players connected.`)
    ws.close()
    return
  }
  if (wss.clients.size === numPlayers) {
    broadcast('GAME START')
  }
  ws.on('message', (data) => {
    console.log('received:', data)
    let json = null
    try {
      json = JSON.parse(data)
    } catch (error) {
      broadcast('cant parse data')
      return
    }
    let success = false
    const player = json.player ? player2 : player1
    if (json.action === 'block') {
      success = player.placeBlock(json.x, json.y)
    } else if (json.action === 'knight') {
      success = player.placeKnight(json.x, json.y)
    } else if (json.action === 'move') {
      success = player.moveKnight(json.x, json.y, json.destX, json.destY)
    } else if (json.action === 'end') {
      success = player.endTurn()
    } else { console.log('unknown action') }
    // ws.send(data)
    broadcast(success ? 'valid action' : 'invalid action')
    broadcast(data)
  })
  ws.on('close', () => {
    broadcast('GAME END')
  })
})

function broadcast (message) {
  wss.clients.forEach(function each (client) {
    // if (client.readyState === WebSocket.OPEN) {
    client.send(message)
  })
}

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
