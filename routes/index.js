// unused atm
const express = require('express')
const router = express.Router()

const Torres = require('../public/javascripts/torres')
const torres = new Torres()

router.get('/', function (req, res) {
  res.send(torres.html())
})

router.get('/api', function (req, res) {
  res.send(torres.ascii())
})

router.post('/api', function (req, res) {
  let success = false
  console.log('Received action : ' + JSON.stringify(req.body))
  if (req.body.action === 'init') {
    success = torres.initGame()
  } else if (req.body.action === 'reset') {
    success = torres.resetGame()
  } else if (req.body.action === 'block') {
    success = torres.placeBlock(req.body.player, req.body.x, req.body.y)
  } else if (req.body.action === 'knight') {
    success = torres.placeKnight(req.body.player, req.body.x, req.body.y)
  } else if (req.body.action === 'move') {
    success = torres.moveKnight(req.body.player, req.body.x, req.body.y, req.body.destX, req.body.destY)
  } else if (req.body.action === 'end') {
    success = torres.endTurn(req.body.player)
  } else { console.log('unknown action') }
  console.log(success ? 'action performed' : 'action could not be performed')
  res.send(torres.ascii())
})

module.exports = router
