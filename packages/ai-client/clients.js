/* eslint-disable no-unused-vars */
import { AiClient } from './src/ai_client.js'
import { MctsClient } from './src/mcts_client.js'
import { MinimaxClient } from './src/minimax_client.js'
import { OepClient } from './src/oep_client.js'
import { BfsClient } from './src/bfs_client.js'

/* eslint-disable no-new */
new BfsClient({})
new MctsClient({})
new MinimaxClient({})
new OepClient({})
