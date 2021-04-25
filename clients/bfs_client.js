/* eslint-disable no-unused-vars */
const WebSocket = require('ws')
const events = require('events')
const Torres = require('../public/javascripts/torres')
const { performance } = require('perf_hooks')
const TinyQueue = require('tinyqueue')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

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
  constructor (moves, gameState, depth = 0) {
    this.moves = moves
    this.gameState = gameState
    this.boardValue = this.getBoardValue()
    this.value = this.getValue()
    this.depth = depth
  }

  increaseDepth () {
    for (let i = 0; i < this.gameState._numPlayers; i++) {
      let legalMoves = this.gameState.getLegalMoves(this.gameState._activePlayer)
      while (legalMoves.length && !legalMoves.some(move => move.action === 'turn_end')) {
        this.gameState.executeMove(legalMoves[0])
        this.moves.push(legalMoves[0])
        legalMoves = this.gameState.getLegalMoves(this.gameState._activePlayer)
      }
      if (legalMoves.length) this.gameState.executeMove({ action: 'turn_end' })
      this.moves.push({ action: 'turn_end', note: 'forDepthSkip' })
    }
    this.depth += 1
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
  // return generateAllTurnsDFS(state)
  // let beamWidth = 0
  // let maxDepth = 0
  // switch (myInfo.playerInfo.id) {
  //   case 0:
  //     beamWidth = 10000
  //     maxDepth = 1
  //     break
  //   case 1:
  //     beamWidth = 5000
  //     maxDepth = 2
  //     break
  //   case 2:
  //     beamWidth = 2500
  //     maxDepth = 4
  //     break
  //   case 3:
  //     beamWidth = 1000
  //     maxDepth = 10
  //     break
  //   default:
  //     break
  // }
  return generateAllTurnsDFS(state)
}

function generateAllTurnsBFS (startState, beamWidth = 5000, maxDepth = 3) {
  const id = myInfo.playerInfo.id
  const gameDict = {}
  let currWidth = 0
  let currDepth = 0
  // pop state with best value
  let statesQueue = new TinyQueue([startState], (stateA, stateB) => {
    return stateB.value - stateA.value
  })
  while (currDepth < maxDepth) {
    if (currWidth >= beamWidth || statesQueue.length === 0) {
      statesQueue = new TinyQueue([], (stateA, stateB) => {
        return stateB.value - stateA.value
      })
      Object.values(gameDict).forEach(state => {
        if (state.depth === currDepth) {
          state.increaseDepth()
          statesQueue.push(state)
        }
      })
      currWidth = 0
      currDepth += 1
    }
    // go one depth deeper
    const currState = statesQueue.pop()
    const stringGame = JSON.stringify(currState.gameState)
    const stringBoard = JSON.stringify(currState.gameState._board._squares)
    if (!(currState.moves.length && currState.moves[currState.moves.length - 1].note)) {
      if (gameDict[stringBoard]) {
        continue
      }
      gameDict[stringBoard] = currState
      currWidth += 1
    }
    currState.gameState.getLegalMovesOrdered(id).forEach(move => {
      if (move.action === 'turn_end' || (performance.now() - t0 > TIMELIMIT && TIMELIMIT)) return
      const game = Torres.assignInstances(JSON.parse(stringGame))
      game.executeMove(move)
      const newMoves = currState.moves.concat([move])
      const newState = new State(newMoves, game)
      if (currState.boardValue > newState.boardValue) return
      statesQueue.push(newState)
    })
  }
  if (!canTurnEnd(startState, id)) {
    delete gameDict[JSON.stringify(startState.gameState._board._squares)]
  }
  console.log(`reached: ${currDepth}/${maxDepth} depth, ${currWidth}/${beamWidth} width`)
  return Object.values(gameDict).reduce(
    (bestState, currState) => bestState.value < currState.value ? currState : bestState).moves.concat([{ action: 'turn_end' }])[0]
}
let movesMade = 0
function generateAllTurnsDFS (state) {
  const gameDict = {}
  generateAllTurnsDFSRecursion(state, null, gameDict)
  console.log(movesMade)
  movesMade = 0
  const id = myInfo.playerInfo.id
  if (!canTurnEnd(state, id)) {
    delete gameDict[JSON.stringify(state.gameState)]
  }
  const stringMoves = Object.values(gameDict).reduce((bestState, currState) => bestState.value < currState.value ? currState : bestState).moves
  const moves = JSON.parse(stringMoves)
  return moves.concat([{ action: 'turn_end' }])[0]
}

function generateAllTurnsDFSRecursion (state, move, gameDict) {
  movesMade++
  const oldBoardValue = state.getBoardValue()
  if (move) makeMoveState(state, move)
  const newBoardValue = state.getBoardValue()
  if (oldBoardValue <= newBoardValue) {
    const stringGameState = JSON.stringify(state.gameState)
    if (!gameDict[stringGameState]) {
      gameDict[stringGameState] = { moves: JSON.stringify(state.moves), value: state.getValue() }
      state.gameState.getLegalMovesOrdered(myInfo.playerInfo.id).forEach(newMove => {
        if (newMove.action === 'turn_end' || !(performance.now() - t0 < TIMELIMIT || !TIMELIMIT)) return
        generateAllTurnsDFSRecursion(state, newMove, gameDict)
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

function canTurnEnd (state, id) {
  let canEnd = false
  state.gameState.getLegalMoves(id).forEach(move => {
    if (move.action === 'turn_end') canEnd = true
  })
  return canEnd
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
  state.gameState.executeMove(move)
  state.moves.push(move)
}

function undoMoveStateNoTurnEnd (state, move) {
  state.gameState.undoMove(move)
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
