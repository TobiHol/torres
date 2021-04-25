import express from 'express'
import logger from 'morgan'
import WebSocket from 'ws'

// eslint-disable-next-line no-unused-vars
import { Torres, RANDOM, CHOICE, BALANCED, ALL_RANDOM } from '../game-logic/index.js'

const app = express()
const wss = new WebSocket.Server({ noServer: true })
const port = process.env.PORT || 3000

app.use(express.json())
app.use(logger('dev'))

/*
  game init
*/

const numPlayers = 4
const torres = new Torres({
  numPlayers: numPlayers,
  initMode: CHOICE
})

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

/**
 * Websocket API
 */

const PLAYERS = new Array(numPlayers).fill(null)
const PLAYER_TYPES = new Array(numPlayers).fill(null)
function getPlayerId (obj) {
  return PLAYERS.findIndex((o) => o === obj)
}
function playerStatus () {
  return (PLAYERS.map(player => player ? 'connected' : 'disconnected'))
}
function playerType () {
  return (PLAYER_TYPES.map(type => type || '-'))
}

function broadcast (message) {
  wss.clients.forEach(function each (client) {
    // if (client.readyState === WebSocket.OPEN) {
    client.send(message)
    console.log(`broadcast: ${message}`)
  })
}

wss.on('connection', (ws) => {
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
        onMove(json.data)
        break
      case 'status_request':
        onRequest(json.data)
        break
      case 'info':
        onInfo(json.data)
        break
      case 'command':
        onCommand(json.data)
        break
      default:
        break
    }
  })
  ws.on('close', () => {
    const id = getPlayerId(ws)
    PLAYERS[id] = null // remove client form players
    broadcast(JSON.stringify({
      type: 'player_disconnect',
      data: {
        id: id
      }
    }))
  })
  function onMove (data) {
    if (!torres.gameRunning) {
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
    const move = data
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
      case 'king_place':
        valid = torres.placeKing(playerId, move.x, move.y)
        break
      case 'turn_end':
        valid = torres.endTurn(playerId)
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
          ...move
        }
      }))
    }
    if (!torres.gameRunning) {
      broadcast(JSON.stringify({
        type: 'game_end',
        data: {
          winner: null
        }
      }))
    }
  }
  function onRequest (data) {
    const requests = data
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
            data: torres.getLegalMoves(getPlayerId(ws))
          }))
          break
        case 'player_info':
          ws.send(JSON.stringify({
            type: 'player_info_response',
            data: {
              player_status: playerStatus(),
              player_type: playerType(),
              id: getPlayerId(ws)
            }
          }))
          break
        default:
          break
      }
    }
  }
  function onInfo (data) {
    const info = data
    PLAYER_TYPES[getPlayerId(ws)] = info.type
  }
  function onCommand (data) {
    const commands = data
    for (const command of commands) {
      switch (command) {
        case 'game_reset':
          torres.resetGame()
          break
        case 'game_init':
          torres.initGame()
          broadcast(JSON.stringify({
            type: 'game_start'
          }))
          break
        case 'game_join':
          // if all spots are taken
          if (getPlayerId(null) === -1) {
            ws.send(JSON.stringify({
              type: 'error',
              data: {
                message: `Already ${numPlayers} players connected.`
              }
            }))
          } else {
            joinGame()
          }
          break
        case 'game_leave':
          leaveGame()
          break
        default:
          break
      }
    }
  }
  function joinGame () {
    const id = getPlayerId(null)
    PLAYERS[id] = ws // assign client to player
    broadcast(JSON.stringify({
      type: 'player_connect',
      data: {
        id: id
      }
    }))
  }
  function leaveGame () {
    const id = getPlayerId(ws)
    PLAYERS[id] = null // remove client form players
    broadcast(JSON.stringify({
      type: 'player_disconnect',
      data: {
        id: id
      }
    }))
  }
})

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
