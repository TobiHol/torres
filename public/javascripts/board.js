class Board {
  constructor (height = 8, width = 8, numCastles = 8) {
    this.height = height
    this.width = width
    this.numCastles = numCastles
    this.castleSizes = new Array(numCastles)

    this.colors = ['black', 'red', 'blue', 'green', 'orange'] // TODO

    // generate board
    this.board = new Array(this.height * this.width).fill().map(x => (
      {
        castle: -1, // id of castle or -1
        height: 0,
        knight: -1 // player id of knight or -1
      }))
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

  placeBlock (square, castleId) {
    square.height += 1
    square.castle = castleId
    if (square.height === 1) {
      this.castleSizes[castleId] += 1
    }
  }

  placeKnight (square, playerId) {
    square.knight = playerId
  }

  moveKnight (startSquare, destSquare, playerId) {
    startSquare.knight = -1
    destSquare.knight = playerId
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

module.exports = Board
