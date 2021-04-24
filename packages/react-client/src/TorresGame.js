import React from 'react'

const host = window.location.hostname
const client = new WebSocket(`ws://${host}:3000/`)

function Square(props) {
  return (
    <button className='square' onClick={props.onClick} style={props.style}>
      {props.value}
    </button>
  )
}

function Button(props) {
  return (
    <button onClick={props.onClick}>
      {props.value}
    </button>
  )
}

class Game extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      playerInfo: null,
      torres: null,
      legalMoves: [],
      move: {
        action: null,
        x: null,
        y: null,
        destX: null,
        destY: null
      },
    }
  }

  componentDidMount() {
    const events = require('events')

    const ws = client
    const messageParser = new events.EventEmitter()
    const _this = this

    // do stuff for own turn here.
    async function update () {
      const playerInfo = await new Promise(resolve => {
        _this.send('status_request', ['player_info'])
        messageParser.once('player_info_response', (data) => resolve(data))
      })
      const torresNoInstance = await new Promise(resolve => {
        _this.send('status_request', ['game_state'])
        messageParser.once('game_state_response', (data) => resolve(data))
      })
      const legalMoves = await new Promise(resolve => {
        _this.send('status_request', ['legal_moves'])
        messageParser.once('legal_moves_response', (data) => resolve(data))
      })
      _this.setState({
        playerInfo: playerInfo,
        torres: torresNoInstance,
        legalMoves: legalMoves,
      })
    }

    this.send = function(type, data) {
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
      _this.setState({
        id: data.your_player_id
      })
      update()
    })

    messageParser.on('game_end', (data) => {
      console.log('game ended')
      update()
    })

    messageParser.on('move_update', (data) => {
      update()
    })

    messageParser.on('move_response', (data) => {
    })

    messageParser.on('player_connect', (data) => {
      update()
      this.send('info', {
        type: 'player'
      })
    })

    messageParser.on('player_disconnect', (data) => {
      update()
    })

    ws.onopen = () => {
      console.log('connected')
      update()
    }

    ws.onmessage = (message) => {
      try {
        const json = JSON.parse(message.data)
        messageParser.emit(json.type, json.data)
      } catch (err) {
        onError(`Cant parse message. ${err}`)
      }
    }

    ws.onerror = (err) => {
      onError(err)
    }

    ws.onclose = (code, reason) => {
      console.log('disconnected', code, reason)
    }
  }
  
  handleClick(i) {
    let board = this.state.torres._board
    let x = i % board._width
    let y = Math.floor(i / board._width)
    let myMove = this.state.move
    if (board._squares[myMove.x + myMove.y * board._width].knight !== this.state.playerInfo.id || myMove.destX !== null) {
      this.setState({
        move: {
          ...this.state.move,
          x: x,
          y: y,
          destX: null,
          destY: null,
        }
      })
    } else {
      this.setState({
        move: {
          ...this.state.move,
          destX: x,
          destY: y,
        }
      })
    }
  }

  renderSquare(i) {
    let move = this.state.move
    let board = this.state.torres._board

    let height = board._squares[i].height
    let knight = board._squares[i].knight
    let numCol
    if (knight === -1) {
      numCol = 'black'
    } else if (knight === 'king') {
      numCol = 'white'
    } else {
      numCol = this.state.torres._playerColors[knight]
    }
    let borderColor = 'black'
    let borderWidth = '1px'
    if ((move.x + move.y * board._width === i && move.x !== null) || (move.destX + move.destY * board._width === i && move.destX !== null)) {
      borderColor = 'red'
      borderWidth = '2px'
    }
    let style = {
      'color': numCol,
      'backgroundColor': height > 0 ? 'grey' : 'white',
      'borderColor': borderColor,
      'borderWidth': borderWidth
    }
    return (
      <Square
        value={JSON.stringify(height)}
        onClick={() => this.handleClick(i)}
        style={style}
      />
    )
  }

  renderAllSquares(){
    let res = []
    let board = this.state.torres._board
    for (let i = 0; i < board._squares.length; i++) {
      if (i % board._width === 0) {
        res.push(<div />)
      }
      res.push(this.renderSquare(i))
    }
    return res
  }

  renderMove (move) {
    const start = move.x || move.x === 0 ? ': (' + move.x + ',' + move.y + ')' : ''
    const dest = move.destX || move.destX === 0 ? ' -> (' + move.destX + ',' + move.destY + ')' : ''
    const action = move.action.split('_')
    return action[1] + ' ' + action[0] + start + dest
  }

  renderLegalMoves(){
    if (!this.state.torres._gameRunning) {
      return 'game is not running'
    }
    if (this.state.torres._activePlayer !== this.state.playerInfo.id) {
      return 'not your turn'
    }
    let myMove = this.state.move
    let legalMoves = this.state.legalMoves
    let renderedMoves = []
    legalMoves.forEach(move => {
      if ((move.action !== 'turn_end' && move.action !== null) && (myMove.x !== move.x || myMove.y !== move.y)){

      } else if (move.action === 'knight_move' && (myMove.destX !== move.destX || myMove.destY !== move.destY) && (myMove.destX !== null)) {

      } else {
        renderedMoves.push(
          <Button
            value={this.renderMove(move)}
            onClick={() => {
              this.send('move', move)
              this.setState({
                move: {
                  action: null,
                  x: null,
                  y: null,
                  destX: null,
                  destY: null
                }
              })
            }}
           />
          )
      }
    })
    return renderedMoves
  }

  renderPlayerTable(){
    let torres = this.state.torres
    let header = (
      <tr>
        <th>Turn</th>
        <th>Player</th>
        <th>ID</th>
        <th>Status</th>
        <th>Type</th>
        <th>AP</th>
        <th>Blocks</th>
        <th>Knights</th>
        <th>Points</th>
      </tr>
    )
    let data = []
    let i = torres._startingPlayer === -1 ? 0 : torres._startingPlayer
    while (true) {
      const {_id, _color, _numKnights, _ap, _numBlocks, _points} = torres._playerList[i]
      data.push(
        <tr key={_id}>
          <td>{torres._gameRunning && torres._activePlayer === _id ? '>' : ''}</td>
          <td><span style={{color:_color}}>▲</span></td>
          <td>{_id}</td>
          <td>{this.state.playerInfo.player_status[_id]}</td>
          <td>{this.state.playerInfo.player_type[_id]}</td>
          <td>{_ap}</td>
          <td>{_numBlocks}</td>
          <td>{_numKnights}</td>
          <td>{_points}</td>
        </tr>
      )
      i = (i + 1) % torres._numPlayers
      if (i === torres._startingPlayer || (torres._startingPlayer === -1 && i === 0)) {
        break
      }
    }
    return (
      <div>
        {/* <h3 id='title'>Player Table</h3> */}
        <table className='player-table' id='players'>
          <tbody>
            {header}
            {data}
          </tbody>
        </table>
      </div>
    )
  }

  renderGameInfo(){
    const torres = this.state.torres
    const gameInfo = []
    if (this.state.playerInfo.id === -1) {
      gameInfo.push(
        <div>
          You are observer <span style={{color:'black'}}>▲</span>
        </div>
      )
    }else{
      gameInfo.push(
        <div>
          You are the {torres._playerColors[this.state.playerInfo.id]} player <span style={{color:torres._playerColors[this.state.playerInfo.id]}}>▲</span>
        </div>
      )
    }
    gameInfo.push(<br/>)
    gameInfo.push(
      <div>
        Phase: {torres._gameRunning ? torres._phase + '/' + torres._numPhases : '-'}
      </div>
    )
    gameInfo.push(
      <div>
        Round: {torres._gameRunning ? torres._round + '/' + (torres._phase === 0 ? 0 : torres._numRoundsPerPhase[torres._phase-1]) : '-'}
      </div>
    )
    return gameInfo
  }

  renderGameOptions(){
    let options = []
    if (this.state.torres._gameRunning) {
      options.push(
      <Button
        value='End Game'
        onClick={() => {
          this.send('command', ['game_reset'])
        }}
        />
      )
      options.push(
        <Button
          value='Restart Game'
          onClick={() => {
            this.send('command', ['game_reset', 'game_init'])
          }}
          />
      )
    } else {
      options.push(
        <Button
          value='Start Game'
          onClick={() => {
            this.send('command', ['game_reset', 'game_init'])
          }}
          />
      )
    }
    options.push(<div/>)
    if (this.state.playerInfo.id === -1) {
      options.push(
        <Button
          value='Join Game'
          onClick={() => {
            this.send('command', ['game_join'])
          }}
          />
      )
    } else {
      options.push(
        <Button
          value='Leave Game'
          onClick={() => {
            this.send('command', ['game_leave'])
          }}
          />
      )
    }
    return options
  }

  render() {
    let torres = this.state.torres
    if (torres === null ) {
      return (
        'No torres server found. \n Refresh the site after starting the server.'
      )
    }
    return (
      <div className='game'>
        <div className='game-options'>
          {this.renderGameOptions()}
        </div>
        <div className='game-info'>
          {this.renderGameInfo()}
          <br/>
          {this.renderPlayerTable()}
        </div>
        <br/>
        <div className='game-board'>
          {this.renderAllSquares()}
        </div>
        <div className='game-action'>
          {this.renderLegalMoves()}
        </div>
      </div>
    )
  }
}

export default Game
