import TinyQueue from 'tinyqueue'

class Board {
  constructor ({ height, width, numCastles, startingBlocks, colors }) {
    this._height = height
    this._width = width
    this._numCastles = numCastles
    this._castleSizes = new Array(numCastles)

    this._startingBlocks = startingBlocks
    this._colors = colors

    this._kingsCastle = null

    // generate board
    this._squares = new Array(this._height * this._width).fill().map((x, i) => (
      {
        x: i % this._width,
        y: Math.floor(i / this._width),
        castle: -1, // id of castle or -1
        height: 0,
        knight: -1 // player id of knight, 'king', or -1
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

  initKnights (players, balanced = false) {
    if (balanced) {
      // fixed positions
      for (let i = 0; i < players.length; i++) {
        const square = this._squares[this._startingBlocks[i < 2 ? i + 1 : i + 3]]
        square.knight = players[i].id
      }
    } else {
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
    const knightsOnCastles = this._squares.filter(square => square.castle !== -1 && square.knight !== -1 && square.knight !== 'king')
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
    for (const tmpDest of this.findKnightDestinations(startSquare)) {
      if (tmpDest.x === destSquare.x && tmpDest.y === destSquare.y) {
        return { startSquare, destSquare }
      }
    }
    return false
  }

  findKnightDestinations (startSquare) {
    const prioQueue = new TinyQueue([], (a, b) => a.height - b.height)
    const destinations = []
    const visited = new Array(this._squares.length)
    const found = new Array(this._squares.length)
    found[startSquare.y * this._width + startSquare.x] = true
    for (const n of this.getNeighbors(startSquare.x, startSquare.y)) {
      if (startSquare.height >= n.height - 1 && n.knight === -1) { // move at most one up
        destinations.push(n)
        found[n.y * this._width + n.x] = true
      }
      if (startSquare.height < n.height) { // castle entrance
        prioQueue.push({ square: n, height: startSquare.height })
      }
    }
    let idx, current
    while (prioQueue.length) {
      current = prioQueue.pop()
      visited[current.square.y * this._width + current.square.x] = true
      for (const n of this.getNeighbors(current.square.x, current.square.y)) {
        idx = n.y * this._width + n.x
        if (!found[idx] && n.knight === -1 && current.height >= n.height) {
          destinations.push(n)
          found[idx] = true
        }
        if (!visited[idx] && n.height !== 0) {
          prioQueue.push({ square: n, height: n.height > current.height ? current.height : n.height - 1 })
        }
      }
    }
    return destinations
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

  canPlaceKing (x, y) {
    const square = this.getSquare(x, y)
    if (!square || square.knight !== -1 || square.castle === -1) return false
    return { square }
  }

  placeKing (square) {
    square.knight = 'king'
    this._kingsCastle = square.castle
  }

  removeKing () {
    const kingSquare = this.getKingSquare()
    if (kingSquare) {
      kingSquare.knight = -1
    }
    this._kingsCastle = null
  }

  getKingSquare () {
    return this._squares.find(square => square.knight === 'king')
  }

  evaluateBoard (playerId, phase) {
    const knightPositions = this._squares.filter(square => square.knight === playerId && square.height > 0)
    // find highest knight per castle
    const heightPerCastle = knightPositions.reduce((prev, square) => {
      if (!(square.castle in prev) || prev[square.castle] < square.height) {
        prev[square.castle] = square.height
      }
      return prev
    }, {})
    let score = Object.keys(heightPerCastle).reduce((prev, castleId) =>
      prev + heightPerCastle[castleId] * this._castleSizes[castleId], 0)
    // score for protecting king
    if (knightPositions.some(square => square.castle === this._kingsCastle && square.height === phase)) {
      score += phase * 5
    }
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
    let str = '<table width="400" height="400" border="1" >'
    for (let i = 0; i < this._squares.length; i++) {
      if (i % this._width === 0) {
        str += '<tr>'
      }
      const square = this._squares[i]
      let numCol
      if (square.knight === -1) {
        numCol = 'black'
      } else if (square.knight === 'king') {
        numCol = 'white'
      } else {
        numCol = this._colors[square.knight]
      }
      str += '<td align="center" style="background-color: ' + (square.height === 0
        ? 'white'
        : 'grey') +
        '; color: ' + numCol + '">' +
        square.height +
        '</td>'
      if (i % this._width === this._width - 1) {
        str += '</tr>'
      }
    }
    str += '</table>'
    return str
  }
}

export default Board
