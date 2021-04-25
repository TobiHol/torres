import { performance } from 'perf_hooks'

import { AiClient } from './ai_client.js'
import { TIME_LIMIT } from './constants.js'
import { Torres } from '../../game-logic/index.js'
import TinyQueue from 'tinyqueue'

class BfsClient extends AiClient {
  constructor () {
    super()
    this.myInfo.type = 'bfs_ai'
    this.t0 = 0
  }

  myMove () {
    const torres = this.myInfo.torres
    this.t0 = performance.now()
    const action = this.bestMoveForTurn(torres)
    // await new Promise(resolve => setTimeout(resolve, 100))
    if (action) {
      this.send('move', action)
    } else {
      this.send('move', { action: 'turn_end' })
    }
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

  bestMoveForTurn (torres) {
    const state = new State(this.myInfo.playerInfo.id, [], torres)
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
    return this.generateAllTurnsDFS(state)
  }

  generateAllTurnsBFS (startState, beamWidth = 5000, maxDepth = 3) {
    const id = this.myInfo.playerInfo.id
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
        if (move.action === 'turn_end' || (performance.now() - this.t0 > TIME_LIMIT && TIME_LIMIT)) return
        const game = Torres.assignInstances(JSON.parse(stringGame))
        game.executeMove(move)
        const newMoves = currState.moves.concat([move])
        const newState = new State(this.myInfo.id, newMoves, game)
        if (currState.boardValue > newState.boardValue) return
        statesQueue.push(newState)
      })
    }
    if (!this.canTurnEnd(startState, id)) {
      delete gameDict[JSON.stringify(startState.gameState._board._squares)]
    }
    console.log(`reached: ${currDepth}/${maxDepth} depth, ${currWidth}/${beamWidth} width`)
    return Object.values(gameDict).reduce(
      (bestState, currState) => bestState.value < currState.value ? currState : bestState).moves.concat([{ action: 'turn_end' }])[0]
  }

  generateAllTurnsDFS (state) {
    const gameDict = {}
    this.generateAllTurnsDFSRecursion(state, null, gameDict)
    const id = this.myInfo.playerInfo.id
    if (!this.canTurnEnd(state, id)) {
      delete gameDict[JSON.stringify(state.gameState)]
      console.log('test')
    }
    const stringMoves = Object.values(gameDict).reduce((bestState, currState) => bestState.value < currState.value ? currState : bestState).moves
    const moves = JSON.parse(stringMoves)
    return moves.concat([{ action: 'turn_end' }])[0]
  }

  generateAllTurnsDFSRecursion (state, move, gameDict) {
    const oldBoardValue = state.getBoardValue()
    if (move) this.makeMoveState(state, move)
    const newBoardValue = state.getBoardValue()
    if (oldBoardValue <= newBoardValue) {
      const stringGameState = JSON.stringify(state.gameState)
      if (!gameDict[stringGameState]) {
        gameDict[stringGameState] = { moves: JSON.stringify(state.moves), value: state.getValue() }
        state.gameState.getLegalMovesOrdered(this.myInfo.playerInfo.id).forEach(newMove => {
          if (newMove.action === 'turn_end' || (performance.now() - this.t0 > TIME_LIMIT && TIME_LIMIT)) return
          this.generateAllTurnsDFSRecursion(state, newMove, gameDict)
        })
      }
    }
    if (move) this.undoMoveStateNoTurnEnd(state, move)
  }

  generateAllTurnsDFSIterative (state, move, gameDict) {
    const moves = [move]
    const unmoves = []
    while (moves.length) {
      move = moves.pop()
      if (move === 'turn_end') {
        continue
      }
      const id = this.myInfo.playerInfo.id
      this.makeMoveState(state, move)
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
      this.undoMoveStateNoTurnEnd(state, move)
    }
  }

  canTurnEnd (state, id) {
    let canEnd = false
    state.gameState.getLegalMoves(id).forEach(move => {
      if (move.action === 'turn_end') canEnd = true
    })
    return canEnd
  }

  // get evals
  evaluateStateForAll (gameState) {
    return gameState.playerList.map(player => gameState._board.evaluateBoard(player.id))
  }

  // a eval
  eval (values, id) {
    return values[id]
  // return bestDelta(values, id)
  }

  bestDelta (array, index) {
    const myValue = array[index]
    let highestWithoutMe = 0
    for (const i in array) {
      if (i !== index) {
        highestWithoutMe = Math.max(highestWithoutMe, array[i])
      }
    }
    return myValue - highestWithoutMe
  }

  deepCopy (obj) {
    return Torres.assignInstances(JSON.parse(JSON.stringify(obj)))
  }

  makeMoveState (state, move) {
    state.gameState.executeMove(move)
    state.moves.push(move)
  }

  undoMoveStateNoTurnEnd (state, move) {
    state.gameState.undoMove(move)
    state.moves.pop()
  }

  makeMove (torres, move, playerId) {
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

  undoMoveNoTurnEnd (torres, move, playerId) {
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
}
class State {
  constructor (id, moves, gameState, depth = 0) {
    this.moves = moves
    this.gameState = gameState
    this.boardValue = this.getBoardValue()
    this.value = this.getValue()
    this.depth = depth
    this.id = id
  }

  getBoardValue () {
    return this.gameState._board.evaluateBoard(this.id)
  }

  getValue () {
    const boardPoints = this.getBoardValue()
    // const shortPoints = -this.moves.length
    // const numKnightsPoints = -this.gameState._playerList[myInfo.playerInfo.id]._numKnights
    return boardPoints
  }
}

// eslint-disable-next-line no-unused-vars
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

export { BfsClient }
