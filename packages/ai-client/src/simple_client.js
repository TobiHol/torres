import WebSocket from 'ws'
import { EventEmitter } from 'events'
import Torres from '../../game-logic/src/torres.js'

const ws = new WebSocket('ws://localhost:3000/')
const messageParser = new EventEmitter()

const myInfo = {
  type: 'random_ai',
  playerInfo: null,
  torres: null
}

async function myMove () {
  const torres = myInfo.torres
  const legalMoves = torres.getLegalMoves(torres._activePlayer)
  const randomAction = legalMoves[Math.floor(Math.random() * legalMoves.length)]
  await new Promise(resolve => setTimeout(resolve, 100))
  if (randomAction) {
    send('move', randomAction)
  } else {
    send('move', { action: 'turn_end' })
  }
}

async function update (updatePI = true) {
  if (updatePI) {
    myInfo.playerInfo = await new Promise(resolve => {
      send('status_request', ['player_info'])
      messageParser.once('player_info_response', (data) => resolve(data))
    })
  }
  const torres = await new Promise(resolve => {
    send('status_request', ['game_state'])
    messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
  })
  myInfo.torres = torres
  if (torres.activePlayer === myInfo.playerInfo.id && torres.gameRunning) {
    myMove()
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
  update()
})

messageParser.on('game_end', (data) => {
  console.log('game ended')
  update()
})

messageParser.on('move_update', (data) => {
  if (data.next_player === myInfo.playerInfo.id) {
    update(false)
  }
})

messageParser.on('move_response', (data) => {
})

messageParser.on('player_connect', (data) => {
  update()
  send('info', {
    type: myInfo.type
  })
})

messageParser.on('player_disconnect', (data) => {
  update()
})

ws.on('open', () => {
  console.log('connected')
  send('command', ['game_join'])
})

ws.on('message', (message) => {
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
