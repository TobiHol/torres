const WebSocket = require('ws')
const events = require('events')

const ws = new WebSocket('ws://localhost:3000/')
const eventEmitter = new events.EventEmitter()

const myInfo = { id: null, legalMoves: [] }

// do stuff for own turn here.
eventEmitter.on('my_turn', () => {
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'move',
      data: {
        action: 'turn_end'
      }
    }))
  }, 3000)
})

eventEmitter.on('error', (data) => {
  onError(data.message)
})

eventEmitter.on('game_start', (data) => {
  console.log('game started')
  myInfo.id = data.your_player_id
  if (data.your_player_id === 0) {
    eventEmitter.emit('my_turn')
  }
})

eventEmitter.on('game_end', (data) => {
  console.log('game ended')
})

eventEmitter.on('move_update', (data) => {
  // TODO this check only work for two players
  if ((data.action === 'turn_end' && data.player === (1 - myInfo.id)) || (data.action !== 'turn_end' && data.player === myInfo.id)) {
    eventEmitter.emit('my_turn')
  }
})

ws.on('open', () => {
  console.log('connected')
})

ws.on('message', (message) => {
  console.log(message)
  try {
    const json = JSON.parse(message)
    eventEmitter.emit(json.type, json.data)
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

function onError (err) {
  console.log(err)
}
