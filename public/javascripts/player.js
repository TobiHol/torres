class Player {
  constructor (game, id, numKnights = 5, ap = 5, numBlocks = 3) {
    this.game = game
    this.id = id
    game.addPlayer()

    this.numKnights = numKnights
    this.apPerTurn = ap
    this.numBlocksperTurn = numBlocks

    // turn based varriables
    this.ap = ap
    this.numBlocks = numBlocks

    // TODO: keep track of points?
    this.points = 0
  }

  placeBlock (x, y) {
    if (this.numBlocks > 0 && this.ap >= 1 && this.game.placeBlock(this.id, x, y)) {
      this.numBlocks--
      this.ap -= 1
      return true
    }
    return false
  }

  placeKnight (x, y) {
    if (this.numKnights > 0 && this.ap >= 2 && this.game.placeKnight(this.id, x, y)) {
      this.numKnights--
      this.ap -= 2
      return true
    }
    return false
  }

  moveKnight (x, y, destX, destY) {
    if (this.ap >= 1 && this.game.moveKnight(this.id, x, y, destX, destY)) {
      this.ap -= 1
      return true
    }
    return false
  }

  endTurn () {
    this.points += this.ap // extra ap is automatically converted to points
    this.ap = this.apPerTurn
    this.numBlocks = this.numBlocksperTurn
    return this.game.endTurn(this.id)
  }
}

module.exports = Player
