const Board = require('./board')
const Player = require('./player')

class Torres {
  constructor (numPlayers = 2, initMode = 'random',
    boardHeight = 8, boardWidth = 8, numCastles = 8, startingBlocks = [3, 18, 21, 31, 32, 42, 45, 60],
    numRoundsPerPhase = [4, 4, 4], blocksPerRound = new Array(4 * 3).fill(3), apPerRound = 5, numKnights = 5,
    playerColors = ['red', 'blue', 'green', 'orange']) {
    if (blocksPerRound.length !== numRoundsPerPhase.reduce((a, b) => a + b, 0) || startingBlocks.length !== numCastles) {
      console.error("parameters don't match")
    }
    if (playerColors.length < numPlayers) {
      console.error('not enough player colors given')
    }

    this._numPlayers = numPlayers
    this._playerColors = playerColors

    this._numPhases = numRoundsPerPhase.length
    this._numRoundsPerPhase = numRoundsPerPhase
    this._initMode = initMode

    this._playerParams = { numKnights, apPerRound, blocksPerRound }
    this._boardParams = { height: boardHeight, width: boardWidth, numCastles, startingBlocks, colors: playerColors }

    // set up players and game board
    this._playerList = [...Array(this._numPlayers).keys()].map(id =>
      new Player({ id, color: playerColors[id], ...this._playerParams }))
    this._board = new Board(this._boardParams)

    this._activePlayer = -1 // index/id of active player
    this._startingPlayer = -1 // index/id of starting player
    this._round = -1 // current round
    this._phase = -1 // current phase

    this._gameRunning = false
  }

  static assignInstances (torres) {
    Object.setPrototypeOf(torres, Torres.prototype)
    Object.setPrototypeOf(torres._board, Board.prototype)
    torres._playerList.forEach(player => {
      Object.setPrototypeOf(player, Player.prototype)
    })
    return torres
  }

  get board () {
    return this._board
  }

  get playerList () {
    return this._playerList
  }

  getPlayer (id) {
    return this._playerList[id]
  }

  get playerColors () {
    return this._playerColors
  }

  get activePlayer () {
    return this._activePlayer
  }

  get phase () {
    return this._phase
  }

  get round () {
    return this._round
  }

  get gameRunning () {
    return this._gameRunning
  }

  resetGame () {
    this._playerList = [...Array(this._numPlayers).keys()].map(id => new Player({ id, color: this._playerColors[id], ...this._playerParams }))
    this._board = new Board(this._boardParams)
    this._activePlayer = -1
    this._startingPlayer = -1
    this._round = -1
    this._phase = -1
    this._gameRunning = false

    return true
  }

  initGame () {
    if (this._phase !== -1) return false

    if (this._initMode === 'random') {
      this._board.initCastles()
      this._board.initKnights(this._playerList)
      this._round = 1
      this._phase = 1
    } else if (this._initMode === 'choice') {
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
    this._gameRunning = true

    return true
  }

  placeBlock (playerId, x, y) {
    if (!this._gameRunning || this._phase === 0 || this._activePlayer !== playerId) return false
    const player = this._playerList[playerId]

    // check wether action is illegal
    const placement = this._board.canPlaceBlock(x, y)
    if (!placement || !player.canPlaceBlock()) return false

    // execute action
    player.placeBlock()
    this._board.placeBlock(placement.square, placement.castleId)
    return true
  }

  placeBlockExecute (playerId, x, y) {
    this._playerList[playerId].placeBlock()
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
    this._playerList[playerId].placeBlockUndo()
    this._board.placeBlockUndo(x, y)
  }

  placeKnight (playerId, x, y) {
    if (!this._gameRunning || this._activePlayer !== playerId) return false
    const player = this._playerList[playerId]

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
      // this.endTurn(playerId)
    }

    return true
  }

  placeKnightExecute (playerId, x, y) {
    if (this.phase === 0) {
      this._placedInitKnights[playerId] = true
    } else {
      this._playerList[playerId].placeKnight()
    }
    this._board.placeKnight(this._board.getSquare(x, y), playerId)
  }

  placeKnightUndo (playerId, x, y) {
    this._playerList[playerId].placeKnightUndo()
    this._board.placeKnightUndo(x, y)
  }

  moveKnight (playerId, x, y, destX, destY) {
    if (!this._gameRunning || this._phase === 0 || this._activePlayer !== playerId) return false
    const player = this._playerList[playerId]

    // check wether action is illegal
    const movement = this._board.canMoveKnight(x, y, destX, destY, playerId)
    if (!movement || !player.canMoveKnight()) return false

    // execute action
    player.moveKnight()
    this._board.moveKnight(movement.startSquare, movement.destSquare, playerId)

    return true
  }

  moveKnightExecute (playerId, x, y, destX, destY) {
    this._playerList[playerId].moveKnight()
    this._board.moveKnight(this._board.getSquare(x, y), this._board.getSquare(destX, destY), playerId)
  }

  moveKnightUndo (playerId, x, y, destX, destY) {
    this._playerList[playerId].moveKnightUndo()
    this._board.moveKnightUndo(x, y, destX, destY, playerId)
  }

