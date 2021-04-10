class Board {
  constructor (height = 8, width = 8, numCastles = 8) {
    this._height = height
    this._width = width
    this._numCastles = numCastles
    this._castleSizes = new Array(numCastles)

    this._startingBlocks = [3, 18, 21, 31, 32, 42, 45, 60] // only for 8 castles, 8x8 board
    this._colors = ['black', 'red', 'blue', 'green', 'orange'] // TODO // black is default color

    // generate board
    this._board = new Array(this._height * this._width).fill().map(x => (
      {
        castle: -1, // id of castle or -1
        height: 0,
        knight: -1 // player id of knight or -1
      }))
  }

  initCastles () {
    // TODO: extend for arbitrary boards
    for (let i = 0; i < this._numCastles; i++) {
      const square = this._board[this._startingBlocks[i]]
      square.castle = i
      square.height = 1
    }

    this._castleSizes.fill(1)
  }

  initKnights (players) {
    // random initialization
    for (const p of players) {
      let square = null
      while (!square || square.knight !== -1) { // search for free starting castle
        const rand = Math.round(Math.random() * this._numCastles)
        square = this._board[this._startingBlocks[rand]]
      }
      square.knight = p.id
    }
  }

  getSquare (x, y) {
    if (x < 0 || y < 0 || x >= this._width || y >= this._height) {
      return null
    }
    return this._board[y * this._width + x]
  }

  getNeighbors (x, y) {
    const neighbors = [this.getSquare(x + 1, y), this.getSquare(x - 1, y), this.getSquare(x, y + 1), this.getSquare(x, y - 1)]
    return neighbors.filter(x => x) // filter null
  }

  canPlaceBlock (x, y) {
    const square = this.getSquare(x, y)
    if (!square) return false
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
      if (this._castleSizes[castleId] < square.height + 1) return false // castle would be higher than base
    }

    return { square, castleId }
  }

  placeBlock (square, castleId) {
    square.height += 1
    square.castle = castleId
    if (square.height === 1) {
      this._castleSizes[castleId] += 1
    }
  }

  canPlaceKnight (x, y, playerId, init = false) {
    const square = this.getSquare(x, y)
    if (!square) return false
    if (square.knight !== -1) return false // square not free

    if (init) {
      if (square.height !== 1) return false
    } else {
      let neighborHeight = -1
      for (const n of this.getNeighbors(x, y)) {
        if (n.knight === playerId && n.height > neighborHeight) {
          neighborHeight = n.height
        }
      }
      if (neighborHeight === -1) return false // no knight of player as neighbor
      if (neighborHeight < square.height) return false // knight can not be placed higher
    }

    return { square }
  }

  placeKnight (square, playerId) {
    square.knight = playerId
  }

  canMoveKnight (x, y, destX, destY, playerId) {
    const startSquare = this.getSquare(x, y)
    const destSquare = this.getSquare(destX, destY)

    if (!startSquare || !destSquare) return false
    if (startSquare.knight !== playerId || destSquare.knight !== -1) return false // not correct knight or source not free
    if (destSquare.height - startSquare.height > 1) return false // only move at most one up
    if ((Math.abs(x - destX) !== 1 || y !== destY) && (Math.abs(y - destY) !== 1 || x !== destX)) { // only move one
      // movement through castles
      if (destSquare.height > startSquare.height) return false // cannot move up through castle
      const startNeighborIds = []
      for (const n of this.getNeighbors(x, y)) {
        if (n.castle !== -1 && n.height > startSquare.height) startNeighborIds.push(n.castle)
      }
      const destNeighborIds = []
      for (const n of this.getNeighbors(destX, destY)) {
        if (n.castle !== -1 && n.height > destSquare.height) destNeighborIds.push(n.castle)
      }
      if (!startNeighborIds.some(id => destNeighborIds.includes(id))) return false // not same castle as entrance and destination available
    }

    return { startSquare, destSquare }
  }

  moveKnight (startSquare, destSquare, playerId) {
    startSquare.knight = -1
    destSquare.knight = playerId
    return true
  }

  evaluateBoard (playerId) {
    const knightPositions = this._board.filter(square => square.knight === playerId && square.castle >= 0)
    // find highest knight per castle
    const heightPerCastle = knightPositions.reduce((prev, square) => {
      if (!(square.castle in prev) || prev[square.castle] < square.height) {
        prev[square.castle] = square.height
      }
      return prev
    }, {})
    const score = Object.keys(heightPerCastle).reduce((prev, castleId) =>
      prev + heightPerCastle[castleId] * this._castleSizes[castleId], 0)
    return score
  }

  ascii () {
    let str = ''
    for (let i = 0; i < this._board.length; i++) {
      str += '(' + this._board[i].castle + ',' + this._board[i].height + ',' + this._board[i].knight + ')  \t'
      if (i % this._width === this._width - 1) {
        str += '\n'
      }
    }
    return str
  }

  html () {
    let str = '<table width="300" height="300" border="2">'
    for (let i = 0; i < this._board.length; i++) {
      if (i % this._width === 0) str += '<tr>'
      const square = this._board[i]
      str += '<td align="center" style="background-color: ' + (square.height === 0
        ? 'white'
        : 'grey') +
        '; color: ' +
         this._colors[square.knight + 1] +
        '">' + square.height + '</td>'
      if (i % this._width === this._width - 1) str += '</tr>'
    }
    str += '</table>'
    return str
  }
}

module.exports = Board
