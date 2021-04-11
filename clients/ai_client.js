const WebSocket = require('ws')
const events = require('events')
const { performance } = require('perf_hooks')
const Torres = require('../public/javascripts/torres')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = { id: null }

async function myMove () {
  const torres = await new Promise(resolve => {
    send('status_request', ['game_state'])
    messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
  })
  const t0 = performance.now()
  // const bestMove = minimax(torres, torres.activePlayer, 5, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
  const bestMove = minimax(torres, torres.activePlayer, 5)
  const t1 = performance.now()
  console.log('time: ' + (t1 - t0) + 'ms')
  // console.log(bestMove)
  if (bestMove.move) {
    send('move', bestMove.move)
  } else {
    send('move', { action: 'turn_end' })
  }
}

function minimax (torres, playerId, depth) {
  // const t0 = performance.now()
  const legalMoves = torres.getLegalMoves(torres.activePlayer)
  // const t1 = performance.now()
  // console.log('time getLegalMoves for depth ' + depth + ': ' + (t1 - t0) + 'ms')
  // console.log(legalMoves)
  // legalMoves = legalMoves.sort(function (a, b) { return 0.5 - Math.random() }) // sort randomly
  if (depth === 0 || legalMoves.length === 0) {
    return { move: null, value: torres.getPoints(playerId) }
  }
  let bestMove
  if (torres.activePlayer === playerId) {
    let maxValue = Number.NEGATIVE_INFINITY
    for (const move of legalMoves) {
      let info = {}
      if (move.action === 'turn_end') info = torres.getInfo()
      // console.log(torres._board)
      makeMove(torres, move, torres.activePlayer)
      // console.log(move)
      const childMove = minimax(torres, playerId, depth - 1)
      undoMove(torres, move, torres.activePlayer, info)
      // console.log(torres._board)
      if (childMove.value > maxValue) {
        maxValue = childMove.value
        bestMove = { move, value: childMove.value }
      }
    }
    return bestMove
  } else { // minimizing player
    let minValue = Number.POSITIVE_INFINITY
    for (const move of legalMoves) {
      let info = {}
      if (move.action === 'turn_end') info = torres.getInfo()
      // console.log(torres.getInfo())
      makeMove(torres, move, torres.activePlayer)
      const childMove = minimax(torres, playerId, depth - 1)
      undoMove(torres, move, torres.activePlayer, info)
      // console.log(torres.getInfo())
      if (childMove.value < minValue) {
        minValue = childMove.value
        bestMove = { move, value: childMove.value }
      }
    }
  }
  return bestMove
}

/*
function minimax (torres, playerId, depth, alpha, beta) {
  const legalMoves = torres.getLegalMoves(torres.activePlayer)
  legalMoves.sort(function (a, b) { return 0.5 - Math.random() }) // sort randomly

  if (depth === 0 || legalMoves.length === 0) {
    return { move: null, value: torres.getPoints(playerId) }
  }

  const tmpTorres = Torres.assignInstances(JSON.parse(JSON.stringify(torres)))
  let bestMove
  if (torres.activePlayer === playerId) {
    let maxValue = Number.NEGATIVE_INFINITY
    for (const move of legalMoves) {
      makeMove(torres, move, torres.activePlayer)
      const childMove = minimax(torres, playerId, depth - 1, alpha, beta)
      torres = Torres.assignInstances(JSON.parse(JSON.stringify(tmpTorres)))
      if (childMove.value > maxValue) {
        maxValue = childMove.value
        bestMove = { move, value: childMove.value }
      }
      alpha = Math.max(alpha, childMove.value)
      if (alpha >= beta) {
        break
      }
    }
    return bestMove
  } else { // minimizing player
    let minValue = Number.POSITIVE_INFINITY
    for (const move of legalMoves) {
      makeMove(torres, move, torres.activePlayer)
      const childMove = minimax(torres, playerId, depth - 1, alpha, beta)
      torres = Torres.assignInstances(JSON.parse(JSON.stringify(tmpTorres)))
      if (childMove.value < minValue) {
        minValue = childMove.value
        bestMove = { move, value: childMove.value }
      }
      beta = Math.min(beta, childMove.value)
      if (beta <= alpha) {
        break
      }
    }
  }
  return bestMove
} */

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
