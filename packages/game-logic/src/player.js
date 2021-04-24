class Player {
  constructor ({ id, color, numKnights, apPerRound, blocksPerRound }) {
    this._id = id
    this._color = color

    this._apPerRound = apPerRound
    this._blocksPerRound = blocksPerRound

    this._numKnights = numKnights
    // turn based variables
    this._ap = apPerRound
    this._numBlocks = blocksPerRound[0]

    this._points = 0
  }

  get id () {
    return this._id
  }

  get color () {
    return this._color
  }

  get points () {
    return this._points
  }

  get ap () {
    return this._ap
  }

  get numBlocks () {
    return this._numBlocks
  }

  resetAttributesTo ({ points, ap, numBlocks }) {
    this._points = points
    this._ap = ap
    this._numBlocks = numBlocks
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

  placeBlockUndo () {
    this._numBlocks++
    this._ap += 1
  }

  canPlaceKnight () {
    if (this._numKnights < 1 || this._ap < 2) return false
    return true
  }

  placeKnight () {
    this._numKnights--
    this._ap -= 2
  }

  placeKnightUndo () {
    this._numKnights++
    this._ap += 2
  }

  canMoveKnight () {
    if (this._ap < 1) return false
    return true
  }

  moveKnight () {
    this._ap -= 1
  }

  moveKnightUndo () {
    this._ap += 1
  }

  endTurn () {
    this._points += this._ap // extra ap is automatically converted to points
    this._ap = 0
  }

  endRound (absRound) {
    this._ap = this._apPerRound
    this._numBlocks = this._blocksPerRound[absRound]
  }

  ascii (gameRunning, phase) {
    let str = 'ID: ' + this._id + '\tPoints: ' + this._points
    if (gameRunning && phase > 0) {
      str += '\tAP: ' + this._ap + '\tKnights: ' + this._numKnights + '\tBlocks: ' + this._numBlocks
    }
    str += '\n'
    return str
  }

  tableEntry (content, turnBasedOn = true) {
    return '<td style="width:10%; text-align:center">' + (turnBasedOn ? content : '') + '</td>'
  }

  html (gameRunning, phase, activePlayer) {
    const turnBasedOn = gameRunning && phase > 0
    let str = '<tr>'
    str += this.tableEntry(activePlayer === this._id ? '>' : '')
    str += this.tableEntry('<span style="color:' + this._color + '">▲</span> ')
    str += this.tableEntry(this._id)
    str += this.tableEntry(this._ap, turnBasedOn)
    str += this.tableEntry(this._numBlocks, turnBasedOn)
    str += this.tableEntry(this._numKnights, turnBasedOn)
    str += this.tableEntry(this._points)
    str += '</tr>'
    return str
  }
}

export default Player
