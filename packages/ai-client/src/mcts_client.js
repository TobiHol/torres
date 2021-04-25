import { performance } from 'perf_hooks'

import { AiClient, cloneTorres } from './ai_client.js'
import { TIME_LIMIT } from './constants.js'

class MctsClient extends AiClient {
  constructor ({ version = 'STANDARD', c = 10, d = 1, epsilon = 0.5 }) {
    super()
    this.VERSION = version
    this.myInfo.type = 'mcts_ai'

    this.C = c
    this.D = d
    this.epsilon = epsilon
  }

  myMove () {
    this.t0 = performance.now()
    const torres = cloneTorres(this.myInfo.torres)
    const bestMove = this.mcts(torres)
    if (bestMove) {
      this.send('move', bestMove)
    } else {
      throw new Error('no move was found')
    }
  }

  mcts (torres) {
    const firstMoves = torres.getLegalMovesBiased(torres.activePlayer)
    const rootNode = new Node(torres, null, null, null, firstMoves, 0)
    let currentNode, currentTorres, rewardPerPlayer
    while (true) {
      currentNode = this.treePolicy(rootNode)
      if (rootNode.untriedMoves.length === 0 && rootNode.children.length === 1) { // only one possible move
        break
      }
      currentTorres = cloneTorres(currentNode.torres)
      rewardPerPlayer = this.defaultPolicy(currentTorres, false)
      this.backup(currentNode, rewardPerPlayer)
      if (performance.now() - this.t0 > TIME_LIMIT) {
        break
      }
    }
    console.log('runs: ' + rootNode.visits)
    return rootNode.bestChild().move
  }

  treePolicy (rootNode) {
    let node = rootNode
    while (node.torres.gameRunning) { // non-terminal
      if (node.untriedMoves.length !== 0) { // not fully expanded
        return node.expand()
      } else {
        node = node.selectChild(this.C, this.D)
      }
    }
    return node
  }

  defaultPolicy (torres, deterministic) {
    const startingPhase = torres.phase
    let move
    while (torres.gameRunning && startingPhase === torres.phase) {
      if (deterministic || Math.random() > this.epsilon) {
        move = torres.getDeterministicLegalMove() // follow simple greedy heuristic (based on getLegalMovesOrdered)
      } else {
        move = torres.getRandomLegalMoveBiased()
      }
      torres.executeMove(move)
    }
    return torres.getRewardPerPlayer(true)
  }

  backup (node, rewardPP) {
    while (node) {
      node.visits++
      for (let i = 0; i < rewardPP.length; i++) {
        node.rewardPerPlayer[i] += rewardPP[i]
      }
      node = node.parent
    }
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

export { MctsClient }
