const WebSocket = require('ws')
const events = require('events')
const { performance } = require('perf_hooks')
const Torres = require('../public/javascripts/torres')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = { id: null, ai: 'oep' }

const bestTurn = []

async function myMove () {
  if (bestTurn.length === 0) {
    const torres = await new Promise(resolve => {
      send('status_request', ['game_state'])
      messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
    })
    oep(torres, 100, 10000)
  }
  if (bestTurn.length > 0) {
    send('move', bestTurn.shift())
  }
}

function oep (torres, popSize = 100, timeLimit = 20000) {
  const t0 = performance.now()
  let population = []
  init(population, popSize, torres)
  while (true) {
    for (const g of population) {
      g.calcFitness(torres)
    }
    population.sort((g1, g2) => g2.fitness - g1.fitness)
    if (performance.now() - t0 > timeLimit) {
      break
    }
    population = population.slice(0, Math.ceil(population.length / 2))
    population = procreate(population, torres)
  }
  bestTurn.push(...population[0].moves)
}

function init (pop, popSize, torres) { // TODO: 20% greedy, rest completly random
  for (let i = 0; i < popSize; i++) {
    const clonedT = cloneTorres(torres)
    const g = new Genome(randomTurn(clonedT))
    pop.push(g)
  }
}

function randomTurn (torres) {
  const turn = []
  let move = null
  while (!move || move.action !== 'turn_end') {
    move = torres.getRandomLegalMove(1)
    makeMove(torres, move, torres.activePlayer)
    turn.push(move)
  }
  return turn
}

function procreate (pop, torres, pm = 0.1) {
  pop.sort(() => 0.5 - Math.random()) // shuffle pop
  const newPop = []
  while (pop.length > 1) { // TODO: always even number in pop?
    const parent1 = pop.pop()
    const parent2 = pop.pop()

    for (let numC = 0; numC < 2; numC++) { // two children
      // uniform crossover
      let childMoves = uniformCrossover(parent1, parent2, torres)

      // mutation with probability pm (default: 0.1)
      if (Math.random() < pm) {
        childMoves = mutate(childMoves, torres)
      }
      newPop.push(new Genome(childMoves)) // TODO: init with currentTorres?
    }
    newPop.push(parent1, parent2)
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
        move = currTorres.getRandomLegalMove(1) // TODO: first try i++
        makeMove(currTorres, move, currTorres.activePlayer)
      }
    }
    childMoves.push(move)
    i++
  }
  return childMoves
}

function mutate (moves, torres) {
  const idx = Math.floor(Math.random() * moves.length) // select random move to mutate
  const currTorres = cloneTorres(torres)
  for (let i = 0; i < idx; i++) {
    makeMove(currTorres, moves[i], currTorres.activePlayer)
  }
  let newMove = currTorres.getRandomLegalMove(1)
  moves[idx] = newMove
  for (let i = idx; i < moves.length; i++) {
    if (!makeMove(currTorres, moves[i], currTorres.activePlayer)) {
      newMove = currTorres.getRandomLegalMove(1)
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
  }
  return moves
}

class Genome {
  constructor (moves) {
    this.moves = moves
    this.visits = 0
    this.fitness = null
  }

  calcFitness (torres) {
    if (this.visits === 0) {
      const clonedT = cloneTorres(torres)
      for (const move of this.moves) {
        makeMove(clonedT, move, clonedT.activePlayer)
      }
      this.fitness = clonedT.getRewardPerPlayer(true)[myInfo.id]
    }
    this.visits++
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
