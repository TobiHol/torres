const Board = require('./board')
const Player = require('./player')

class Torres {
  constructor (numPlayers = 2, numRounds = 10, blocksPerRound = 3, apPerRound = 5, numKnights = 5) {
    this.numRounds = numRounds
    this.numPlayers = numPlayers
    this.numKnights = numKnights
    this.apPerRound = apPerRound
    this.blocksPerRound = blocksPerRound

    this.resetGame()
  }

  resetGame () {
    this.Players = [...Array(this.numPlayers).keys()].map(id => new Player(id, this.numKnights, this.apPerRound, this.blocksPerRound))
    this.activePlayer = 0
    this.board = new Board()
    this.initialized = false

    return true
  }

  initGame () {
    if (this.initialized) return false

    this.board.initCastles()
    this.board.initKnights(this.Players)
    this.initialized = true

    return true
  }

  placeBlock (playerId, x, y) {
    if (this.activePlayer !== playerId) return false
    const player = this.Players[playerId]

    // check wether action is illegal
    const placement = this.board.canPlaceBlock(x, y)
    if (!placement || !player.canPlaceBlock()) return false

    // execute action
    player.placeBlock()
    this.board.placeBlock(placement.square, placement.castleId)
    return true
  }

  placeKnight (playerId, x, y) {
    if (this.activePlayer !== playerId) return false
    const player = this.Players[playerId]

    // check wether action is illegal
    const placement = this.board.canPlaceKnight(x, y, playerId)
    if (!placement || !player.canPlaceKnight()) return false

    // execute action
    player.placeKnight()
    this.board.placeKnight(placement.square, playerId)

    return true
  }

  moveKnight (playerId, x, y, destX, destY) {
    if (this.activePlayer !== playerId) return false
    const player = this.Players[playerId]

    // check wether action is illegal
    const movement = this.board.canMoveKnight(x, y, destX, destY, playerId)
    if (!movement || !player.canMoveKnight()) return false

    // execute action
    player.moveKnight()
    this.board.moveKnight(movement.startSquare, movement.destSquare, playerId)

    return true
  }

  endTurn (playerId) {
    if (this.activePlayer !== playerId) return false

    this.activePlayer = (this.activePlayer + 1) % this.numPlayers
    if (this.activePlayer === 0) this.numRounds-- // end of round
    this.Players[playerId].endTurn()

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
