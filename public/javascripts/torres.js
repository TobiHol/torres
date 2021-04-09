class Torres {
  constructor (numRounds = 10, blocksPerRound = 3, apPerRound = 5, numKnights = 5, height = 8, width = 8, numCastles = 8) {
    this.height = height
    this.width = width
    this.numKnights = numKnights
    this.apPerRound = apPerRound
    this.numRounds = numRounds
    this.blocksPerRound = blocksPerRound
    this.numCastles = numCastles
    this.castleSizes = new Array(numCastles)

    this.numPlayers = 0
    // this.Players = []
    this.activePlayer = 0
    this.colors = ['black', 'red', 'blue', 'green', 'orange'] // TODO

    // generate board
    this.board = new Array(this.height * this.width).fill().map(x => (
      {
        castle: -1, // id of castle or -1
        height: 0,
        knight: -1 // player id of knight or -1
      }))

    // initialize game (TODO: by players?)
    this.initCastles()
    this.initKnights()
  }

  addPlayer () {
    // this.Players.push(player)
    this.numPlayers++
  }

  initCastles (mode = 'standard') {
    if (mode === 'standard') {
      // TODO: extend for arbitrary boards
      const placements = [3, 18, 21, 31, 32, 42, 45, 60] // only for 8 castles, 8x8 board
      for (let i = 0; i < this.numCastles; i++) {
        this.board[placements[i]].castle = i
        this.board[placements[i]].height = 1
      }
    } else if (mode === 'random') {
      // TODO
    }

    this.castleSizes.fill(1)
  }

  initKnights () {
    // TODO
    this.board[31].knight = 0
    this.board[42].knight = 1
  }

  getSquare (x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null
    }
    return this.board[y * this.width + x]
  }

  getNeighbors (x, y) {
    const neighbors = [this.getSquare(x + 1, y), this.getSquare(x - 1, y), this.getSquare(x, y + 1), this.getSquare(x, y - 1)]
    return neighbors.filter(x => x) // filter null
  }

  placeBlock (playerId, x, y) {
    const square = this.getSquare(x, y)
    if (this.activePlayer !== playerId || !square) return false

    // check wether placement is illegal
    if (square.knight !== -1) return false // square not free
    let castleId = -1
    if (square.height === 0) {
      for (const n of this.getNeighbors(x, y)) {
        if (n.castle !== -1) {
          if (castleId !== -1 && castleId !== n.castle) return false // block would connect two castles
          castleId = n.castle
        }
      }
      if (castleId === -1) return false // block would create new castle
    } else {
      castleId = square.castle
      if (this.castleSizes[castleId] < square.height + 1) return false // castle would be higher than base
    }

    // execute action
    square.height += 1
    square.castle = castleId
    if (square.height === 1) {
      this.castleSizes[castleId] += 1
    }
    return true
  }

  placeKnight (playerId, x, y) {
    const square = this.getSquare(x, y)
    if (this.activePlayer !== playerId || !square) return false

    // check wether placement is illegal
    if (square.knight !== -1) return false // square not free
    let neighborHeight = -1
    for (const n of this.getNeighbors(x, y)) {
      if (n.knight === playerId && n.height > neighborHeight) {
        neighborHeight = n.height
      }
    }
    if (neighborHeight === -1) return false // no knight of player as neighbor
    if (neighborHeight < square.height) return false // knight can not be placed higher

    // execute action
    square.knight = playerId
    return true
  }

  moveKnight (playerId, x, y, destX, destY) {
    const square = this.getSquare(x, y)
    const destSquare = this.getSquare(destX, destY)
    if (this.activePlayer !== playerId || !square || !destSquare) return false

    // check wether movement is illegal
    if (square.knight !== playerId || destSquare.knight !== -1) return false // not correct knight or source not free
    if (destSquare.height - square.height > 1) return false // only move at most one up
    if ((Math.abs(x - destX) !== 1 || y !== destY) && (Math.abs(y - destY) !== 1 || x !== destX)) { // only move one
      // TODO: movement throu castles
      return false
    }

    // execute movement
    square.knight = -1
    destSquare.knight = playerId
    return true
  }

  endTurn (playerId) {
    if (this.activePlayer !== playerId) return false
    this.activePlayer = (this.activePlayer + 1) % this.numPlayers
    return true
  }

  ascii () {
    let str = ''
    for (let i = 0; i < this.board.length; i++) {
      str += '(' + this.board[i].castle + ',' + this.board[i].height + ',' + this.board[i].knight + ')  \t'
      if (i % this.width === this.width - 1) {
        str += '\n'
      }
    }
    return str
  }

  html () {
    let str = '<table width="300" height="300" border="2">'
    for (let i = 0; i < this.board.length; i++) {
      if (i % this.width === 0) str += '<tr>'
      const square = this.board[i]
      str += '<td align="center" style="background-color: ' + (square.height === 0
        ? 'white'
        : 'grey') +
        '; color: ' +
         this.colors[square.knight + 1] +
        '">' + square.height + '</td>'
      if (i % this.width === this.width - 1) str += '</tr>'
    }
    str += '</table>'
    return str
  }
}

module.exports = Torres
