// unused atm
const express = require('express')
const Player = require('../public/javascripts/player')
const router = express.Router()

const Torres = require('../public/javascripts/torres')
const torres = new Torres()
const player1 = new Player(torres, 0)
const player2 = new Player(torres, 1)

router.get('/', function (req, res) {
  res.send(torres.html())
})

router.get('/api', function (req, res) {
  res.send(torres.ascii())
})

router.post('/api', function (req, res) {
  let success = false
  console.log('Received action : ' + JSON.stringify(req.body))
  const player = req.body.player ? player2 : player1
  if (req.body.action === 'block') {
    success = player.placeBlock(req.body.x, req.body.y)
  } else if (req.body.action === 'knight') {
    success = player.placeKnight(req.body.x, req.body.y)
  } else if (req.body.action === 'move') {
    success = player.moveKnight(req.body.x, req.body.y, req.body.destX, req.body.destY)
  } else if (req.body.action === 'end') {
    success = player.endTurn()
  } else { console.log('unknown action') }
  console.log(success ? 'action performed' : 'action could not be performed')
  res.send(torres.ascii())
})

module.exports = router
