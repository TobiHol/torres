const express = require('express')
const logger = require('morgan')
const app = express()
const WebSocket = require('ws')
const wss = new WebSocket.Server({ noServer: true })
const port = process.env.PORT || 3000

// const indexRouter = require('./routes/index')
// const usersRouter = require('./routes/users')

app.use(express.json())
app.use(logger('dev'))

// app.use('/', indexRouter)
// app.use('/users', usersRouter)

// init game
const Torres = require('./public/javascripts/torres')
const torres = new Torres()
const numPlayers = 2

// express API
app.get('/', function (req, res) {
  res.send(torres.html())
})

app.get('/api', function (req, res) {
  res.send(torres.ascii())
})

app.post('/api', function (req, res) {
  console.log('Received move : ' + JSON.stringify(req.body))
  torres.placeBlock(req.body.x, req.body.y)
  res.json(req.body)
})

// websocket API
wss.on('connection', (ws) => {
  if (wss.clients.size > numPlayers) {
    ws.send(`Already ${numPlayers} players connected.`)
    ws.close()
    return
  }
  if (wss.clients.size === numPlayers) {
    wss.clients.forEach(function each (client) {
      client.send('GAME START')
    })
  }
  ws.on('message', (data) => {
    console.log('received:', data)
    const json = JSON.parse(data)
    torres.placeBlock(json.x, json.y)
    ws.send(data)
    wss.clients.forEach(function each (client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })
  })
})

// create express server
const server = app.listen(port, () => {
  console.log(`torres server listening at http://localhost:${port}`)
})

// setup websocket on server
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, socket => {
    wss.emit('connection', socket, request)
  })
})
