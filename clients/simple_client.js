const WebSocket = require('ws')
const events = require('events')

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new events.EventEmitter()

const myInfo = { id: null }

// do stuff for own turn here.
async function myMove () {
  const legalMoves = await new Promise(resolve => {
    send('status_request', ['legal_moves'])
    messageParser.once('legal_moves_response', (data) => resolve(data))
  })
  const randomAction = legalMoves[Math.floor(Math.random() * legalMoves.length)]
  if (randomAction) {
    send('move', randomAction)
  } else {
    send('move', { action: 'turn_end' })
  }
}

function send (type, data) {
  const message = {
    type: type,
    data: data
  }
  console.log('send:', message)
  ws.send(JSON.stringify(message))
}

function onError (err) {
  console.log(err)
}

messageParser.on('error', (data) => {
  onError(data.message)
})

messageParser.on('game_start', (data) => {
  console.log('game started')
  myInfo.id = data.your_player_id
  if (data.your_player_id === 0) {
    // messageParser.emit('my_turn')
    myMove()
  }
})

messageParser.on('game_end', (data) => {
  console.log('game ended')
})

messageParser.on('move_update', (data) => {
  // TODO this check only work for two players
  if ((data.action === 'turn_end' && data.player === (1 - myInfo.id)) || (data.action !== 'turn_end' && data.player === myInfo.id)) {
    // messageParser.emit('my_turn')
    myMove()
  }
})

messageParser.on('move_response', (data) => {
})

ws.on('open', () => {
  console.log('connected')
})

ws.on('message', (message) => {
  // console.log('received:', message.slice(0, 70))
  try {
    const json = JSON.parse(message)
    messageParser.emit(json.type, json.data)
  } catch (err) {
    onError('Cant parse message.')
  }
})

ws.on('error', (err) => {
  onError(err)
})

ws.on('close', (code, reason) => {
  console.log('disconnected', code, reason)
})
