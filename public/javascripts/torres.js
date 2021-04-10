const Board = require('./board')
const Player = require('./player')

class Torres {
  constructor (numPlayers = 2, numRoundsPerPhase = [4, 4, 4],
    blocksPerRound = new Array(4 * 3).fill(3), apPerRound = 5, numKnights = 5, numCastles = 8) {
    this._numPlayers = numPlayers

    this._numPhases = numRoundsPerPhase.length
    this._numRoundsPerPhase = numRoundsPerPhase

    this._numKnights = numKnights
    this._apPerRound = apPerRound
    this._blocksPerRound = blocksPerRound

    this._activePlayer = -1 // index of active player
    this._round = -1 // current round
    this._phase = -1 // current phase

    if (blocksPerRound.length !== numRoundsPerPhase.reduce((a, b) => a + b, 0)) {
      console.error("numRoundsPerPhase doesn't match dimension of blocksPerRound")
    }
    this.resetGame()
  }

  resetGame () {
    this._Players = [...Array(this._numPlayers).keys()].map(id => new Player(id, this._numKnights, this._apPerRound, this._blocksPerRound))
    this._board = new Board()
    this._activePlayer = -1
    this._round = -1
    this._phase = -1

    return true
  }

  initGame (mode = 'random') {
    if (this._phase !== -1) return false

    if (mode === 'random') {
      this._board.initCastles()
      this._board.initKnights(this._Players)
      this._round = 1
      this._phase = 1
    } else if (mode === 'choice') {
      this._board.initCastles() // TODO: let players choose castle placements ?
      this._placedInitKnights = new Array(this._numPlayers).fill(false) // TODO: find more elegant solution
      // set attributes to initiation round
      this._round = 0
      this._phase = 0
    } else {
      return false
    }
    this._activePlayer = 0

    return true
  }

  placeBlock (playerId, x, y) {
    if (this._phase <= 0 || this._Players[this._activePlayer].id !== playerId) return false
    const player = this._Players[playerId]

    // check wether action is illegal
    const placement = this._board.canPlaceBlock(x, y)
    if (!placement || !player.canPlaceBlock()) return false

    // execute action
    player.placeBlock()
    this._board.placeBlock(placement.square, placement.castleId)
    return true
  }

  placeKnight (playerId, x, y) {
    if (this._phase < 0 || this._Players[this._activePlayer].id !== playerId) return false
    const player = this._Players[playerId]

    if (this._phase > 0) {
      // check wether action is illegal
      const placement = this._board.canPlaceKnight(x, y, playerId)
      if (!placement || !player.canPlaceKnight()) return false

      // execute action
      player.placeKnight()
      this._board.placeKnight(placement.square, playerId)
    } else if (this._phase === 0) { // init phase
      const placement = this._board.canPlaceKnight(x, y, playerId, true)
      if (!placement) return false
      this._board.placeKnight(placement.square, playerId)
      this._placedInitKnights[playerId] = true
      this.endTurn(playerId)
    }

    return true
  }

  moveKnight (playerId, x, y, destX, destY) {
    if (this._phase <= 0 || this._Players[this._activePlayer].id !== playerId) return false
    const player = this._Players[playerId]

    // check wether action is illegal
    const movement = this._board.canMoveKnight(x, y, destX, destY, playerId)
    if (!movement || !player.canMoveKnight()) return false

    // execute action
    player.moveKnight()
    this._board.moveKnight(movement.startSquare, movement.destSquare, playerId)

    return true
  }

  endTurn (playerId) {
    if (this._phase < 0 || this._Players[this._activePlayer].id !== playerId) return false

    if (this._phase === 0 && !this._placedInitKnights[playerId]) return false

    if (this._phase > 0) {
      this._Players[playerId].endTurn()
    }

    this._activePlayer = (this._activePlayer + 1) % this._numPlayers
    if (this._activePlayer === 0) { // end of round
      if (this._phase === 0 || this._round === this._numRoundsPerPhase[this._phase - 1]) { // end of phase
        console.log('end phase')
        this.endPhase()
      } else {
        this._round++
      }
    }

    return true
  }

  endPhase () {
    if (this._phase > 0) {
      this.evaluateState()
    }
    this._round = 1
    this._phase++
    // TODO: change order of players
  }

  evaluateState () {
    const scorePerPlayer = new Array(this._numPlayers)
    for (const p of this._Players) {
      const score = this._board.evaluateBoard(p.id)
      scorePerPlayer[p.id] = score
      p.addPoints(score)
    }
    console.log(scorePerPlayer)
  }

  getLegalMoves (playerId) {
    const legalMoves = []
    if (this._activePlayer !== -1 && this._Players[this._activePlayer].id === playerId) {
      if (this._phase > 0) {
        legalMoves.push({ action: 'turn_end' })
      }
      for (let x = 0; x < this._board.width; x++) {
        for (let y = 0; y < this._board.height; y++) {
          if (this._phase > 0 && this._board.canPlaceBlock(x, y)) {
            legalMoves.push({ action: 'block_place', x, y })
          }
          if (this._board.canPlaceKnight(x, y, playerId, this._phase === 0)) {
            legalMoves.push({ action: 'knight_place', x, y })
          }
          for (let destX = 0; destX < this._board.width; destX++) {
            for (let destY = 0; destY < this._board.height; destY++) {
              if (this._phase > 0 && this._board.canMoveKnight(x, y, destX, destY, playerId)) {
                legalMoves.push({ action: 'knight_move', x, y, destX, destY })
              }
            }
          }
        }
      }
    }
    return legalMoves
  }

  ascii () {
    let str = 'Phase: ' + this._phase + '\n'
    str += 'Round: ' + this._round + '\n'
    str += 'Active Player: ' + (this._activePlayer === -1 ? 'none' : this._Players[this._activePlayer].id) + '\n\n'
    str += this._board.ascii() + '\n\n'
    str += 'Players \n'
    for (const p of this._Players) {
      str += p.ascii(this._phase)
    }
    return str
  }

  html () {
    let str = 'Phase: ' + this._phase + '<br/>'
    str += 'Round: ' + this._round + '<br/><br/>'
    str += 'Active Player: ' + (this._activePlayer === -1 ? -1 : this._Players[this._activePlayer].id) + '<br/><br/>'
    str += this._board.html() + '<br/><br/>'
    str += 'Players <br/>'
    for (const p of this._Players) {
      str += p.html(this._phase)
    }
    return str
  }
}

module.exports = Torres
