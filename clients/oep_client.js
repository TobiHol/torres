const WebSocket = require('ws')
const events = require('events')
const { performance } = require('perf_hooks')
const Torres = require('../public/javascripts/torres')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = { id: null, ai: 'oep' }

let bestTurn = []

async function myMove () {
  if (bestTurn.length === 0) {
    const torres = await new Promise(resolve => {
      send('status_request', ['game_state'])
      messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
    })
    oep(torres)
  }
  if (bestTurn.length > 0) {
    send('move', bestTurn.shift())
  }
}

function oep (torres, popSize = 100, timeLimit = 10000) {
  const t0 = performance.now()
  let runs = 0
  let population = []
  init(population, popSize, torres)
  while (true) {
    runs++
    for (const g of population) { // TODO: delete?
      g.calcFitness() // only adds to age
    }
    population.sort((g1, g2) => g2.fitness - g1.fitness)
    if (performance.now() - t0 > timeLimit) {
      break
    }
    // TODO: kill genomes with same moves -> replace with new random genome?
    const l = population.length
    let i = 0
    population = population.filter(g => {
      if (g.moves.length === 1) { // only 'turn_end'
        if (i === 0) {
          i++
          return true
        }
        return false
      }
      return true
    })
    population = population.slice(0, Math.ceil(l / 2)) // kill the worse half of the population (kill rate )
    population = procreate(population, torres)
  }
  bestTurn.push(...population[0].moves)
  console.log('runs: ' + runs)
}

function init (pop, popSize, torres) {
  for (let i = 0; i < popSize; i++) {
    const clonedT = cloneTorres(torres)
    const g = new Genome(randomTurn(clonedT, i < (popSize / 5))) // 20% greedy, rest completly random
    g.calcFitness(clonedT)
    pop.push(g)
  }
}

function randomTurn (torres, biased) {
  const turn = []
  let move = null
  while (!move || move.action !== 'turn_end') {
    move = biased ? torres.getRandomLegalMoveBiased(1) : torres.getRandomLegalMove()
    makeMove(torres, move, torres.activePlayer)
    turn.push(move)
  }
  return turn
}

function procreate (pop, torres, pm = 0.1) {
  pop.sort(() => 0.5 - Math.random()) // shuffle pop
  const newPop = []
  while (pop.length > 1) {
    const parent1 = pop.pop()
    const parent2 = pop.pop()
    newPop.push(parent1, parent2)

    for (let numC = 0; numC < 2; numC++) { // two children
      // uniform crossover
      let child = uniformCrossover(parent1, parent2, torres)

      // mutation with probability pm (default: 0.1)
      if (Math.random() < pm) {
        child = mutate(child.moves, torres)
      }
      const g = new Genome(child.moves)
      g.calcFitness(child.torres)
      newPop.push(g)
    }
  }
  return newPop
}

// TODO: refactor
function uniformCrossover (parent1, parent2, torres) {
  const childMoves = []
  const currTorres = cloneTorres(torres)
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
        move = currTorres.getRandomLegalMoveBiased(1) // TODO: first try i++
        makeMove(currTorres, move, currTorres.activePlayer)
      }
    }
    childMoves.push(move)
    i++
  }
  return { moves: childMoves, torres: currTorres }
}

function mutate (moves, torres) {
  const idx = Math.floor(Math.random() * moves.length) // select random move to mutate
  const currTorres = cloneTorres(torres)
  for (let i = 0; i < idx; i++) {
    makeMove(currTorres, moves[i], currTorres.activePlayer)
  }
  let newMove = currTorres.getRandomLegalMoveBiased(1)
  moves[idx] = newMove
  for (let i = idx; i < moves.length; i++) {
    if (!makeMove(currTorres, moves[i], currTorres.activePlayer)) {
      newMove = currTorres.getRandomLegalMoveBiased(1)
      makeMove(currTorres, newMove, currTorres.activePlayer)
      moves[i] = newMove
    }
    if (i < moves.length - 1 && moves[i].action === 'turn_end') {
      moves = moves.slice(0, i + 1)
      break
    }
  }
  if (idx === moves.length - 1 && moves[idx].action !== 'turn_end') { // last element mutated
    moves.push({ action: 'turn_end' })
    makeMove(currTorres, { action: 'turn_end' }, currTorres.activePlayer)
  }
  return { moves, torres: currTorres }
}

class Genome {
  constructor (moves) {
    this.moves = moves
    this.age = -1
    this.fitness = null
  }

  calcFitness (torres) {
    if (this.age === -1) {
      this.fitness = torres.getRewardPerPlayer(true)[myInfo.id]
    }
    this.age++
  }
}

function cloneTorres (torres) {
  return Torres.assignInstances(JSON.parse(JSON.stringify(torres)))
}

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
    case 'turn_end':
      legal = torres.endTurn(playerId)
      break
    default:
      break
  }
  return legal
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
  send('info', myInfo.ai)
  bestTurn = []
  if (data.your_player_id === 0) {
    myMove()
  }
})

messageParser.on('game_end', (data) => {
  console.log('game ended')
})

messageParser.on('move_update', (data) => {
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
