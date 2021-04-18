class Board {
  constructor ({ height, width, numCastles, startingBlocks, colors }) {
    this._height = height
    this._width = width
    this._numCastles = numCastles
    this._castleSizes = new Array(numCastles)

    this._startingBlocks = startingBlocks
    this._colors = colors

    // generate board
    this._squares = new Array(this._height * this._width).fill().map((x, i) => (
      {
        x: i % this._width,
        y: Math.floor(i / this._width),
        castle: -1, // id of castle or -1
        height: 0,
        knight: -1 // player id of knight or -1
      }))
  }

  get height () {
    return this._height
  }

  get width () {
    return this._width
  }

  get squares () {
    return this._squares
  }

  initCastles () {
    // TODO: extend for arbitrary boards
    for (let i = 0; i < this._numCastles; i++) {
      const square = this._squares[this._startingBlocks[i]]
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
        square = this._squares[this._startingBlocks[rand]]
      }
      square.knight = p.id
    }
  }

  getSquare (x, y) {
    if (x < 0 || y < 0 || x >= this._width || y >= this._height) {
      return null
    }
    return this._squares[y * this._width + x]
  }

  getNeighbors (x, y) {
    const neighbors = [this.getSquare(x + 1, y), this.getSquare(x - 1, y), this.getSquare(x, y + 1), this.getSquare(x, y - 1)]
    return neighbors.filter(x => x) // filter null
  }

  hasKnightAsNeighbor (square, playerId) {
    for (const n of this.getNeighbors(square.x, square.y)) {
      if (n.knight === playerId) {
        return true
      }
    }
    return false
  }

  getKnightSquares (playerId) {
    return this._squares.filter(square => square.knight === playerId)
  }

  // TODO: keep track of it while playing?
  getKnightPositionsOfPlayer (playerId) { // squares with player's knights and highest knights per castle
    const knightSquares = this._squares.filter(square => square.knight === playerId)
    const highestKnights = {}
    for (const ks of knightSquares) {
      if (ks.castle !== -1) {
        if (!(ks.castle in highestKnights) || ks.height > highestKnights[ks.castle]) {
          highestKnights[ks.castle] = ks.height
        }
      }
    }
    return { squares: knightSquares, highest: highestKnights }
  }

  getHighestKnightsPerCastle () {
    const knightsOnCastles = this._squares.filter(square => square.castle !== -1 && square.knight !== -1)
    const highestKnights = new Array(this._numCastles).fill({ knight: -1, height: -1 })
    for (const square of knightsOnCastles) {
      const hk = highestKnights[square.castle]
      if (hk.knight === -1 || square.height > hk.height) {
        hk.knight = square.knight
        hk.height = square.height
      }
    }
    return highestKnights
  }

  isMovingUp (x, y, destX, destY) {
    const startSquare = this.getSquare(x, y)
    const destSquare = this.getSquare(destX, destY)
    if (destSquare.castle === -1 || destSquare.height <= startSquare.height) return false
    const higherKnights = this._squares.filter(square =>
      square.castle === destSquare.castle && square.knight === startSquare.knight && square.height >= destSquare.height)
    if (higherKnights.length !== 0) return false
    return true
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

  placeBlockUndo (x, y) {
    const square = this.getSquare(x, y)
    square.height -= 1
    if (square.height === 0) {
      this._castleSizes[square.castle] -= 1
      square.castle = -1
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

  placeKnightUndo (x, y) {
    this.getSquare(x, y).knight = -1
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

  moveKnightUndo (x, y, destX, destY, playerId) {
    this.getSquare(x, y).knight = playerId
    this.getSquare(destX, destY).knight = -1
  }

  evaluateBoard (playerId) {
    const knightPositions = this._squares.filter(square => square.knight === playerId && square.castle >= 0)
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
    for (let i = 0; i < this._squares.length; i++) {
      str += '(' + this._squares[i].castle + ',' + this._squares[i].height + ',' + this._squares[i].knight + ')  \t'
      if (i % this._width === this._width - 1) {
        str += '\n'
      }
    }
    return str
  }

  html () {
    let str = '<table width="400" height="400" border="2">'
    for (let i = 0; i < this._squares.length; i++) {
      if (i % this._width === 0) str += '<tr>'
      const square = this._squares[i]
      str += '<td align="center" style="background-color: ' + (square.height === 0
        ? 'white'
        : 'grey') +
        '; color: ' +
         (square.knight === -1 ? 'black' : this._colors[square.knight]) +
        '">' + square.height + '</td>'
      if (i % this._width === this._width - 1) str += '</tr>'
    }
    str += '</table>'
    return str
  }
}

module.exports = Board
