import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'
import Torres from '../../game-logic/src/torres.js'

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new EventEmitter()

const myInfo = {
  type: 'mcts',
  playerInfo: null,
  torres: null
}

function myMove () {
  const bestMove = mcts(cloneTorres(myInfo.torres))
  send('move', bestMove)
}

function mcts (torres, c = 10, d = 1, epsilon = 0.5, timeLimit = 1000) {
  const t0 = performance.now()
  const firstMoves = torres.getLegalMovesBiased(torres.activePlayer)
  const rootNode = new Node(torres, null, null, null, firstMoves, 0)
  let currentNode, currentTorres, rewardPerPlayer
  while (true) {
    currentNode = treePolicy(rootNode, c, d)
    if (rootNode.untriedMoves.length === 0 && rootNode.children.length === 1) { // only one possible move
      break
    }
    currentTorres = cloneTorres(currentNode.torres)
    rewardPerPlayer = defaultPolicy(currentTorres, false, epsilon)
    backup(currentNode, rewardPerPlayer)
    if (performance.now() - t0 > timeLimit) {
      break
    }
  }
  console.log('runs: ' + rootNode.visits)
  return rootNode.bestChild().move
}

/*
function nonexMcts (torres, timeLimit = 1000) {
  const t0 = performance.now()
  const firstMoves = torres.getLegalMovesOrdered(torres.activePlayer).reverse()
  const rootNode = new Node(torres, null, null, firstMoves, 0)
  let currentNode, currentTorres, rewardPerPlayer
  while (performance.now() - t0 < timeLimit) {
    currentNode = treePolicy(rootNode, 0, 1)
    if (rootNode.untriedMoves.length === 0 && rootNode.children.length === 1) { // only one possible move
      break
    }
    currentTorres = cloneTorres(currentNode.torres)
    rewardPerPlayer = defaultPolicy(currentTorres, true) // deterministic
    backup(currentNode, rewardPerPlayer)
  }
  fillBestTurn(rootNode)
  console.log('runs: ' + rootNode.visits)
}

function bbMcts (torres, c = 10, d = 1, timeLimit = 1000) {
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
    currentNode = treePolicy(rootNode, c, d)
    currentTorres = cloneTorres(currentNode.torres)
    rewardPerPlayer = defaultPolicy(currentTorres, false, 0.5) // epsilon-greedy with epsilon = 0.5
    backup(currentNode, rewardPerPlayer)
  }
}
*/

function cloneTorres (torres) {
  return Torres.assignInstances(JSON.parse(JSON.stringify(torres)))
}

function treePolicy (rootNode, c, d) {
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
  const startingPhase = torres.phase
  let move
  while (torres.gameRunning && startingPhase === torres.phase) {
    if (deterministic || Math.random() > epsilon) {
      move = torres.getDeterministicLegalMove() // follow simple greedy heuristic (based on getLegalMovesOrdered)
    } else {
      move = torres.getRandomLegalMoveBiased()
    }
    torres.executeMove(move)
  }
  return torres.getRewardPerPlayer(true)
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

class Node {
  constructor (torres, parent, move, bias, untriedMoves, depth) {
    this.torres = torres
    this.parent = parent
    this.move = move // previous move (that led to this state)
    this.untriedMoves = untriedMoves // legal moves for which no child exists
    this.rewardPerPlayer = new Array(torres.numPlayers).fill(0)
    this.visits = 0
    this.children = []
    this.bias = bias
    this.depth = depth
  }

  expand () {
    const nextMoveBias = this.untriedMoves.pop()
    const torres = cloneTorres(this.torres)
    torres.executeMove(nextMoveBias.move)
    const newMoves = torres.getLegalMovesBiased(torres.activePlayer)
    const child = new Node(torres, this, nextMoveBias.move, nextMoveBias.bias, newMoves, this.depth + 1)
    this.children.push(child)
    return child
  }

  getUCB1 (playerId, c, d) {
    const estimatedReward = this.rewardPerPlayer[playerId] / this.visits // score per visit
    const explorationBonus = Math.sqrt(2 * Math.log(this.parent.visits) / this.visits)
    return estimatedReward + c * explorationBonus + d * (this.bias / (this.visits + 1))
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
  // bestTurn = []
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