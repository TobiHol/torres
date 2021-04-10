const Board = require('./board')
const Player = require('./player')

class Torres {
  constructor (numPlayers = 2, numRounds = 10, blocksPerRound = 3, apPerRound = 5, numKnights = 5) {
    this.numRounds = numRounds

    this.numPlayers = numPlayers
    this.Players = [...Array(numPlayers).keys()].map(id => new Player(id, numKnights, apPerRound, blocksPerRound))
    this.activePlayer = 0

    this.board = new Board()
    // initialize game (TODO: by players?)
    this.board.initCastles()
    this.board.initKnights()
  }

  placeBlock (playerId, x, y) {
    if (this.activePlayer !== playerId) return false

    // check wether player is unable to do action
    const player = this.Players[playerId]
    if (this.numBlocks < 1 || this.ap < 1) return false

    // check wether placement is illegal
    const square = this.board.getSquare(x, y)
    if (!square) return false
    if (square.knight !== -1) return false // square not free
    let castleId = -1
    if (square.height === 0) {
      for (const n of this.board.getNeighbors(x, y)) {
        if (n.castle !== -1) {
          if (castleId !== -1 && castleId !== n.castle) return false // block would connect two castles
          castleId = n.castle
        }
      }
      if (castleId === -1) return false // block would create new castle
    } else {
      castleId = square.castle
      if (this.board.castleSizes[castleId] < square.height + 1) return false // castle would be higher than base
    }

    // execute action
    player.placeBlock()
    this.board.placeBlock(square, castleId)
    return true
  }

  placeKnight (playerId, x, y) {
    if (this.activePlayer !== playerId) return false

    // check wether player is unable to do action
    const player = this.Players[playerId]
    if (player.numKnights < 1 || player.ap < 2) return false

    // check wether placement is illegal
    const square = this.board.getSquare(x, y)
    if (!square) return false
    if (square.knight !== -1) return false // square not free
    let neighborHeight = -1
    for (const n of this.board.getNeighbors(x, y)) {
      if (n.knight === playerId && n.height > neighborHeight) {
        neighborHeight = n.height
      }
    }
    if (neighborHeight === -1) return false // no knight of player as neighbor
    if (neighborHeight < square.height) return false // knight can not be placed higher

    // execute action
    player.placeKnight()
    this.board.placeKnight(square, playerId)

    return true
  }

  moveKnight (playerId, x, y, destX, destY) {
    if (this.activePlayer !== playerId) return false

    // check wether player is unable to do action
    const player = this.Players[playerId]
    if (player.numKnights < 1 || player.ap < 2) return false

    // check wether movement is illegal
    const startSquare = this.board.getSquare(x, y)
    const destSquare = this.board.getSquare(destX, destY)
    if (!startSquare || !destSquare) return false
    if (startSquare.knight !== playerId || destSquare.knight !== -1) return false // not correct knight or source not free
    if (destSquare.height - startSquare.height > 1) return false // only move at most one up
    if ((Math.abs(x - destX) !== 1 || y !== destY) && (Math.abs(y - destY) !== 1 || x !== destX)) { // only move one
      // movement through castles
      if (destSquare.height > startSquare.height) return false // cannot move up through castle
      const startNeighborIds = []
      for (const n of this.board.getNeighbors(x, y)) {
        if (n.castle !== -1 && n.height > startSquare.height) startNeighborIds.push(n.castle)
      }
      const destNeighborIds = []
      for (const n of this.board.getNeighbors(destX, destY)) {
        if (n.castle !== -1 && n.height > destSquare.height) destNeighborIds.push(n.castle)
      }
      if (!startNeighborIds.some(id => destNeighborIds.includes(id))) return false // not same castle as entrance and destination available
    }

    // execute action
    player.moveKnight()
    this.board.moveKnight(startSquare, destSquare, playerId)

    return true
  }

  endTurn (playerId) {
    if (this.activePlayer !== playerId) return false
    this.activePlayer = (this.activePlayer + 1) % this.numPlayers
    if (this.activePlayer === 0) this.numRounds-- // end of round
    const player = this.Players[playerId]
    player.endTurn()
    return true
  }

  ascii () {
    let str = this.board.ascii() + '\n\n'
    str += 'Players \n'
    for (const p of this.Players) {
      str += p.ascii()
    }
    return str
  }

  html () {
    let str = this.board.html() + '<br/><br/>'
    str += 'Players <br/>'
    for (const p of this.Players) {
      str += p.html()
    }
    return str
  }
}

module.exports = Torres
