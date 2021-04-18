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

const numPlayers = 4
const Torres = require('./public/javascripts/torres')
const torres = new Torres(numPlayers, 'choice')

// for testing
const { performance } = require('perf_hooks')
let start

/*
  express API
*/

app.get('/', function (req, res) {
  res.send(torres.html())
})

app.get('/ascii', function (req, res) {
  res.send(torres.ascii())
})

app.get('/game_state', function (req, res) {
  res.send(torres)
})

app.get('/legal_moves', function (req, res) {
  res.send(torres.getLegalMoves(torres.activePlayer))
})

// only used for testing
app.post('/api', function (req, res) {
  let success = false
  console.log('Received action : ' + JSON.stringify(req.body))
  if (req.body.action === 'init') {
    success = torres.initGame()
  } else if (req.body.action === 'reset') {
    success = torres.resetGame()
  } else if (req.body.action === 'legal_moves') {
    success = torres.getLegalMoves(req.body.player)
  } else if (req.body.action === 'block_place') {
    success = torres.placeBlock(req.body.player, req.body.x, req.body.y)
  } else if (req.body.action === 'knight_place') {
    success = torres.placeKnight(req.body.player, req.body.x, req.body.y)
  } else if (req.body.action === 'knight_move') {
    success = torres.moveKnight(req.body.player, req.body.x, req.body.y, req.body.destX, req.body.destY)
  } else if (req.body.action === 'turn_end') {
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
    ws.send(JSON.stringify({
      type: 'error',
      data: {
        message: `Already ${numPlayers} players connected.`
      }
    }))
    ws.close()
    return
  }
  PLAYERS[getPlayerId(null)] = ws // assign client to player
  // start game
  if (wss.clients.size === numPlayers) {
    start = performance.now()
    torres.initGame()
    GAME_ON = true
    wss.clients.forEach(function each (client) {
      client.send(JSON.stringify({
        type: 'game_start',
        data: {
          your_player_id: getPlayerId(client)
        }
      }))
    })
  }
  ws.on('message', (data) => {
    console.log('received:', data)
    let json = null
    try {
      json = JSON.parse(data)
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        data: {
          message: `The send data could not be parsed to JSON. \n Data: ${data}`
        }
      }))
      return
    }
    switch (json.type) {
      case 'move':
        onMove()
        break
      case 'status_request':
        onRequest()
        break
      case 'info':
        onInfo()
        break
      default:
        break
    }
    function onMove () {
      if (!GAME_ON) {
        ws.send(JSON.stringify({
          type: 'error',
          data: {
            message: 'The game has not started yet.'
          }
        }))
        return
      }
      let valid = false
      const playerId = getPlayerId(ws)
      const move = json.data
      switch (move.action) {
        case 'block_place':
          valid = torres.placeBlock(playerId, move.x, move.y)
          break
        case 'knight_place':
          valid = torres.placeKnight(playerId, move.x, move.y)
          break
        case 'knight_move':
          valid = torres.moveKnight(playerId, move.x, move.y, move.destX, move.destY)
          break
        case 'turn_end':
          valid = torres.endTurn(playerId)
          console.log('\n' + (performance.now() - start) + '\n')
          break
        default:
          break
      }
      ws.send(JSON.stringify({
        type: 'move_response',
        data: {
          valid: valid
        }
      }))
      if (valid) {
        broadcast(JSON.stringify({
          type: 'move_update',
          data: {
            player: playerId,
            next_player: torres.activePlayer,
            ...json.data
          }
        }))
      }
    }
    function onRequest () {
      const requests = json.data
      for (const request of requests) {
        switch (request) {
          case 'game_state':
            ws.send(JSON.stringify({
              type: 'game_state_response',
              data: torres
            }))
            break
          case 'legal_moves':
            ws.send(JSON.stringify({
              type: 'legal_moves_response',
              data: torres.getLegalMoves(torres.activePlayer)
            }))
            break
          default:
            break
        }
      }
    }
    function onInfo () {
      const ai = json.data
      const playerId = getPlayerId(ws)
      torres.setPlayerAI(playerId, ai)
    }
  })
  ws.on('close', () => {
    torres.resetGame()
    const playerId = getPlayerId(ws)
    PLAYERS[playerId] = null // remove client form players
    // broadcast(`Player ${playerId} disconnected.`)
    // end game
    if (GAME_ON) {
      GAME_ON = false
      broadcast(JSON.stringify({
        type: 'game_end',
        data: {
          winner: null
        }
      }))
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
