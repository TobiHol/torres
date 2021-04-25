import { performance } from 'perf_hooks'

import { AiClient, cloneTorres } from './ai_client.js'
import { TIME_LIMIT } from './constants.js'

class OepClient extends AiClient {
  constructor ({ rollout = true, popSize = 200, probMutation = 0.1, killRate = 0.5 }) {
    super()
    this.myInfo.type = 'oep_ai'
    this.bestTurn = []
    this.rollout = rollout
    this.popSize = popSize
    this.probMutation = probMutation
    this.killRate = killRate
    this.population = []
  }

  myMove () {
    this.t0 = performance.now()
    if (this.bestTurn.length === 0) {
      this.oep()
    }
    if (this.bestTurn.length > 0) {
      this.send('move', this.bestTurn.shift())
    }
  }

  oep () {
    let runs = 0
    this.population = []
    this.init()
    while (true) {
      runs++
      for (const g of this.population) { // TODO: delete?
        g.calcFitness() // only adds to age
      }
      this.population.sort((g1, g2) => g2.fitness - g1.fitness)
      if (performance.now() - this.t0 > TIME_LIMIT) {
        break
      }
      // TODO: kill genomes with same moves -> replace with new random genome?
      const l = this.population.length
      let i = 0
      this.population = this.population.filter(g => {
        if (g.moves.length === 1 && g.moves[0].action === 'turn_end') { // only 'turn_end'
          if (i === 0) {
            i++
            return true
          }
          return false
        }
        return true
      })
      this.population = this.population.slice(0, Math.ceil(l / 2)) // kill the worse half of the population (kill rate )
      this.population = this.procreate()
    }
    this.bestTurn.push(...this.population[0].moves)
    console.log('runs: ' + runs)
  }

  init () {
    for (let i = 0; i < this.popSize; i++) {
      const clonedT = cloneTorres(this.myInfo.torres)
      const g = new Genome(this.randomTurn(clonedT, i < (this.popSize / 2))) // 50% greedy, rest completly random
      g.calcFitness(clonedT, this.myInfo.playerInfo.id, this.rollout)
      this.population.push(g)
    }
  }

  randomTurn (torres, biased) {
    const turn = []
    let move = null
    while (!move || move.action !== 'turn_end') {
      move = biased ? torres.getRandomLegalMoveBiased() : torres.getRandomLegalMove()
      torres.executeMove(move)
      turn.push(move)
    }
    return turn
  }

  procreate () {
    this.population.sort(() => 0.5 - Math.random()) // shuffle pop
    const newPop = []
    while (this.population.length > 1) {
      const parent1 = this.population.pop()
      const parent2 = this.population.pop()
      newPop.push(parent1, parent2)

      for (let numC = 0; numC < 2; numC++) { // two children
        // uniform crossover
        let child = this.uniformCrossover(parent1, parent2)

        // mutation
        if (Math.random() < this.probMutation) {
          child = this.mutate(child.moves)
        }
        const g = new Genome(child.moves)
        g.calcFitness(child.torres, this.myInfo.playerInfo.id, this.rollout)
        newPop.push(g)
      }
    }
    newPop.push(...this.population)
    return newPop
  }

  // TODO: refactor
  uniformCrossover (parent1, parent2) {
    const childMoves = []
    const currTorres = cloneTorres(this.myInfo.torres)
    let move = null
    let i = 0
    while (!move || move.action !== 'turn_end') {
      let success = false
      if (Math.random() < 0.5) {
        move = parent1.moves[i]
        if (!move || !makeMove(currTorres, move, currTorres.activePlayer)) { // illegal move
          move = parent2.moves[i]
        } else {
          success = true
        }
      } else {
        move = parent2.moves[i]
        if (!move || !makeMove(currTorres, move, currTorres.activePlayer)) {
          move = parent1.moves[i]
        } else {
          success = true
        }
      }
      if (!success) {
        if (!move || !makeMove(currTorres, move, currTorres.activePlayer)) { // both parent's moves are illegal
          move = currTorres.getRandomLegalMoveBiased() // TODO: first try i++
          currTorres.executeMove(move)
        }
      }
      childMoves.push(move)
      i++
    }
    return { moves: childMoves, torres: currTorres }
  }

  mutate (moves) {
    const idx = Math.floor(Math.random() * moves.length) // select random move to mutate
    const currTorres = cloneTorres(this.myInfo.torres)
    for (let i = 0; i < idx; i++) {
      currTorres.executeMove(moves[i])
    }
    let newMove = currTorres.getRandomLegalMoveBiased()
    moves[idx] = newMove
    for (let i = idx; i < moves.length; i++) {
      if (!makeMove(currTorres, moves[i], currTorres.activePlayer)) {
        newMove = currTorres.getRandomLegalMoveBiased()
        currTorres.executeMove(newMove)
        moves[i] = newMove
      }
      if (i < moves.length - 1 && moves[i].action === 'turn_end') {
        moves = moves.slice(0, i + 1)
        break
      }
    }
    if (idx === moves.length - 1 && moves[idx].action !== 'turn_end') { // last element mutated
      moves.push({ action: 'turn_end' })
      currTorres.executeMove({ action: 'turn_end' })
    }
    return { moves, torres: currTorres }
  }
}

class Genome {
  constructor (moves) {
    this.moves = moves
    this.age = -1
    this.fitness = null
  }

  calcFitness (torres, playerId, rollout) {
    if (this.age === -1) {
      if (rollout) {
        let move
        while (torres.activePlayer !== playerId && torres.gameRunning) {
          move = torres.getDeterministicLegalMove()
          torres.executeMove(move)
        }
      }
      this.fitness = torres.getRewardPerPlayer(true)[playerId]
    }
    this.age++
  }
}

// TODO: use another way to check?
function makeMove (torres, move, playerId) {
  let legal
  switch (move.action) {
    case 'block_place':
      legal = torres.placeBlock(playerId, move.x, move.y)
      break
    case 'knight_place':
      legal = torres.placeKnight(playerId, move.x, move.y)
      break
    case 'knight_move':
      legal = torres.moveKnight(playerId, move.x, move.y, move.destX, move.destY)
      break
    case 'king_place':
      legal = torres.placeKing(playerId, move.x, move.y)
      break
    case 'turn_end':
      legal = torres.endTurn(playerId)
      break
    default:
      break
  }
  return legal
}

export { OepClient }
