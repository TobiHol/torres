class Player {
  constructor (id, numKnights, apPerRound, blocksPerRound) {
    this.id = id

    this.numKnights = numKnights
    this.apPerRound = apPerRound
    this.blocksPerRound = blocksPerRound

    // turn based variables
    this.ap = apPerRound
    this.numBlocks = blocksPerRound

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
    if (this.numKnights < 1 || this.ap < 2) return false
    return true
  }

  moveKnight () {
    this.ap -= 1
  }

  endTurn () {
    this.points += this.ap // extra ap is automatically converted to points
    this.ap = this.apPerRound
    this.numBlocks = this.blocksPerRound
  }

  ascii () {
    return 'player: ' + this.id + '\tknights: ' + this.numKnights + '\tAP: ' + this.ap + '\tblocks: ' + this.numBlocks + '\n'
  }

  html () {
    return 'player: ' + this.id + '&emsp; knights: ' + this.numKnights + '&emsp; AP: ' + this.ap + '&emsp; blocks: ' + this.numBlocks + '<br/>'
  }
}

module.exports = Player
