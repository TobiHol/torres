const WebSocket = require('ws')
const events = require('events')
const { performance } = require('perf_hooks')
const Torres = require('../public/javascripts/torres')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = { id: null }

const bestTurn = []

async function myMove () {
  if (bestTurn.length === 0) {
    const torres = await new Promise(resolve => {
      send('status_request', ['game_state'])
      messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
    })
    mcts(torres, torres.activePlayer)
  }
  send('move', bestTurn.shift())
}

function mcts (torres, playerId, timeLimit = 20000) {
  const t0 = performance.now()
  const rootNode = new Node(torres, null, null, 0)
  let currentNode
  while (performance.now() - t0 < timeLimit && rootNode.getChildren().length > 1) { // limited time per move & break if only one move possible
    currentNode = rootNode
    rootNode.visits++
    // simulate game
    while (currentNode.getChildren().length !== 0) {
      currentNode = currentNode.selectChild(playerId)
      currentNode.visits++
    }
    // const winner = currentNode.getWinner()
    const reward = currentNode.getReward(playerId)
    // backtrack and update winner statistics
    while (currentNode) {
      currentNode.reward += reward
      currentNode = currentNode.parent
    }
  }

  // best moves until 'turn_end'
  currentNode = rootNode
  while (true) {
    // console.log(currentNode)
    currentNode = currentNode.bestChild()
    bestTurn.push(currentNode.move)
    if (currentNode.move.action === 'turn_end') {
      break
    }
  }
}

class Node {
  constructor (torres, parent, move, depth) {
    this.torres = torres
    this.parent = parent
    this.move = move
    this.reward = 0 // always from point of view of playerId!
    this.visits = 0
    this.children = null
    this.depth = depth
  }

  getUCB1 (playerId) { // TODO: custom ucb dependend on game knowledge
    if (this.visits === 0) { // first expand unvisited node
      return Number.POSITIVE_INFINITY
    }
    const C = 5 // exploration vs. exploitation
    const estimatedReward = this.reward / this.visits // score per visit
    const explorationBonus = Math.sqrt(2 * Math.log(this.parent.visits) / this.visits)
    if (this.torres.activePlayer === playerId) {
      return estimatedReward + C * explorationBonus
    } else {
      return estimatedReward - C * explorationBonus
    }
  }

  getChildren () {
    if (this.children === null) { // node has to be expanded
      if (this.move !== null) {
        makeMove(this.torres, this.move, this.torres.activePlayer)
      }
      const moves = this.torres.getLegalMovesOrdered(this.torres.activePlayer)
      // TODO: only add one new node per simulation ? -> space complexity
      this.children = moves.map(move =>
        new Node(Torres.assignInstances(JSON.parse(JSON.stringify(this.torres))), this, move, this.depth + 1))
    }
    return this.children
  }

  // currently not used
  getWinner () { // TODO: in Torres as getWinner()
    const ppp = this.torres.getPointsPerPlayer()
    return ppp.reduce((iMax, points, i, arr) => points > arr[iMax] ? i : iMax, 0)
  }

  getReward (playerId) {
    const ppp = this.torres.getPointsPerPlayer()
    return ppp.reduce((score, points, i) => i === playerId ? score + points : score - points, 0)
  }

  selectChild (playerId) {
    if (playerId === this.torres.activePlayer) {
      return this.getChildren().reduce((prev, node) => node.getUCB1(playerId) > prev.getUCB1(playerId) ? node : prev) // argmax
    } else {
      return this.getChildren().reduce((prev, node) => node.getUCB1(playerId) < prev.getUCB1(playerId) ? node : prev) // argmin
    }
  }

  bestChild () {
    return this.getChildren().reduce((prev, node) => (node.visits > prev.visits) ? node : prev)
  }
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

function shuffleArray (array) {
  let curId = array.length
  while (curId !== 0) {
    const randId = Math.floor(Math.random() * curId)
    curId--
    const tmp = array[curId]
    array[curId] = array[randId]
    array[randId] = tmp
  }
  return array
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
