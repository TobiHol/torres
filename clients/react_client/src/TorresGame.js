import React from 'react';

const host = window.location.hostname
const client = new WebSocket(`ws://${host}:3000/`);

function Square(props) {
  return (
    <button className='square' onClick={props.onClick} style={props.style}>
      {props.value}
    </button>
  );
}

function Button(props) {
  return (
    <button onClick={props.onClick}>
      {props.value}
    </button>
  );
}

class Game extends React.Component {

  constructor(props) {
    super(props)
    this.myInfo = { id: null }
    this.state = {
      torres: null,
      legalMoves: [],
      move: {
        action: null,
        x: null,
        y: null,
        destX: null,
        destY: null
      }
    }
  }

  componentDidMount() {
    const events = require('events')

    const ws = client
    const messageParser = new events.EventEmitter()
    const _this = this

    // do stuff for own turn here.
    async function update () {
      const torresNoInstance = await new Promise(resolve => {
        _this.send('status_request', ['game_state'])
        messageParser.once('game_state_response', (data) => resolve(data))
      })
      const legalMoves = await new Promise(resolve => {
        _this.send('status_request', ['legal_moves'])
        messageParser.once('legal_moves_response', (data) => resolve(data))
      })
      _this.setState({
        torres: torresNoInstance,
        legalMoves:legalMoves
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
      this.myInfo.id = data.your_player_id
      update()
    })

    messageParser.on('game_end', (data) => {
      console.log('game ended')
    })

    messageParser.on('move_update', (data) => {
      update()
    })

    messageParser.on('move_response', (data) => {
    })

    ws.onopen = () => {
      console.log('connected')
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
    if (board._squares[myMove.x + myMove.y * board._width].knight !== this.myInfo.id || myMove.destX !== null) {
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
    let borderColor = 'black'
    let borderWidth = '1px'
    if ((move.x + move.y * board._width === i && move.x !== null) || (move.destX + move.destY * board._width === i && move.destX !== null)) {
      borderColor = 'red'
      borderWidth = '2px'
    }
    let style = {
      'color': (knight === -1 ? 'black' : this.state.torres._playerColors[knight]),
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
    );
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

  renderLegalMoves(){
    if (!this.state.torres._gameRunning) {
      return 'game is not running'
    }
    if (this.state.torres._activePlayer !== this.myInfo.id) {
      return "not your turn"
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
            value={JSON.stringify(move)}
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
    });
    return renderedMoves
  }

  renderPlayerTable(){
    let torres = this.state.torres
    let header = (
      <tr>
        <th>Turn</th>
        <th>Player</th>
        <th>ID</th>
        <th>AI</th>
        <th>AP</th>
        <th>Blocks</th>
        <th>Knights</th>
        <th>Points</th>
      </tr>
    )
    let data = torres._playerList.map(player => {
      const {_id, _ai, _color, _numKnights, _ap, _numBlocks, _points} = player
      return (
        <tr key={_id}>
          <td>{torres._activePlayer === _id ? '>' : ''}</td>
          {/* <td style={{'backgroundColor':colors[_id+1]}}></td> */}
          <td><span style={{color:_color}}>▲</span></td>
          <td>{_id}</td>
          <td>{_ai}</td>
          <td>{_ap}</td>
          <td>{_numBlocks}</td>
          <td>{_numKnights}</td>
          <td>{_points}</td>
        </tr>
      )
    })
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
    let torres = this.state.torres
    return(
      <div>
        You are the {torres._playerColors[this.myInfo.id]} Player <span style={{color:torres._playerColors[this.myInfo.id]}}>▲</span> (ID: {this.myInfo.id})
        <br/>
        <br/>
        Phase: {torres._phase}/{torres._numPhases}
        <br/>
        Round: {torres._round}/{torres._phase === 0 ? 0 : torres._numRoundsPerPhase[torres._phase-1]}
        <br/>
      </div>
    )
  }

  render() {
    let torres = this.state.torres
    if (torres === null ) {
      return (
        'Waiting'
      )
    }
    return (
      <div className='game'>
        <div className='game-info'>
          {this.renderGameInfo()}
          <br/>
          {this.renderPlayerTable()}
        </div>
        <div className='game-board'>
          {this.renderAllSquares()}
        </div>
        <div className='game-action'>
          {JSON.stringify(this.state.move)}
          <br/>
          {this.renderLegalMoves()}
        </div>
      </div>
    )
  }
}

export default Game;
