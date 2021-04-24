/* eslint-disable no-unused-vars */
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import Torres from '../../game-logic/src/torres.js'
import { performance } from 'perf_hooks'

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new EventEmitter()

const myInfo = {
  type: 'bfs_ai',
  playerInfo: null,
  torres: null
}

const TIMELIMIT = 1000
let t0 = performance.now()

async function myMove () {
  const torres = myInfo.torres
  t0 = performance.now()
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
    this.boardValue = this.getBoardValue()
    this.value = this.getValue()
  }

  getBoardValue () {
    return this.gameState._board.evaluateBoard(myInfo.playerInfo.id)
  }

  getValue () {
    const boardPoints = this.getBoardValue()
    // const shortPoints = -this.moves.length
    // const numKnightsPoints = -this.gameState._playerList[myInfo.playerInfo.id]._numKnights
    return boardPoints
  }
}

class Queue {
  constructor () {
    this.items = {}
    this.headIndex = 0
    this.tailIndex = 0
  }

  enqueue (item) {
    this.items[this.tailIndex] = item
    this.tailIndex++
  }

  dequeue () {
    const item = this.items[this.headIndex]
    delete this.items[this.headIndex]
    this.headIndex++
    return item
  }

  peek () {
    return this.items[this.headIndex]
  }

  get length () {
    return this.tailIndex - this.headIndex
  }
}

function bestMoveForTurn (torres) {
  const state = new State([], torres)
  return generateAllTurnsDFS(state)
  // return generateAllTurnsBFS(state)
}

function generateAllTurnsBFS (startState) {
  const gameDict = {}
  const states = new Queue()
  states.enqueue(startState)
  while (states.length) {
    // TODO this may be unefficient
    const currState = states.dequeue()
    const stringGame = JSON.stringify(currState.gameState)
    const stringBoard = JSON.stringify(currState.gameState._board._squares)
    if (gameDict[stringBoard]) {
      continue
    }
    gameDict[stringBoard] = currState
    const playerId = currState.gameState.activePlayer
    currState.gameState.getLegalMoves(playerId).forEach(move => {
      if (move.action === 'turn_end') return
      const game = Torres.assignInstances(JSON.parse(stringGame))
      makeMove(game, move, playerId)
      const newMoves = currState.moves.concat([move])
      const newState = new State(newMoves, game)
      if (currState.boardValue > newState.boardValue) return
      states.enqueue(newState)
    })
  }
  return Object.values(gameDict).reduce(
    (bestState, currState) => bestState.value < currState.value ? currState : bestState).moves.concat([{ action: 'turn_end' }])[0]
}

function generateAllTurnsDFS (state) {
  const gameDict = {}
  generateAllTurnsDFSRecursion(state, null, gameDict)
  const id = myInfo.playerInfo.id
  // special case if cant do turn end
  let specialCase = true
  state.gameState.getLegalMoves(id).forEach(move => {
    if (move.action === 'turn_end') specialCase = false
  })
  if (specialCase) {
    delete gameDict[JSON.stringify(state.gameState)]
  }
  const stringMoves = Object.values(gameDict).reduce((bestState, currState) => bestState.value < currState.value ? currState : bestState).moves
  const moves = JSON.parse(stringMoves)
  return moves.concat([{ action: 'turn_end' }])[0]
}

function generateAllTurnsDFSRecursion (state, move, gameDict) {
  const id = myInfo.playerInfo.id
  const oldBoardValue = state.getBoardValue()
  if (move) makeMoveState(state, move, id)
  const newBoardValue = state.getBoardValue()
  if (oldBoardValue <= newBoardValue) {
    const stringGameState = JSON.stringify(state.gameState)
    if (!gameDict[stringGameState]) {
      gameDict[stringGameState] = { moves: JSON.stringify(state.moves), value: state.getValue() }
      state.gameState.getLegalMovesOrdered(id).forEach(newMove => {
        if (newMove.action !== 'turn_end' && (performance.now() - t0 < TIMELIMIT || !TIMELIMIT)) {
          generateAllTurnsDFSRecursion(state, newMove, gameDict)
        }
      })
    }
  }
  if (move) undoMoveStateNoTurnEnd(state, move)
}

function generateAllTurnsDFSIterative (state, move, gameDict) {
  const moves = [move]
  const unmoves = []
  while (moves.length) {
    move = moves.pop()
    if (move === 'turn_end') {
      continue
    }
    const id = myInfo.playerInfo.id
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
function evaluateStateForAll (gameState) {
  return gameState.playerList.map(player => gameState._board.evaluateBoard(player.id))
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
  const id = myInfo.playerInfo.id
  makeMove(state.gameState, move, id)
  state.moves.push(move)
}

function undoMoveStateNoTurnEnd (state, move) {
  const id = myInfo.playerInfo.id
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
    case 'king_place':
      torres.placeKingExecute(move.x, move.y)
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
    case 'king_place':
      torres.placeKingUndo(playerId)
      break
    default:
      break
  }
}

async function update () {
  const playerInfo = await new Promise(resolve => {
    send('status_request', ['player_info'])
    messageParser.once('player_info_response', (data) => resolve(data))
  })
  const torres = await new Promise(resolve => {
    send('status_request', ['game_state'])
    messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
  })
  myInfo.playerInfo = playerInfo
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
  update()
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
