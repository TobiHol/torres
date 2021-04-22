const WebSocket = require('ws')
const events = require('events')
const { performance } = require('perf_hooks')
const Torres = require('../public/javascripts/torres')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = { id: null, ai: 'mcts' }

let bestTurn = []

async function myMove () {
  if (bestTurn.length === 0) {
    const torres = await new Promise(resolve => {
      send('status_request', ['game_state'])
      messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
    })
    if (myInfo.id <= 1) {
      mcts(torres)
    } else if (myInfo.id === 2) {
      nonexMcts(torres)
    } else if (myInfo.id === 3) {
      bbMcts(torres)
    }
  }
  send('move', bestTurn.shift())
}

function mcts (torres, c = 10, timeLimit = 10000) {
  const t0 = performance.now()
  const firstMoves = torres.getLegalMovesOrdered(torres.activePlayer).reverse()
  const rootNode = new Node(torres, null, null, firstMoves, 0)
  let currentNode, currentTorres, rewardPerPlayer
  while (performance.now() - t0 < timeLimit) { // limited time per move
    currentNode = treePolicy(rootNode, c)
    if (rootNode.untriedMoves.length === 0 && rootNode.children.length <= 1) { // only one possible move
      break
    }
    currentTorres = cloneTorres(currentNode.torres)
    rewardPerPlayer = defaultPolicy(currentTorres, false, 0.5) // epsilon-greedy with epsilon = 0.5
    backup(currentNode, rewardPerPlayer)
  }
  fillBestTurn(rootNode)
  console.log('runs: ' + rootNode.visits)
}

function nonexMcts (torres, timeLimit = 10000) {
  const t0 = performance.now()
  const firstMoves = torres.getLegalMovesOrdered(torres.activePlayer).reverse()
  const rootNode = new Node(torres, null, null, firstMoves, 0)
  let currentNode, currentTorres, rewardPerPlayer
  while (performance.now() - t0 < timeLimit) {
    currentNode = treePolicy(rootNode, 0, 0.5)
    currentTorres = cloneTorres(currentNode.torres)
    rewardPerPlayer = defaultPolicy(currentTorres, true) // deterministic
    backup(currentNode, rewardPerPlayer)
  }
  fillBestTurn(rootNode)
  console.log('runs: ' + rootNode.visits)
}

function bbMcts (torres, timeLimit = 10000) {
  const t0 = performance.now()
  let t1 = t0
  const firstMoves = torres.getLegalMovesOrdered(torres.activePlayer).reverse()
  let rootNode = new Node(torres, null, null, firstMoves, 0)
  let currentNode, currentTorres, rewardPerPlayer
  while (performance.now() - t0 < timeLimit) {
    if (performance.now() - t1 > timeLimit / 4) {
      t1 = performance.now()
      // make best child new root, i.e., aggressively prune siblings
      rootNode = rootNode.bestChild()
      rootNode.parent = null
      bestTurn.push(rootNode.move)
      if (rootNode.move.action === 'turn_end') {
        break
      }
      rootNode.move = null
    }
    currentNode = treePolicy(rootNode, 10)
    currentTorres = cloneTorres(currentNode.torres)
    rewardPerPlayer = defaultPolicy(currentTorres, false, 0.5) // epsilon-greedy with epsilon = 0.5
    backup(currentNode, rewardPerPlayer)
  }
  fillBestTurn(rootNode)
  console.log('runs: ' + rootNode.visits)
}

function cloneTorres (torres) {
  return Torres.assignInstances(JSON.parse(JSON.stringify(torres)))
}

function treePolicy (rootNode, c, d = 1) {
  let node = rootNode
  while (node.torres.gameRunning) { // non-terminal
    if (node.untriedMoves.length !== 0) { // not fully expanded
      return node.expand()
    } else {
      node = node.selectChild(c, d)
    }
  }
  return node
}

function defaultPolicy (torres, deterministic, epsilon) {
  let move
  while (torres.gameRunning) {
    if (deterministic || Math.random() > epsilon) {
      move = torres.getDeterministicLegalMove() // follow simple greedy heuristic (based on getLegalMovesOrdered)
    } else {
      move = torres.getRandomLegalMoveBiased()
    }
    makeMove(torres, move, torres.activePlayer)
  }
  return torres.getRewardPerPlayer()
}

function backup (node, rewardPP) {
  while (node) {
    node.visits++
    for (let i = 0; i < rewardPP.length; i++) {
      node.rewardPerPlayer[i] += rewardPP[i]
    }
    node = node.parent
  }
}

function fillBestTurn (rootNode) {
  // best moves until 'turn_end'
  let node = rootNode
  while (bestTurn.length === 0 || bestTurn[bestTurn.length - 1].action !== 'turn_end') {
    if (node.children.length === 0) {
      bestTurn.push({ action: 'turn_end' })
    } else {
      node = node.bestChild()
      bestTurn.push(node.move)
    }
  }
}

class Node {
  constructor (torres, parent, move, untriedMoves, depth) {
    this.torres = torres
    this.parent = parent
    this.move = move // previous move (that led to this state)
    this.untriedMoves = untriedMoves // legal moves for which no child exists
    this.rewardPerPlayer = new Array(torres.numPlayers).fill(0)
    this.visits = 0
    this.children = []
    this.depth = depth
  }

  expand () {
    const nextMove = this.untriedMoves.pop()
    const torres = cloneTorres(this.torres)
    makeMove(torres, nextMove, torres.activePlayer)
    const newMoves = torres.getLegalMovesOrdered(torres.activePlayer).reverse()
    const child = new Node(torres, this, nextMove, newMoves, this.depth + 1)
    this.children.push(child)
    return child
  }

  getUCB1 (playerId, c, d) {
    let bias = 0
    if (d > 0) {
      bias = calculateBias(this.parent.torres, this.move) / this.visits // influence of bias decreases with number of visits
    }
    const estimatedReward = this.rewardPerPlayer[playerId] / this.visits // score per visit
    const explorationBonus = Math.sqrt(2 * Math.log(this.parent.visits) / this.visits)
    return estimatedReward + c * explorationBonus + d * bias
  }

  selectChild (c, d) {
    const activePlayer = this.torres.activePlayer
    return this.children.reduce((prev, node) =>
      node.getUCB1(activePlayer, c, d) > prev.getUCB1(activePlayer, c, d)
        ? node
        : prev)
  }

  bestChild () {
    return this.children.reduce((prev, node) =>
      node.visits > prev.visits
        ? node
        : prev)
  }
}

function calculateBias (torres, move) {
  let bias = 0
  if (move.action === 'knight_move') {
    if (torres.isMovingUp(move.x, move.y, move.destX, move.destY)) {
      bias = 100 // TODO: adjust
    }
  } else if (move.action === 'block_place') {
    if (torres.hasKnightAsNeighbor(move.x, move.y)) {
      bias = 20 // TODO: adjust
    }
  } else if (move.action === 'turn_end') {
    bias = -100 // TODO: adjust
  }
  return bias
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