  endTurn (playerId) {
    if (!this._gameRunning || this._activePlayer !== playerId) return false

    if (this._phase === 0 && !this._placedInitKnights[playerId]) return false

    if (this._phase > 0) {
      this._playerList[playerId].endTurn()
    }

    this._activePlayer = (this._activePlayer + 1) % this._numPlayers
    if (this._activePlayer === this._startingPlayer) { // end of round
      this.endRound()
    }

    return true
  }

  getInfo () {
    return {
      round: this._round,
      phase: this._phase,
      activePlayer: this._activePlayer,
      startingPlayer: this._startingPlayer,
      playersInfo: this._playerList.map(p => ({ points: p.points, ap: p.ap, numBlocks: p.numBlocks }))
    }
  }

  endTurnUndoTo ({ round, phase, activePlayer, startingPlayer, playersInfo }) {
    this._gameRunning = true
    this._round = round
    this._phase = phase
    this._activePlayer = activePlayer
    this._startingPlayer = startingPlayer
    for (let i = 0; i < this._playerList.length; i++) {
      this._playerList[i].resetAttributesTo(playersInfo[i])
    }
  }

  endRound () {
    if (this._phase > 0) {
      const absRound = (this._round - 1) + this._numRoundsPerPhase.reduce((sum, rounds, i) => i < this._phase - 1 ? sum + rounds : sum, 0)
      for (const p of this._playerList) {
        p.endRound(absRound)
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
    this._startingPlayer = this._playerList.reduce((maxId, p, id, players) => (p.points > players[maxId].points ? id : maxId), 0)
    this._activePlayer = this._startingPlayer
    this._round = 1
    this._phase++
  }

  isAtEndOfPhase () {
    return this._activePlayer === this._startingPlayer && this._round === 1
  }

  endGame () {
    this._gameRunning = false
    // TODO
  }

  endOfPhasEvaluation () {
    for (const p of this._playerList) {
      const score = this._board.evaluateBoard(p.id)
      p.addPoints(score)
    }
  }

  evaluateState () {
    const scorePerPlayer = new Array(this._numPlayers)
    for (const p of this._playerList) {
      const score = this._board.evaluateBoard(p.id)
      scorePerPlayer[p.id] = score
    }
    return this._playerList.map(p => p.points + scorePerPlayer[p.id])
  }

  getPoints (playerId) {
    return this._playerList[playerId].points
  }

  getPointsPerPlayer () {
    return this._playerList.map(p => p.points)
  }

  getLegalMoves (playerId, nullMove = false) {
    if (nullMove && this._gameRunning && this._activePlayer !== playerId) {
      return [{ action: 'null_move' }]
    }
    const legalMoves = []
    if (this._gameRunning && this._activePlayer === playerId) {
      const player = this._playerList[playerId]
      if (this._phase > 0 || this._placedInitKnights[playerId]) {
        legalMoves.push({ action: 'turn_end' })
      }
      // place init knight
      if (this._phase === 0 && !this._placedInitKnights[playerId]) {
        for (const square of this._board.squares.filter(s => s.height === 1 && s.knight === -1)) {
          legalMoves.push({ action: 'knight_place', x: square.x, y: square.y })
        }
      }
      if (this._phase > 0 && player.ap > 0) {
        if (this._phase > 0 && player.canPlaceBlock()) {
          for (let x = 0; x < this._board.width; x++) {
            for (let y = 0; y < this._board.height; y++) {
              if (this._board.canPlaceBlock(x, y)) {
                legalMoves.push({ action: 'block_place', x, y })
              }
            }
          }
        }
        // get knight positions
        const knightSquares = this._board.getKnightSquares(playerId)
        if (player.canPlaceKnight()) {
          for (const square of knightSquares) {
            for (const n of this._board.getNeighbors(square.x, square.y)) {
              if (n.knight === -1 && n.height <= square.height) {
                legalMoves.push({ action: 'knight_place', x: n.x, y: n.y })
              }
            }
          }
        }
        if (this._phase > 0 && player.canMoveKnight()) {
          for (const square of knightSquares) {
            // find destinations for knight
            for (let destX = 0; destX < this._board.width; destX++) {
              for (let destY = 0; destY < this._board.height; destY++) {
                if (this._board.canMoveKnight(square.x, square.y, destX, destY, playerId)) {
                  legalMoves.push({ action: 'knight_move', x: square.x, y: square.y, destX, destY })
                }
              }
            }
          }
        }
      }
    }
    return legalMoves
  }

  // order: move knight up, place knight, place block my castles, end turn, move knight same level/down, place block other castle
  getLegalMovesOrdered (playerId, nullMove = false) {
    if (nullMove && this._gameRunning && this._activePlayer !== playerId) {
      return [{ action: 'null_move' }]
    }
    const legalMoves = []
    const legalMovesPrio = []

    if (this._gameRunning && this._activePlayer === playerId) {
      const player = this._playerList[playerId]
      // end turn
      if (this._phase > 0 || this._placedInitKnights[playerId]) {
        legalMoves.push({ action: 'turn_end' })
      }
      // place init knight
      if (this._phase === 0 && !this._placedInitKnights[playerId]) {
        for (const square of this._board.squares.filter(s => s.height === 1 && s.knight === -1)) {
          legalMovesPrio.push({ action: 'knight_place', x: square.x, y: square.y })
        }
      }
      // get knight positions
      const knightSquares = this._board.getKnightSquares(playerId)
      const myCastles = knightSquares.map(s => s.castle).filter(c => c !== -1)
      if (this._phase > 0 && player.ap > 0) {
        // move knight
        if (player.canMoveKnight()) {
          for (const square of knightSquares) {
            // find destinations for knight
            for (let destX = 0; destX < this._board.width; destX++) {
              for (let destY = 0; destY < this._board.height; destY++) {
                if (this._board.canMoveKnight(square.x, square.y, destX, destY, playerId)) {
                  if (this._board.getSquare(destX, destY).height > square.height) {
                    legalMovesPrio.push({ action: 'knight_move', x: square.x, y: square.y, destX, destY })
                  } else {
                    legalMoves.push({ action: 'knight_move', x: square.x, y: square.y, destX, destY })
                  }
                }
              }
            }
          }
        }
        // place knight
        if (player.canPlaceKnight()) {
          for (const square of knightSquares) {
            for (const n of this._board.getNeighbors(square.x, square.y)) {
              if (n.knight === -1 && n.height <= square.height) {
                legalMovesPrio.push({ action: 'knight_place', x: n.x, y: n.y })
              }
            }
          }
        }
        // place block
        if (player.canPlaceBlock()) {
          for (let x = 0; x < this._board.width; x++) {
            for (let y = 0; y < this._board.height; y++) {
              const placement = this._board.canPlaceBlock(x, y)
              if (placement) {
                if (placement.castleId in myCastles) {
                  legalMovesPrio.push({ action: 'block_place', x, y })
                } else {
                  legalMoves.push({ action: 'block_place', x, y })
                }
              }
            }
          }
        }
      }
    }
    legalMovesPrio.push(...legalMoves)
    return legalMovesPrio
  }

  getLegalMovesLimited (playerId, nullMove = false) {
    const legalMoves = []
    if (nullMove && this._gameRunning && this._activePlayer !== playerId) {
      legalMoves.push({ action: 'null_move' })
    }
    if (this._gameRunning && this._activePlayer === playerId) {
      const player = this._playerList[playerId]
      if (this._phase > 0 || this._placedInitKnights[playerId]) {
        legalMoves.push({ action: 'turn_end' })
      }
      // place init knight
      if (this._phase === 0 && !this._placedInitKnights[playerId]) {
        for (const square of this._board.squares.filter(s => s.height === 1 && s.knight === -1)) {
          legalMoves.push({ action: 'knight_place', x: square.x, y: square.y })
        }
      }
      if (this._phase > 0 && player.ap > 0) {
        if (player.canPlaceBlock()) {
          for (let x = 0; x < this._board.width; x++) {
            for (let y = 0; y < this._board.height; y++) {
              if (this._board.canPlaceBlock(x, y)) {
                legalMoves.push({ action: 'block_place', x, y })
              }
            }
          }
        }
        // get knight positions
        const knightSquares = this._board.getKnightSquares(playerId)
        for (const square of knightSquares) {
          for (const n of this._board.getNeighbors(square.x, square.y)) {
            if (n.knight === -1) {
              if (player.canPlaceKnight() && n.height <= square.height) {
                legalMoves.push({ action: 'knight_place', x: n.x, y: n.y })
              }
              // don't move through castles, only move at most one up/down
              if (Math.abs(n.height - square.height) <= 1) {
                legalMoves.push({ action: 'knight_move', x: square.x, y: square.y, destX: n.x, destY: n.y })
              }
            }
          }
        }
      }
    }
    return legalMoves
  }

  ascii () {
    let str = 'Phase: ' + (this._gameRunning ? this._phase : '-') + '\n'
    str += 'Round: ' + (this._gameRunning ? this._round : '-') + '\n'
    str += 'Starting Player: ' + (this._gameRunning ? this._startingPlayer : '-') + '\n'
    str += 'Active Player: ' + (this._gameRunning ? this._activePlayer : '-') + '\n\n'
    str += this._board.ascii() + '\n\n'
    str += 'Players \n'
    for (const p of this._playerList) {
      str += p.ascii(this._gameRunning, this._phase)
    }
    return str
  }

  html () {
    let str = 'Phase: ' + (this._gameRunning ? this._phase : '-') + '<br/>'
    str += 'Round: ' + (this._gameRunning ? this._round : '-') + '<br/><br/>'
    str += 'Starting Player: ' + (this._gameRunning ? this._startingPlayer : '-') + '<br/>'
    str += 'Active Player: ' + (this._gameRunning ? this._activePlayer : '-') + '<br/><br/>'
    str += this._board.html() + '<br/><br/>'
    str += 'Players <br/>'
    for (const p of this._playerList) {
      str += p.html(this._gameRunning, this._phase)
    }
    return str
  }
}

module.exports = Torres
