import websocket
import json
import threading
import time

# websocket.enableTrace(True)

game_on = False
my_turn = False
my_player_id = None


def on_message(ws, message):
    global my_player_id, game_on, my_turn
    print(message)
    try:
        on_json(ws, json.loads(message))
    except ValueError:
        print('Cant parse message')


def on_json(ws, message):
    global my_player_id, game_on, my_turn
    if message['type'] == 'error':
        on_error(message['data']['message'])
    elif message['type'] == 'game_start':
        on_game_start(ws, message['data'])
    elif message['type'] == 'game_end':
        on_game_end(ws, message['data'])
    elif message['type'] == 'move_update':
        on_move_update(ws, message['data'])


def on_game_start(ws, data):
    global my_player_id, game_on, my_turn
    my_player_id = data['your_player_id']
    game_on = True
    my_turn = (my_player_id == 0)


def on_game_end(ws, data):
    global my_player_id, game_on, my_turn
    game_on = False


def on_move_update(ws, data):
    global my_player_id, game_on, my_turn
    if data['action'] == 'turn_end':
        # TODO this only works for inorder rounds
        my_turn = my_player_id == (data['player'] - 1) % 2 

def on_error(ws, error):
    global my_player_id, game_on, my_turn
    print(error)


def on_close(ws):
    global my_player_id, game_on, my_turn
    print("### closed ###")


def on_open(ws):
    def run(*args):
        global my_player_id, game_on, my_turn

        interval = 1
        # wait for game to start
        while not game_on:
            time.sleep(interval)
        # run game loop
        while game_on:
            time.sleep(interval)
            if my_turn:
                on_turn(ws)
        ws.close()
        print("thread terminating...")
    threading.Thread(target=run).start()


def on_turn(ws):
    ws.send(json.dumps({
        'type': 'move',
        'data': {
            'action': 'turn_end'
        }
    }))

ws = websocket.WebSocketApp("ws://localhost:3000/",
                            on_open=on_open,
                            on_message=on_message,
                            on_error=on_error,
                            on_close=on_close)

ws.run_forever()