class Player {
  constructor (id, numKnights, apPerRound, blocksPerRound) {
    this._id = id

    // TODO: don't store here?
    this._numKnights = numKnights

    this.apPerRound = apPerRound
    this.blocksPerRound = blocksPerRound

    this._absRound = 0

    // turn based variables
    this._ap = apPerRound
    this._numBlocks = blocksPerRound[this._absRound]

    this._points = 0
  }

  get id () {
    return this._id
  }

  get points () {
    return this._points
  }

  addPoints (points) {
    this._points += points
  }

  canPlaceBlock () {
    if (this._numBlocks < 1 || this._ap < 1) return false
    return true
  }

  placeBlock () {
    this._numBlocks--
    this._ap -= 1
  }

  canPlaceKnight () {
    if (this._numKnights < 1 || this._ap < 2) return false
    return true
  }

  placeKnight () {
    this._numKnights--
    this._ap -= 2
  }

  canMoveKnight () {
    if (this._ap < 1) return false
    return true
  }

  moveKnight () {
    this._ap -= 1
  }

  endTurn () {
    this._points += this._ap // extra ap is automatically converted to points
    this._ap = 0
  }

  endRound () {
    this._ap = this.apPerRound
    this._absRound++
    this._numBlocks = this.blocksPerRound[this._absRound]
  }

  ascii (gameRunning, phase) {
    let str = 'ID: ' + this._id + '\tPoints: ' + this._points
    if (gameRunning && phase > 0) {
      str += '\tAP: ' + this._ap + '\tKnights: ' + this._numKnights + '\tBlocks: ' + this._numBlocks
    }
    str += '\n'
    return str
  }

  html (gameRunning, phase) {
    let str = 'ID: ' + this._id + '&emsp; Points: ' + this._points
    if (gameRunning && phase > 0) {
      str += '&emsp; AP: ' + this._ap + '&emsp; Knights: ' + this._numKnights + '&emsp; Blocks: ' + this._numBlocks
    }
    str += '<br/>'
    return str
  }
}

module.exports = Player
