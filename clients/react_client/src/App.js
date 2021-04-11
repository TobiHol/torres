import React, { Component } from 'react';
import './App.css';
import './TorresGame.css';
import Game from './TorresGame.js';

class App extends Component {

  render() {
    return (
      <div className="App">
          <Game/>
      </div>
    );
  }
}

export default App;
