class Player {
  constructor (id, numKnights, apPerRound, blocksPerRound) {
    this.id = id

    this.numKnights = numKnights
    this.apPerRound = apPerRound
    this.blocksPerRound = blocksPerRound
    this.blockIdx = 0

    // turn based variables
    this.ap = apPerRound
    this.numBlocks = blocksPerRound[this.blockIdx]

    // TODO: keep track of points?
    this.points = 0
  }

  canPlaceBlock () {
    if (this.numBlocks < 1 || this.ap < 1) return false
    return true
  }

  placeBlock () {
    this.numBlocks--
    this.ap -= 1
  }

  canPlaceKnight () {
    if (this.numKnights < 1 || this.ap < 2) return false
    return true
  }

  placeKnight () {
    this.numKnights--
    this.ap -= 2
  }

  canMoveKnight () {
    if (this.ap < 1) return false
    return true
  }

  moveKnight () {
    this.ap -= 1
  }

  endTurn () {
    this.points += this.ap // extra ap is automatically converted to points
    this.ap = this.apPerRound
    this.blockIdx++
    this.numBlocks = this.blocksPerRound[this.blockIdx]
  }

  ascii (phase) {
    let str = 'ID: ' + this.id
    if (phase > 0) {
      str += '\tAP: ' + this.ap + '\tKnights: ' + this.numKnights + '\tBlocks: ' + this.numBlocks
    }
    str += '\n'
    return str
  }

  html (phase) {
    let str = 'ID: ' + this.id
    if (phase > 0) {
      str += '&emsp; AP: ' + this.ap + '&emsp; Knights: ' + this.numKnights + '&emsp; Blocks: ' + this.numBlocks
    }
    str += '<br/>'
    return str
  }
}

module.exports = Player
