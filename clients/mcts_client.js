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
    mcts(torres)
  }
  send('move', bestTurn.shift())
}

function mcts (torres, c = 20, stopAtPhase = false, timeLimit = 20000) {
  const t0 = performance.now()
  const rootNode = new Node(torres, null, null, 0)
  const startingPhase = rootNode.torres.phase
  let currentNode
  while (performance.now() - t0 < timeLimit && rootNode.getChildren().length > 1) { // limited time per move & break if only one move possible
    currentNode = rootNode
    rootNode.visits++
    // simulate game
    while (currentNode.getChildren().length !== 0) {
      if (stopAtPhase && currentNode.torres.phase > 1 && currentNode.torres.phase !== startingPhase) {
        break
      }
      currentNode = currentNode.selectChild(c)
      currentNode.visits++
    }
    const rewardPP = currentNode.getRewardPerPlayer()
    // backtrack and update reward statistics
    while (currentNode) {
      for (let i = 0; i < rewardPP.length; i++) {
        currentNode.rewardPerPlayer[i] += rewardPP[i]
      }
      currentNode = currentNode.parent
    }
  }

  // best moves until 'turn_end'
  currentNode = rootNode
  while (currentNode.getChildren().length !== 0) {
    currentNode = currentNode.bestChild()
    bestTurn.push(currentNode.move)
    if (currentNode.move.action === 'turn_end') {
      break
    }
  }
  console.log('runs: ' + rootNode.visits)
  // console.log(rootNode.rewardPerPlayer)
  // console.log(rootNode.getChildren().map(c => c.visits))
}

class Node {
  constructor (torres, parent, move, depth) {
    this.torres = torres
    this.parent = parent
    this.move = move
    this.rewardPerPlayer = new Array(torres.numPlayers).fill(0)
    this.visits = 0
    this.children = null
    this.depth = depth
  }

  getUCB1 (playerId, c) { // TODO: custom ucb dependend on game knowledge
    if (this.visits === 0) { // first expand unvisited node
      return Number.POSITIVE_INFINITY
    }
    // exploration vs. exploitation
    const estimatedReward = this.rewardPerPlayer[playerId] / this.visits // score per visit
    const explorationBonus = Math.sqrt(2 * Math.log(this.parent.visits) / this.visits)
    return estimatedReward + c * explorationBonus
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

  getRewardPerPlayer () { //  = difference to best player
    const ppp = this.torres.getPointsPerPlayer()
    const sortedP = [...ppp].sort()
    const rpp = ppp.map(points => points === sortedP[sortedP.length - 1] ? points - sortedP[sortedP.length - 2] : points - sortedP[sortedP.length - 1])
    return rpp
  }

  selectChild (c) {
    const activePlayer = this.torres.activePlayer // TODO: correct?
    return this.getChildren().reduce((prev, node) => node.getUCB1(activePlayer, c) > prev.getUCB1(activePlayer, c) ? node : prev)
  }

  bestChild () {
    const activePlayer = this.torres.activePlayer
    return this.getChildren().reduce((prev, node) => (node.rewardPerPlayer[activePlayer] / node.visits > prev.rewardPerPlayer[activePlayer] / prev.visits) ? node : prev)
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
/*
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
*/
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
