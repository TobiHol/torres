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

    this._Players = [...Array(this._numPlayers).keys()].map(id =>
      new Player(id, this._numKnights, this._apPerRound, this._blocksPerRound))
    this._board = new Board()

    this._activePlayer = -1 // index/id of active player
    this._startingPlayer = -1 // index/id of starting player
    this._round = -1 // current round
    this._phase = -1 // current phase

    this.gameRunning = false

    if (blocksPerRound.length !== numRoundsPerPhase.reduce((a, b) => a + b, 0)) {
      console.error("numRoundsPerPhase doesn't match dimension of blocksPerRound")
    }
  }

  static assignInstances (torres) {
    Object.setPrototypeOf(torres, Torres.prototype)
    Object.setPrototypeOf(torres._board, Board.prototype)
    torres._Players.forEach(player => {
      Object.setPrototypeOf(player, Player.prototype)
    })
    return torres
  }

  get activePlayer () {
    return this._activePlayer
  }

  getInfo () {
    return {
      round: this._round,
      phase: this._phase,
      activePlayer: this._activePlayer,
      startingPlayer: this._startingPlayer,
      pointsPerPlayer: this._Players.map(p => p._points),
      apPerPlayer: this._Players.map(p => p._ap),
      numBlocksPerPlayer: this._Players.map(p => p._numBlocks),
      absRoundPerPlayer: this._Players.map(p => p._absRound)
    }
  }

  resetGame () {
    this._Players = [...Array(this._numPlayers).keys()].map(id => new Player(id, this._numKnights, this._apPerRound, this._blocksPerRound))
    this._board = new Board()
    this._activePlayer = -1
    this._startingPlayer = -1
    this._round = -1
    this._phase = -1
    this.gameRunning = false

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
    this._startingPlayer = 0
    this.gameRunning = true

    return true
  }

  placeBlock (playerId, x, y) {
    if (!this.gameRunning || this._phase === 0 || this._activePlayer !== playerId) return false
    const player = this._Players[playerId]

    // check wether action is illegal
    const placement = this._board.canPlaceBlock(x, y)
    if (!placement || !player.canPlaceBlock()) return false

    // execute action
    player.placeBlock()
    this._board.placeBlock(placement.square, placement.castleId)
    return true
  }

  placeBlockExecute (playerId, x, y) {
    this._Players[playerId].placeBlock()
    const square = this._board.getSquare(x, y)
    let castleId
    if (square.height !== 0) {
      castleId = square.castle
    } else {
      for (const n of this._board.getNeighbors(x, y)) {
        if (n.castle !== -1) {
          castleId = n.castle
          break
        }
      }
    }
    this._board.placeBlock(square, castleId)
  }

  placeBlockUndo (playerId, x, y) {
    this._Players[playerId].placeBlockUndo()
    this._board.placeBlockUndo(x, y)
  }

  placeKnight (playerId, x, y) {
    if (!this.gameRunning || this._activePlayer !== playerId) return false
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

  placeKnightExecute (playerId, x, y) {
    this._Players[playerId].placeKnight()
    this._board.placeKnight(this._board.getSquare(x, y), playerId)
  }

  placeKnightUndo (playerId, x, y) {
    this._Players[playerId].placeKnightUndo()
    this._board.placeKnightUndo(x, y)
  }

  moveKnight (playerId, x, y, destX, destY) {
    if (!this.gameRunning || this._phase === 0 || this._activePlayer !== playerId) return false
    const player = this._Players[playerId]

    // check wether action is illegal
    const movement = this._board.canMoveKnight(x, y, destX, destY, playerId)
    if (!movement || !player.canMoveKnight()) return false

    // execute action
    player.moveKnight()
    this._board.moveKnight(movement.startSquare, movement.destSquare, playerId)

    return true
  }

  moveKnightExecute (playerId, x, y, destX, destY) {
    this._Players[playerId].moveKnight()
    this._board.moveKnight(this._board.getSquare(x, y), this._board.getSquare(destX, destY), playerId)
  }

  moveKnightUndo (playerId, x, y, destX, destY) {
    this._Players[playerId].moveKnightUndo()
    this._board.moveKnightUndo(x, y, destX, destY, playerId)
  }

  endTurn (playerId) {
    if (!this.gameRunning || this._activePlayer !== playerId) return false

    if (this._phase === 0 && !this._placedInitKnights[playerId]) return false

    if (this._phase > 0) {
      this._Players[playerId].endTurn()
    }

    this._activePlayer = (this._activePlayer + 1) % this._numPlayers
    if (this._activePlayer === this._startingPlayer) { // end of round
      this.endRound()
    }

    return true
  }

  endTurnUndoTo ({
    round, phase, activePlayer, startingPlayer, pointsPerPlayer, apPerPlayer, numBlocksPerPlayer,
    absRoundPerPlayer
  }) {
    this.gameRunning = true
    this._round = round
    this._phase = phase
    this._activePlayer = activePlayer
    this._startingPlayer = startingPlayer
    for (let i = 0; i < this._Players.length; i++) {
      this._Players[i]._points = pointsPerPlayer[i]
      this._Players[i]._ap = apPerPlayer[i]
      this._Players[i]._numBlocks = numBlocksPerPlayer[i]
      this._Players[i]._absRound = absRoundPerPlayer[i]
    }
  }

  endRound () {
    if (this._phase > 0) {
      for (const p of this._Players) {
        p.endRound()
      }
    }
    if (this._phase === 0 || this._round === this._numRoundsPerPhase[this._phase - 1]) { // end of phase
      this.endPhase()
      return
    }
    this._round++
  }

  endPhase () {
    if (this._phase > 0) {
      this.endOfPhasEvaluation()
    }
    if (this._phase === this._numPhases) { // end of game
      this.endGame()
      return
    }
    // determine new starting player
    this._startingPlayer = this._Players.reduce((maxId, p, id, players) => (p.points > players[maxId].points ? id : maxId), 0)
    this._activePlayer = this._startingPlayer
    this._round = 1
    this._phase++
  }

  isAtEndOfPhase () {
    return this._activePlayer === this._startingPlayer && this._round === 1
  }

  endGame () {
    this.gameRunning = false
    // TODO
  }

  endOfPhasEvaluation () {
    for (const p of this._Players) {
      const score = this._board.evaluateBoard(p.id)
      p.addPoints(score)
    }
  }

  evaluateState () {
    const scorePerPlayer = new Array(this._numPlayers)
    for (const p of this._Players) {
      const score = this._board.evaluateBoard(p.id)
      scorePerPlayer[p.id] = score
    }
    return this._Players.map(p => p.points + scorePerPlayer[p.id])
  }

  getPoints (playerId) {
    return this._Players[playerId].points
  }

  getPointsPerPlayer () {
    return this._Players.map(p => p.points)
  }

  getLegalMoves (playerId) {
    const legalMoves = []
    if (this.gameRunning && this._activePlayer === playerId) {
      const player = this._Players[playerId]
      if (this._phase > 0) {
        legalMoves.push({ action: 'turn_end' })
      }
      for (let x = 0; x < this._board.width; x++) {
        for (let y = 0; y < this._board.height; y++) {
          if (this._phase > 0 && player.canPlaceBlock() && this._board.canPlaceBlock(x, y)) {
            legalMoves.push({ action: 'block_place', x, y })
          }
          if (player.canPlaceKnight() && this._board.canPlaceKnight(x, y, playerId, this._phase === 0)) {
            legalMoves.push({ action: 'knight_place', x, y })
          }
          if (this._phase > 0 && this._board.getSquare(x, y).knight === playerId && player.canMoveKnight()) {
            // find destinations for knight
            for (let destX = 0; destX < this._board.width; destX++) {
              for (let destY = 0; destY < this._board.height; destY++) {
                if (this._board.canMoveKnight(x, y, destX, destY, playerId)) {
                  legalMoves.push({ action: 'knight_move', x, y, destX, destY })
                }
              }
            }
          }
        }
      }
    }
    return legalMoves
  }

  getReasonableMoves (playerId) {
    const reasonableMoves = this.getLegalMoves(playerId).filter(move =>
      (move.action !== 'knight_move' || this._board.getSquare(move.x, move.y).height <= this._board.getSquare(move.destX, move.destY).height))
    return reasonableMoves
  }

  ascii () {
    let str = 'Phase: ' + (this.gameRunning ? this._phase : '-') + '\n'
    str += 'Round: ' + (this.gameRunning ? this._round : '-') + '\n'
    str += 'Starting Player: ' + (this.gameRunning ? this._startingPlayer : '-') + '\n'
    str += 'Active Player: ' + (this.gameRunning ? this._activePlayer : '-') + '\n\n'
    str += this._board.ascii() + '\n\n'
    str += 'Players \n'
    for (const p of this._Players) {
      str += p.ascii(this.gameRunning, this._phase)
    }
    return str
  }

  html () {
    let str = 'Phase: ' + (this.gameRunning ? this._phase : '-') + '<br/>'
    str += 'Round: ' + (this.gameRunning ? this._round : '-') + '<br/><br/>'
    str += 'Starting Player: ' + (this.gameRunning ? this._startingPlayer : '-') + '<br/>'
    str += 'Active Player: ' + (this.gameRunning ? this._activePlayer : '-') + '<br/><br/>'
    str += this._board.html() + '<br/><br/>'
    str += 'Players <br/>'
    for (const p of this._Players) {
      str += p.html(this.gameRunning, this._phase)
    }
    return str
  }
}

module.exports = Torres
