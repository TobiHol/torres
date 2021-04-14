const WebSocket = require('ws')
const events = require('events')
const Torres = require('../public/javascripts/torres')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = { id: null }

// do stuff for own turn here.
async function myMove () {
  const torres = await new Promise(resolve => {
    send('status_request', ['game_state'])
    messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
  })
  const action = bestMoveForTurn(torres)
  // await new Promise(resolve => setTimeout(resolve, 100))
  if (action) {
    send('move', action)
  } else {
    send('move', { action: 'turn_end' })
  }
}

class State {
  constructor (moves, gameState) {
    this.moves = moves
    this.gameState = gameState
    this.value = this.getValue()
  }

  getValue () {
    return evalFunction(evaluateAnyState(this.gameState), myInfo.id)
  }
}

function bestMoveForTurn (torres) {
  const state = new State([], torres)
  return generateAllTurnsBFS(state).reduce(
    (bestState, currState) => bestState.value < currState.value ? currState : bestState).moves.concat([{ action: 'turn_end' }])[0]
}

function generateAllTurnsBFS (startState) {
  const gameDict = {}
  const states = [startState]
  while (states.length) {
    const currState = states.shift()
    const stringGameState = JSON.stringify(currState.gameState)
    const stringBoardBoard = JSON.stringify(currState.gameState._board._squares)
    if (gameDict[stringBoardBoard]) {
      continue
    }
    gameDict[stringBoardBoard] = currState
    const playerId = currState.gameState.activePlayer
    currState.gameState.getLegalMoves(playerId).forEach(move => {
      // TODO changed for test
      if (move.action !== 'turn_end') {
        const gameState = Torres.assignInstances(JSON.parse(stringGameState))
        makeMove(gameState, move, playerId)
        const newMove = currState.moves.concat([move])
        states.push(new State(newMove, gameState))
      }
    })
  }
  return Object.values(gameDict)
}

function generateAllTurnsDFS (state) {
  const gameDict = {}
  generateAllTurnsDFSRecursion(state, null, gameDict)
  const stringMoves = Object.values(gameDict).reduce((bestState, currState) => bestState.value < currState.value ? currState : bestState).moves
  const moves = JSON.parse(stringMoves)
  return moves.concat([{ action: 'turn_end' }])[0]
}

function generateAllTurnsDFSRecursion (state, move, gameDict) {
  if (move === 'turn_end') {
    return
  }
  const id = state.gameState.activePlayer
  makeMoveState(state, move, id)
  const stringGameState = JSON.stringify(state.gameState)
  if (!gameDict[stringGameState]) {
    gameDict[stringGameState] = { moves: JSON.stringify(state.moves), value: state.getValue() }
    state.gameState.getLegalMoves(id).forEach(newMove => {
      if (newMove.action !== 'turn_end') {
        generateAllTurnsDFSRecursion(state, newMove, gameDict)
      }
    })
  }
  undoMoveStateNoTurnEnd(state, move)
}

function generateAllTurnsDFSIterative (state, move, gameDict) {
  moves = [move]
  unmoves = []
  while (moves.length) {
    move = moves.pop()
    if (move === 'turn_end') {
      continue
    }
    const id = state.gameState.activePlayer
    makeMoveState(state, move)
    unmoves.push(move)
    const stringGameState = JSON.stringify(state)
    if (gameDict[stringGameState]) {
      continue
    }
    gameDict[JSON.stringify(state)] = { moves: state.moves, value: state.getValue() }
    state.gameState.getLegalMoves(id).forEach(newMove => {
      if (newMove.action !== 'turn_end') {
        moves.push(newMove)
      }
    })
    undoMoveStateNoTurnEnd(state, move)
  }
}

// get evals
function evaluateAnyState (gameState) {
  return gameState.playerList.map(player => gameState._board.evaluateBoard(player.id) + player.ap)
}

// a eval function
function evalFunction (values, id) {
  return values[id]
  // return bestDelta(values, id)
}

function bestDelta (array, index) {
  const myValue = array[index]
  let highestWithoutMe = 0
  for (const i in array) {
    if (i !== index) {
      highestWithoutMe = Math.max(highestWithoutMe, array[i])
    }
  }
  return myValue - highestWithoutMe
}

function deepCopy (obj) {
  return Torres.assignInstances(JSON.parse(JSON.stringify(obj)))
}

function makeMoveAndClone (torres, move, playerId) {
  const dtorres = deepCopy(torres)
  makeMove(dtorres, move, playerId)
  return dtorres
}

function makeMoveState (state, move) {
  if (!move) {
    return
  }
  const id = state.gameState.activePlayer
  makeMove(state.gameState, move, id)
  state.moves.push(move)
}

function undoMoveStateNoTurnEnd (state, move) {
  if (!move) {
    return
  }
  const id = state.gameState.activePlayer
  undoMoveNoTurnEnd(state.gameState, move, id)
  state.moves.pop()
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

function undoMoveNoTurnEnd (torres, move, playerId) {
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
