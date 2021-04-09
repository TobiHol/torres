// unused atm
const express = require('express')
const router = express.Router()

router.get('/', function (req, res) {
  res.send(torres.html())
})

router.get('/api', function (req, res) {
  res.send(torres.ascii())
})

router.post('/api', function (req, res) {
  console.log('Received move : ' + JSON.stringify(req.body))
  torres.placeBlock(req.body.x, req.body.y)
  res.json(req.body)
})

module.exports = router
