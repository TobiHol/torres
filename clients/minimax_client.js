const WebSocket = require('ws')
const events = require('events')
const { performance } = require('perf_hooks')
const Torres = require('../public/javascripts/torres')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = {
  type: 'minimax_ai',
  playerInfo: null,
  torres: null
}

let tt = {}
let ttLength = 0
let lookup = 0
let cutoffs = 0

async function myMove () {
  const torres = myInfo.torres
  const t0 = performance.now()
  tt = {}
  ttLength = 0
  lookup = 0
  cutoffs = 0
  let bestMove
  if (torres.numPlayers === 2) {
    bestMove = negamax(torres, torres.activePlayer, 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, torres.activePlayer, 1000, t0)
  } else {
    bestMove = minimax(torres, torres.activePlayer, 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 1000, t0)
  }
  console.log('cutoffs: ' + cutoffs)
  console.log('lookups: ' + lookup)

  if (bestMove.move) {
    send('move', bestMove.move)
  } else {
    send('move', { action: 'turn_end' })
  }
}

function minimax (torres, playerId, depth, alpha, beta, timeLimit = null, t0 = null) {
  if (depth === 0 || !torres.gameRunning) { // should always be at end of turn
    const moveValue = {
      move: null,
      value: (torres.isAtEndOfPhase() || !torres.gameRunning)
        ? getValue(torres.getPointsPerPlayer(), playerId)
        : getValue(torres.evaluateState(), playerId)
    }
    return moveValue
  }
  const moves = torres.getLegalMovesOrdered(torres.activePlayer)
  let bestMove
  let value
  if (torres.activePlayer === playerId) { // maximizing player
    let value = Number.NEGATIVE_INFINITY
    for (const move of moves) {
      let info = {}
      if (move.action === 'turn_end') info = torres.getInfo()
      torres.executeMove(move)
      // only reduce depth if move is turn_end
      const childMove = minimax(torres, playerId, move.action === 'turn_end' ? depth - 1 : depth, alpha, beta, timeLimit, t0)
      torres.undoMove(move, info)
      if (childMove.value > value) {
        value = childMove.value
        bestMove = { move, value: childMove.value }
      }
      alpha = Math.max(alpha, childMove.value)
      if (alpha >= beta) { // beta cutoff
        cutoffs++
        break
      }
      if (timeLimit && performance.now() - t0 > timeLimit) {
        break
      }
    }
  } else { // minimizing player
    value = Number.POSITIVE_INFINITY
    for (const move of moves) {
      let info = {}
      if (move.action === 'turn_end') info = torres.getInfo()
      torres.executeMove(move)
      // only reduce depth if move is turn_end
      const childMove = minimax(torres, playerId, move.action === 'turn_end' ? depth - 1 : depth, alpha, beta, timeLimit, t0)
      torres.undoMove(move, info)
      if (childMove.value < value) {
        value = childMove.value
        bestMove = { move, value: childMove.value }
      }
      beta = Math.min(beta, childMove.value)
      if (beta <= alpha) { // alpha cutoff
        break
      }
      if (timeLimit && performance.now() - t0 > timeLimit) {
        break
      }
    }
  }
  return bestMove
}

function negamax (torres, playerId, depth, alpha, beta, prevPlayer, timeLimit, t0) {
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
        cutoffs++
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
  const moves = torres.getLegalMovesOrdered(playerId, true)
  let bestMove
  let value = Number.NEGATIVE_INFINITY
  for (const move of moves) {
    let info = {}
    if (move.action === 'turn_end') info = torres.getInfo()
    torres.executeMove(move)

    // recursive call
    const childMove = negamax(torres, playerId === 1 ? 0 : 1, move.action === 'turn_end' ? depth - 1 : depth, // only reduce depth if move is turn is ended
      -beta, -alpha, playerId, timeLimit, t0)

    childMove.value = -childMove.value // - negamax
    // get back to original game state
    torres.undoMove(move, info)
    if (childMove.value > value) {
      value = childMove.value
      bestMove = { move, value: childMove.value }
    }
    alpha = Math.max(alpha, childMove.value)
    if (alpha >= beta) {
      cutoffs++
      break
    }
    if (timeLimit && performance.now() - t0 > timeLimit) {
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

// TODO: use torres methods
function getValue (pointsPerPlayer, playerId) {
  return pointsPerPlayer.reduce((score, points, i) => i === playerId ? score + points : score - points, 0)
}

async function update (updatePI = true) {
  if (updatePI) {
    myInfo.playerInfo = await new Promise(resolve => {
      send('status_request', ['player_info'])
      messageParser.once('player_info_response', (data) => resolve(data))
    })
  }
  const torres = await new Promise(resolve => {
    send('status_request', ['game_state'])
    messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
  })
  myInfo.torres = torres
  if (torres.activePlayer === myInfo.playerInfo.id && torres.gameRunning) {
    myMove()
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
  update()
})

messageParser.on('game_end', (data) => {
  console.log('game ended')
  update()
})

messageParser.on('move_update', (data) => {
  if (data.next_player === myInfo.playerInfo.id) {
    update(false)
  }
})

messageParser.on('move_response', (data) => {
})

messageParser.on('player_connect', (data) => {
  update()
  send('info', {
    type: myInfo.type
  })
})

messageParser.on('player_disconnect', (data) => {
  update()
})

ws.on('open', () => {
  console.log('connected')
  send('command', ['game_join'])
})

ws.on('message', (message) => {
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
