import socketio

# Shared Socket.IO server instance for the entire backend
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)
