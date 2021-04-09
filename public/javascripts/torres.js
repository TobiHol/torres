class Torres {
  constructor (numPlayers, apPerRound = 5, numKnights = 5, height = 10, width = 10) {
    this.height = height
    this.width = width
    this.numPlayers = numPlayers
    this.numKnights = numKnights
    this.apPerRound = apPerRound

    // generate board
    this.board = new Array(this.height)
    for (let i = 0; i < this.board.length; i++) {
      this.board[i] = new Array(this.width).fill(0)
    }
    // TODO: implement knights
  }

  placeBlock (x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return
    }
    this.board[y][x] += 1
  }

  sizeOfTower () {
    // TODO
    return 4
  }

  ascii () {
    let str = ''
    for (const row of this.board) {
      str += row.join(' ') + '\n'
    }
    return str
  }

  html () {
    let str = ''
    for (const row of this.board) {
      str += row.join(' ') + '<br/>'
    }
    return str
  }
}

module.exports = Torres
