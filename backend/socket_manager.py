import socketio
import time
import logging

logger = logging.getLogger("kmti_backend")

# Shared Socket.IO server instance for the entire backend
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)

# Map: sid -> username (populated on connect when client sends their username)
_sid_to_user: dict[str, str] = {}


async def broadcast_mutation(target: str, action: str, data: dict, exclude_sid: str = None):
    """
    Broadcasts a database mutation event to all active clients except the initiator.
    """
    payload = {
        "target": target,
        "action": action,
        "data": data,
        "timestamp": int(time.time() * 1000)
    }
    try:
        await sio.emit("db_mutation", payload, skip_sid=exclude_sid)
        logger.info(f"[SocketManager] Broadcasted {target}:{action} (skip_sid={exclude_sid})")
    except Exception as e:
        logger.error(f"[SocketManager] Failed to broadcast mutation event: {e}")

async def emit_to_user(username: str, event: str, data: dict):
    """Emit an event only to the specific user's room."""
    room = f'user:{username}'
    await sio.emit(event, data, room=room)
    logger.info(f"[SocketManager] Emitted {event} to room {room}")
