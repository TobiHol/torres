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
    mcts(torres, 10000)
  }
  send('move', bestTurn.shift())
}

function mcts (torres, c = 10, timeLimit = 20000) {
  const t0 = performance.now()
  const firstMoves = torres.getLegalMovesOrdered(torres.activePlayer).reverse()
  const rootNode = new Node(torres, null, null, firstMoves, 0)
  // const startingPhase = rootNode.torres.phase
  let currentNode, currentTorres, rewardPerPlayer
  while (performance.now() - t0 < timeLimit) { // limited time per move & break if only one move possible
    currentNode = treePolicy(rootNode, c)
    if (rootNode.untriedMoves.length === 0 && rootNode.children.length <= 1) { // only one possible move
      break
    }
    currentTorres = cloneTorres(currentNode.torres)
    rewardPerPlayer = defaultPolicy(currentTorres)
    backup(currentNode, rewardPerPlayer)
  }
  fillBestTurn(rootNode)
  console.log('runs: ' + rootNode.visits)
}

function cloneTorres (torres) {
  return Torres.assignInstances(JSON.parse(JSON.stringify(torres)))
}

function treePolicy (rootNode, c) {
  let node = rootNode
  while (node.torres.gameRunning) { // non-terminal
    if (node.untriedMoves.length !== 0) { // not fully expanded
      return node.expand()
    } else {
      node = node.selectChild(c)
    }
  }
  return node
}

function defaultPolicy (torres) {
  let move
  while (torres.gameRunning) {
    move = torres.getRandomLegalMove()
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
  // best moves until 'turn_end' or too much uncertainty
  let node = rootNode
  while (true) {
    node = node.bestChild()
    bestTurn.push(node.move)
    if (node.visits < 200 || node.move.action === 'turn_end') {
      break
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

  getUCB1 (playerId, c) {
    const bias = calculateBias(this.parent.torres, this.move) / this.visits // influence of bias decreases with number of visits
    const estimatedReward = this.rewardPerPlayer[playerId] / this.visits // score per visit
    const explorationBonus = Math.sqrt(2 * Math.log(this.parent.visits) / this.visits)
    return estimatedReward + c * explorationBonus + bias
  }

  selectChild (c) {
    const activePlayer = this.torres.activePlayer
    return this.children.reduce((prev, node) =>
      node.getUCB1(activePlayer, c) > prev.getUCB1(activePlayer, c)
        ? node
        : prev)
  }

  bestChild () {
    // const activePlayer = this.torres.activePlayer
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
      bias = 10 // TODO: adjust
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
