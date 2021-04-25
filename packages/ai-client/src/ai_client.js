import { EventEmitter } from 'events'
import WebSocket from 'ws'

import { Torres } from '../../game-logic/index.js'

class AiClient {
  constructor () {
    this.ws = new WebSocket('ws://localhost:3000/')
    this.messageParser = new EventEmitter()

    this.myInfo = {
      type: 'random_ai',
      playerInfo: null,
      torres: null
    }

    this.messageParser.on('error', (data) => {
      this.onError(data.message)
    })

    this.messageParser.on('game_start', (data) => {
      console.log('game started')
      this.update()
    })

    this.messageParser.on('game_end', (data) => {
      console.log('game ended')
      this.update()
    })

    this.messageParser.on('move_update', (data) => {
      if (data.next_player === this.myInfo.playerInfo.id) {
        this.update(false)
      }
    })

    this.messageParser.on('move_response', (data) => {
    })

    this.messageParser.on('player_connect', (data) => {
      this.update()
      this.send('info', {
        type: this.myInfo.type
      })
    })

    this.messageParser.on('player_disconnect', (data) => {
      this.update()
    })

    this.ws.on('open', () => {
      console.log('connected')
      this.send('command', ['game_join'])
    })

    this.ws.on('message', (message) => {
      try {
        const json = JSON.parse(message)
        this.messageParser.emit(json.type, json.data)
      } catch (err) {
        this.onError('Cant parse message.')
      }
    })

    this.ws.on('error', (err) => {
      this.onError(err)
    })

    this.ws.on('close', (code, reason) => {
      console.log('disconnected', code, reason)
    })
  }

  myMove () {
    const torres = this.myInfo.torres
    const legalMoves = torres.getLegalMoves(torres._activePlayer)
    const randomAction = legalMoves[Math.floor(Math.random() * legalMoves.length)]
    // await new Promise(resolve => setTimeout(resolve, 100))
    if (randomAction) {
      this.send('move', randomAction)
    } else {
      this.send('move', { action: 'turn_end' })
    }
  }

  async update (updatePI = true) {
    if (updatePI) {
      this.myInfo.playerInfo = await new Promise(resolve => {
        this.send('status_request', ['player_info'])
        this.messageParser.once('player_info_response', (data) => resolve(data))
      })
    }
    const torres = await new Promise(resolve => {
      this.send('status_request', ['game_state'])
      this.messageParser.once('game_state_response', (data) => resolve(Torres.assignInstances(data)))
    })
    this.myInfo.torres = torres
    if (torres.activePlayer === this.myInfo.playerInfo.id && torres.gameRunning) {
      this.myMove()
    }
  }

  send (type, data) {
    const message = {
      type: type,
      data: data
    }
    console.log('send:', message)
    this.ws.send(JSON.stringify(message))
  }

  onError (err) {
    console.log(err)
  }
}

function cloneTorres (torres) {
  return Torres.assignInstances(JSON.parse(JSON.stringify(torres)))
}

export { AiClient, cloneTorres }
