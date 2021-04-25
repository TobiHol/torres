import { performance } from 'perf_hooks'

import { AiClient } from './ai_client.js'
import { TIME_LIMIT, MINIMAX, NEGAMAX, EXACT, UPPERBOUND, LOWERBOUND } from './constants.js'

class MinimaxClient extends AiClient {
  constructor ({ version = MINIMAX, depth = 1 }) {
    super()
    this.VERSION = version
    this.DEPTH = depth
    switch (version) {
      case MINIMAX:
        this.myInfo.type = 'minimax_ai'
        this.minimaxAlgo = this.minimax
        break
      case NEGAMAX:
        this.myInfo.type = 'negamax_ai'
        this.minimaxAlgo = this.negamax
        break
    }
    this.tt = new TranspositionTable(100000)
    this.cutoffs = this.lookups = 0
  }

  myMove () {
    this.t0 = performance.now()
    this.tt.clear()
    this.cutoffs = this.lookups = 0

    const bestMove = this.minimaxAlgo(this.myInfo.torres, this.myInfo.playerInfo.id, this.DEPTH, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)

    console.log('cutoffs: ' + this.cutoffs)
    console.log('lookups: ' + this.lookups)

    if (bestMove.move) {
      this.send('move', bestMove.move)
    } else {
      throw new Error('no move was found')
    }
  }

  minimax (torres, playerId, depth, alpha, beta) {
    if (depth === 0 || !torres.gameRunning) { // should always be at end of turn
      const moveValue = {
        move: null,
        value: torres.getRewardPerPlayer(!torres.isAtEndOfPhase() && torres.gameRunning)[playerId]
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
        const childMove = this.minimax(torres, playerId, move.action === 'turn_end' ? depth - 1 : depth, alpha, beta)
        torres.undoMove(move, info)
        if (childMove.value > value) {
          value = childMove.value
          bestMove = { move, value: childMove.value }
        }
        alpha = Math.max(alpha, childMove.value)
        if (alpha >= beta) { // beta cutoff
          this.cutoffs++
          break
        }
        if (performance.now() - this.t0 > TIME_LIMIT) {
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
        const childMove = this.minimax(torres, playerId, move.action === 'turn_end' ? depth - 1 : depth, alpha, beta)
        torres.undoMove(move, info)
        if (childMove.value < value) {
          value = childMove.value
          bestMove = { move, value: childMove.value }
        }
        beta = Math.min(beta, childMove.value)
        if (beta <= alpha) { // alpha cutoff
          break
        }
        if (performance.now() - this.t0 > TIME_LIMIT) {
          break
        }
      }
    }
    return bestMove
  }

  negamax (torres, playerId, depth, alpha, beta, prevPlayer) {
    // transposition table lookups
    const a = alpha
    const gameState = JSON.stringify(torres)
    let ttEntry = this.tt.get(gameState)
    if (ttEntry && ttEntry.depth >= depth) {
      this.lookups++
      if (ttEntry.flag === EXACT) {
        this.cutoffs++
        return { move: null, value: ttEntry.value }
      } else if (ttEntry.flag === LOWERBOUND) {
        alpha = Math.max(alpha, ttEntry.value)
      } else if (ttEntry.flag === UPPERBOUND) {
        beta = Math.min(beta, ttEntry.beta)
      }
      if (alpha >= beta) {
        return { move: null, value: ttEntry.value }
      }
    }

    if (depth === 0 || !torres.gameRunning) {
      const moveValue = {
        move: null,
        value: -(torres.getRewardPerPlayer(!torres.isAtEndOfPhase() && torres.gameRunning)[prevPlayer]) // TODO: prevPlayer doesn't work with king?
      }
      return moveValue
    }
    const moves = torres.getLegalMovesOrdered(playerId, true)
    let bestMove
    let value = Number.NEGATIVE_INFINITY
    for (const move of moves) {
      let info = {}
      if (move.action === 'turn_end') info = torres.getInfo()
      torres.executeMove(move)

      // recursive call
      const childMove = this.negamax(torres, playerId === 1 ? 0 : 1, move.action === 'turn_end' ? depth - 1 : depth, // only reduce depth if move is turn is ended
        -beta, -alpha, playerId)
      childMove.value = -childMove.value // - negamax

      // get back to original game state
      torres.undoMove(move, info)

      if (childMove.value > value) {
        value = childMove.value
        bestMove = { move, value: childMove.value }
      }
      alpha = Math.max(alpha, childMove.value)
      if (alpha >= beta) {
        this.cutoffs++
        break
      }
      if (performance.now() - this.t0 > TIME_LIMIT) {
        break
      }
    }

    // transposition table store
    ttEntry = {}
    ttEntry.value = value
    if (value <= a) {
      ttEntry.flag = UPPERBOUND
    } else if (value >= beta) {
      ttEntry.flag = LOWERBOUND
    } else {
      ttEntry.flag = EXACT
    }
    ttEntry.depth = depth
    this.tt.store(gameState, ttEntry)

    return bestMove
  }
}

class TranspositionTable {
  constructor (capacity) {
    this.CAPACITY = capacity
    this.states = [] // keeps track of age of states
    this.oldestIdx = 0 // points to oldest state
    this.entries = {}
    this.length = 0
  }

  store (state, entry) {
    if (this.length < this.CAPACITY) {
      this.entries[state] = entry
      this.states.push(state)
      this.length++
    } else { // replacement
      delete this.entries[this.states[this.oldestIdx]]
      this.entries[state] = entry
      this.states[this.oldestIdx] = state
      this.oldestIdx = (this.oldestIdx + 1) % this.length
    }
  }

  get (state) {
    return this.entries[state]
  }

  clear () {
    this.states = []
    this.oldestIdx = 0
    this.entries = {}
    this.length = 0
  }
}

export { MinimaxClient }
