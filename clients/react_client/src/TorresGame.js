import React from 'react';

const client = new WebSocket('ws://localhost:3000/');

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

  componentDidMount() {
    const events = require('events')
    // const Torres = require('./game/torres')

    const ws = client
    const messageParser = new events.EventEmitter()
    const _this = this

    // do stuff for own turn here.
    async function myMove () {
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
      if (data.your_player_id === 0) {
        myMove()
      }
    })

    messageParser.on('game_end', (data) => {
      console.log('game ended')
    })

    messageParser.on('move_update', (data) => {
      if ((data.next_player === this.myInfo.id)) {
        myMove()
      }
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

  constructor(props) {
    super(props);
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
    };
  }
  
  handleClick(i) {
    let board = this.state.torres._board
    let x = i % board._width
    let y = Math.floor(i / board._width)
    let myMove = this.state.move
    if (board._board[myMove.x + myMove.y * board._width].knight !== this.myInfo.id || myMove.destX !== null) {
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

    let height = board._board[i].height
    let borderColor = 'black'
    let borderWidth = '1px'
    if ((move.x + move.y * board._width === i && move.x !== null) || (move.destX + move.destY * board._width === i && move.destX !== null)) {
      borderColor = 'red'
      borderWidth = '2px'
    }
    let style = {
      'color': board._colors[board._board[i].knight + 1],
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
    for (let i = 0; i < board._board.length; i++) {
      if (i % board._width === 0) {
        res.push(<div className="board-row"/>)
      }
      res.push(this.renderSquare(i))
    }
    return res
  }

  renderLegalMoves(){
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
    let res = ['Players:', <br/>]
    let players = this.state.torres._Players
    players.forEach(player => {
      res.push(`ID: ${player._id} Points: ${player._points} AP: ${player._ap} Knights: ${player._numKnights} Blocks: ${player._numBlocks}`)
      res.push(<br/>)
    });
    return res
  }

  render() {
    let torres = this.state.torres
    if (torres === null ) {
      return (
        'Loading'
      )
    }
    return (
      <div className='game'>
        <div>
          Phase: {torres._phase}/{torres._numPhases}
          <br/>
          Round: {torres._round}/{torres._numRoundsPerPhase[torres._phase]}
          <br/>
          <br/>
          Starting Player: {torres._startingPlayer}
          <br/>
          Active Player: {torres._activePlayer}
          <br/>
          <br/>
          {this.renderPlayerTable()}
          <br/>
          
        </div>
        <div>
          {this.renderAllSquares()}
        </div>
        <div>
          {JSON.stringify(this.state.move)}
        </div>
        <div>
          {this.renderLegalMoves()}
        </div>
      </div>
    )
  }
}

// ========================================

// ReactDOM.render(
//   <Game />,
//   document.getElementById('root')
// );

export default Game;
