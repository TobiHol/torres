const Board = require('./board')
const Player = require('./player')

class Torres {
  constructor (numPlayers = 2, numRoundsPerPhase = [4, 4, 4],
    blocksPerRound = new Array(4 * 3).fill(3), apPerRound = 5, numKnights = 5, numCastles = 8) {
    this.numPlayers = numPlayers

    this.numPhases = numRoundsPerPhase.length
    this.numRoundsPerPhase = numRoundsPerPhase

    this.numKnights = numKnights
    this.apPerRound = apPerRound
    this.blocksPerRound = blocksPerRound

    this.activePlayer = -1 // index of active player
    this.round = -1 // current round
    this.phase = -1 // current phase

    if (blocksPerRound.length !== numRoundsPerPhase.reduce((a, b) => a * b)) {
      console.error("numRoundsPerPhase doesn't match dimension of blocksPerRound")
    }
    this.resetGame()
  }

  resetGame () {
    this.Players = [...Array(this.numPlayers).keys()].map(id => new Player(id, this.numKnights, this.apPerRound, this.blocksPerRound))
    this.board = new Board()
    this.activePlayer = -1
    this.round = -1
    this.phase = -1

    return true
  }

  initGame (mode = 'random') {
    if (this.phase !== -1) return false

    if (mode === 'random') {
      this.board.initCastles()
      this.board.initKnights(this.Players)
      this.round = 1
      this.phase = 1
    } else if (mode === 'choice') {
      this.board.initCastles() // TODO: let players choose castle placements ?
      this.placedInitKnights = new Array(this.numPlayers).fill(false) // TODO: find more elegant solution
      // set attributes to initiation round
      this.round = 0
      this.phase = 0
    } else {
      return false
    }
    this.activePlayer = 0

    return true
  }

  placeBlock (playerId, x, y) {
    if (this.phase <= 0 || this.Players[this.activePlayer].id !== playerId) return false
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
    if (this.phase < 0 || this.Players[this.activePlayer].id !== playerId) return false
    const player = this.Players[playerId]

    if (this.phase > 0) {
      // check wether action is illegal
      const placement = this.board.canPlaceKnight(x, y, playerId)
      if (!placement || !player.canPlaceKnight()) return false

      // execute action
      player.placeKnight()
      this.board.placeKnight(placement.square, playerId)
    } else if (this.phase === 0) { // init phase
      const placement = this.board.canPlaceKnight(x, y, playerId, true)
      if (!placement) return false
      this.board.placeKnight(placement.square, playerId)
      this.placedInitKnights[playerId] = true
      this.endTurn(playerId)
    }

    return true
  }

  moveKnight (playerId, x, y, destX, destY) {
    if (this.phase <= 0 || this.Players[this.activePlayer].id !== playerId) return false
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
    if (this.phase < 0 || this.Players[this.activePlayer].id !== playerId) return false

    if (this.phase === 0 && !this.placedInitKnights[playerId]) return false

    this.activePlayer = (this.activePlayer + 1) % this.numPlayers
    if (this.activePlayer === 0) { // end of round
      if (this.phase === 0 || this.round === this.numRoundsPerPhase[this.phase - 1]) { // end of phase
        this.endPhase()
      } else {
        this.round++
      }
    }

    if (this.round > 0) {
      this.Players[playerId].endTurn()
    }

    return true
  }

  endPhase () {
    this.round = 1
    this.phase++
    // TODO: evaluate board -> add points
    // TODO: change order of players
  }

  ascii () {
    let str = 'Phase: ' + this.phase + '\n'
    str += 'Round: ' + this.round + '\n'
    str += 'Active Player: ' + (this.activePlayer === -1 ? 'none' : this.Players[this.activePlayer].id) + '\n\n'
    str += this.board.ascii() + '\n\n'
    str += 'Players \n'
    for (const p of this.Players) {
      str += p.ascii(this.phase)
    }
    return str
  }

  html () {
    let str = 'Phase: ' + this.phase + '<br/>'
    str += 'Round: ' + this.round + '<br/><br/>'
    str += 'Active Player: ' + (this.activePlayer === -1 ? -1 : this.Players[this.activePlayer].id) + '<br/><br/>'
    str += this.board.html() + '<br/><br/>'
    str += 'Players <br/>'
    for (const p of this.Players) {
      str += p.html(this.phase)
    }
    return str
  }
}

module.exports = Torres
