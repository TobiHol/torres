const express = require('express')
const router = express.Router()

const Torres = require('../public/javascripts/torres')
const torres = new Torres(4)

router.get('/', function (req, res) {
  res.send(torres.html())
})

router.get('/api', function (req, res) {
  res.send(torres.ascii())
})

router.post('/api', function (req, res) {
  console.log('Received move : ' + JSON.stringify(req.body))
  torres.placeBlock(req.body.x, req.body.y)
  res.send(torres.ascii())
})

module.exports = router
