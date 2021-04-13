const WebSocket = require('ws')
const events = require('events')
const { performance } = require('perf_hooks')
const Torres = require('../public/javascripts/torres')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = { id: null }

let tt = {}
let ttLength = 0
let lookup = 0

async function myMove () {
  const torres = await new Promise(resolve => {
    send('status_request', ['game_state'])
    messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
  })
  const t0 = performance.now()
  tt = {}
  ttLength = 0
  lookup = 0
  const bestMove = negamax(torres, torres.activePlayer, 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, torres.activePlayer)
  const t1 = performance.now()
  console.log(bestMove)
  console.log('time: ' + (t1 - t0) + 'ms')
  console.log(lookup)

  if (bestMove.move) {
    send('move', bestMove.move)
  } else {
    send('move', { action: 'turn_end' })
  }
}

/*
function minimax (torres, playerId, depth, alpha, beta) {
  if (depth === 0 || !torres.gameRunning) { // should always be at end of turn
    const moveValue = {
      move: null,
      value: (torres.isAtEndOfPhase() || !torres.gameRunning)
        ? getValue(torres.getPointsPerPlayer(), playerId)
        : getValue(torres.evaluateState(), playerId)
    }
    return moveValue
  }
  const moves = torres.getLegalMoves(torres.activePlayer)
  let bestMove
  let value
  if (torres.activePlayer === playerId) { // maximizing player
    let value = Number.NEGATIVE_INFINITY
    for (const move of moves) {
      let info = {}
      if (move.action === 'turn_end') info = torres.getInfo()
      makeMove(torres, move, torres.activePlayer)
      // only reduce depth if move is turn_end
      const childMove = minimax(torres, playerId, move.action === 'turn_end' ? depth - 1 : depth, alpha, beta)
      undoMove(torres, move, torres.activePlayer, info)
      if (childMove.value > value) {
        value = childMove.value
        bestMove = { move, value: childMove.value }
      }
      alpha = Math.max(alpha, childMove.value)
      if (alpha >= beta) { // beta cutoff
        break
      }
    }
  } else { // minimizing player
    value = Number.POSITIVE_INFINITY
    for (const move of moves) {
      let info = {}
      if (move.action === 'turn_end') info = torres.getInfo()
      makeMove(torres, move, torres.activePlayer)
      // only reduce depth if move is turn_end
      const childMove = minimax(torres, playerId, move.action === 'turn_end' ? depth - 1 : depth, alpha, beta)
      undoMove(torres, move, torres.activePlayer, info)
      if (childMove.value < value) {
        value = childMove.value
        bestMove = { move, value: childMove.value }
      }
      beta = Math.min(beta, childMove.value)
      if (beta <= alpha) { // alpha cutoff
        break
      }
    }
  }
  return bestMove
} */

function negamax (torres, playerId, depth, alpha, beta, prevPlayer) {
  if (depth === 0 || !torres.gameRunning) {
    const moveValue = {
      move: null,
      value: -((torres.isAtEndOfPhase() || !torres.gameRunning)
        ? getValue(torres.getPointsPerPlayer(), prevPlayer)
        : getValue(torres.evaluateState(), prevPlayer))
    }
    return moveValue
  }
  const a = alpha
  let gameState
  if (tt) {
    gameState = JSON.stringify(torres)
    const ttEntry = tt[gameState]
    if (ttEntry && ttEntry.depth >= depth) {
      lookup++
      if (ttEntry.flag === 'EXACT') {
        lookup++
        return { move: null, value: ttEntry.value }
      } else if (ttEntry.flag === 'LOWERBOUND') {
        alpha = Math.max(alpha, ttEntry.value)
      } else if (ttEntry.flag === 'UPPERBOUND') {
        beta = Math.min(beta, ttEntry.beta)
      }
      if (alpha >= beta) {
        return { move: null, value: ttEntry.value }
      }
    }
  }

  const moves = torres.getLegalMovesLimited(playerId, true)
  let bestMove
  let value = Number.NEGATIVE_INFINITY
  for (const move of moves) {
    let info = {}
    if (move.action === 'turn_end') info = torres.getInfo()
    makeMove(torres, move, playerId)
    const childMove = negamax(torres, playerId === 1 ? 0 : 1, move.action === 'turn_end' ? depth - 1 : depth, -beta, -alpha, playerId) // only reduce depth if move is turn is ended
    childMove.value = -childMove.value
    undoMove(torres, move, playerId, info)
    if (childMove.value > value) {
      value = childMove.value
      bestMove = { move, value: childMove.value }
    }
    alpha = Math.max(alpha, childMove.value)
    if (alpha >= beta) {
      break
    }
  }
  // transposition table store
  if (tt && ttLength < 1000000) {
    const ttEntry = {}
    ttEntry.value = value
    if (value <= a) {
      ttEntry.flag = 'UPPERBOUND'
    } else if (value >= beta) {
      ttEntry.flag = 'LOWERBOUND'
    } else {
      ttEntry.flag = 'EXACT'
    }
    ttEntry.depth = depth
    tt[gameState] = ttEntry
    ttLength++
  }
  if (ttLength === 999999) {
    console.log('full')
  }

  return bestMove
}

function getValue (pointsPerPlayer, playerId) {
  return pointsPerPlayer.reduce((score, points, i) => i === playerId ? score + points : score - points, 0)
}

function makeMove (torres, move, playerId) {
  switch (move.action) {
    case 'block_place':
      torres.placeBlockExecute(playerId, move.x, move.y)
      break
    case 'knight_place':
      torres.placeKnightExecute(playerId, move.x, move.y)
      break
    case 'knight_move':
      torres.moveKnightExecute(playerId, move.x, move.y, move.destX, move.destY)
      break
    case 'turn_end':
      torres.endTurn(playerId)
      break
    default:
      break
  }
}

function undoMove (torres, move, playerId, info) {
  switch (move.action) {
    case 'block_place':
      torres.placeBlockUndo(playerId, move.x, move.y)
      break
    case 'knight_place':
      torres.placeKnightUndo(playerId, move.x, move.y)
      break
    case 'knight_move':
      torres.moveKnightUndo(playerId, move.x, move.y, move.destX, move.destY)
      break
    case 'turn_end':
      torres.endTurnUndoTo(info)
      break
    default:
      break
  }
}

function send (type, data) {
  const message = {
    type: type,
    data: data
  }
  console.log('send:', message)
  ws.send(JSON.stringify(message))
}

function onError (err) {
  console.log(err)
}

messageParser.on('error', (data) => {
  onError(data.message)
})

messageParser.on('game_start', (data) => {
  console.log('game started')
  myInfo.id = data.your_player_id
  if (data.your_player_id === 0) {
    // messageParser.emit('my_turn')
    myMove()
  }
})

messageParser.on('game_end', (data) => {
  console.log('game ended')
})

messageParser.on('move_update', (data) => {
  // TODO this check only work for two players
  if ((data.next_player === myInfo.id)) {
    myMove()
  }
})

messageParser.on('move_response', (data) => {
})

ws.on('open', () => {
  console.log('connected')
})

ws.on('message', (message) => {
  // console.log('received:', message.slice(0, 70))
  try {
    const json = JSON.parse(message)
    messageParser.emit(json.type, json.data)
  } catch (err) {
    onError('Cant parse message.')
  }
})

ws.on('error', (err) => {
  onError(err)
})

ws.on('close', (code, reason) => {
  console.log('disconnected', code, reason)
})
