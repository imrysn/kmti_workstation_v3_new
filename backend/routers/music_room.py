import time
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any
from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from socket_manager import sio

logger = logging.getLogger("kmti_backend")
router = APIRouter()

# Shared executor for blocking yt-dlp calls
_yt_executor = ThreadPoolExecutor(max_workers=2)


@router.get("/youtube/resolve")
async def resolve_youtube_url(url: str = Query(..., description="YouTube or YouTube Music URL")):
    """
    Extract a direct audio stream URL from a YouTube/YouTube Music link using yt-dlp.
    The returned audioUrl is a signed Google CDN URL valid for ~6 hours.
    Runs in a thread pool to avoid blocking the async event loop.
    """
    def _extract_info(youtube_url: str) -> dict:
        try:
            import yt_dlp
        except ImportError:
            raise RuntimeError("yt-dlp is not installed. Run: pip install yt-dlp")

        ydl_opts = {
            # Prefer WebM/Opus (best Chromium/Electron support), fallback to m4a
            'format': 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            return {
                'audioUrl': info['url'],
                'title': info.get('title', 'YouTube Audio'),
                'duration': info.get('duration', 0),
                'ext': info.get('ext', 'webm'),
            }

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_yt_executor, _extract_info, url)
        logger.info(f"[YouTubeResolve] Resolved: '{result['title']}' ({result['ext']}, {result['duration']}s)")
        return {'success': True, **result}
    except Exception as e:
        logger.error(f"[YouTubeResolve] Failed for {url}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/proxy")
async def proxy_audio_stream(url: str = Query(..., description="Audio stream URL to proxy"), request: Request = None):
    """
    Proxy an external audio stream through the local server.
    Resolves redirects and streams bytes back so Electron can play any
    public internet radio or MP3 stream via localhost (which is CSP-trusted).
    Forwards Range headers so YouTube CDN seeking works correctly.
    """
    import httpx

    # Forward Range header if present (needed for YouTube CDN partial-content seeking)
    range_header = request.headers.get("range", "") if request else ""

    STREAM_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "audio/*, */*",
        "Icy-MetaData": "0",
    }
    if range_header:
        STREAM_HEADERS["Range"] = range_header

    async def stream_generator():
        """
        Generator that owns the full lifecycle of the httpx client.
        Both the client and the streaming response are held open for as long
        as the caller is consuming bytes — the 'async with' blocks guarantee
        this even if the client disconnects mid-stream.
        """
        try:
            async with httpx.AsyncClient(
                follow_redirects=True,
                timeout=httpx.Timeout(connect=10.0, read=None, write=None, pool=None),
            ) as client:
                async with client.stream("GET", url, headers=STREAM_HEADERS) as response:
                    if response.status_code >= 400:
                        logger.error(f"[MusicProxy] Upstream returned {response.status_code} for {url}")
                        return
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        yield chunk
        except Exception as exc:
            logger.error(f"[MusicProxy] Streaming error for {url}: {exc}")
            return

    return StreamingResponse(
        stream_generator(),
        status_code=200,
        media_type="audio/mpeg",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache, no-store",
            "X-Proxied-From": url[:80],
        },
    )



# In-memory store for active music rooms
# Structure:
# {
#     "room_id": {
#         "id": str,
#         "displayName": str,
#         "djSid": str,
#         "djName": str,
#         "trackUrl": str,
#         "trackTitle": str,
#         "isPlaying": bool,
#         "currentTime": float,
#         "lastUpdated": float,
#         "listeners": {
#             "sid": { "name": str, "isDj": bool }
#         }
#     }
# }
_music_rooms: Dict[str, Dict[str, Any]] = {}

@router.get("/rooms")
async def list_music_rooms():
    """Get list of active music rooms and summary information."""
    rooms_list = []
    for r_id, room in _music_rooms.items():
        rooms_list.append({
            "id": room["id"],
            "displayName": room["displayName"],
            "djName": room["djName"],
            "trackTitle": room["trackTitle"],
            "isPlaying": room["isPlaying"],
            "listenerCount": len(room["listeners"]),
            "listeners": list(room["listeners"].values())
        })
    return {"success": True, "rooms": rooms_list}

async def cleanup_music_user(sid: str):
    """
    Cleans up user presence in any music rooms on disconnect.
    Can be called from a centralized disconnect handler.
    """
    to_delete = []
    for r_id, room in _music_rooms.items():
        if sid in room["listeners"]:
            # Remove listener
            user_info = room["listeners"].pop(sid)
            room_name = f"music_room_{r_id}"
            
            logger.info(f"[MusicRoom] User {user_info['name']} ({sid}) left room {r_id}")
            
            # Broadcast updated listener list
            await sio.emit("music_listeners_updated", {
                "roomId": r_id,
                "listeners": list(room["listeners"].values())
            }, room=room_name)
            
            # If room is now empty, mark for deletion
            if not room["listeners"]:
                to_delete.append(r_id)
                logger.info(f"[MusicRoom] Room {r_id} is empty, cleaning up")
            # If the user who left was the DJ, assign a new DJ if anyone is left
            elif room["djSid"] == sid:
                next_sid = next(iter(room["listeners"].keys()))
                next_user = room["listeners"][next_sid]
                room["djSid"] = next_sid
                room["djName"] = next_user["name"]
                room["isPlaying"] = False
                room["currentTime"] = 0.0
                next_user["isDj"] = True
                
                logger.info(f"[MusicRoom] DJ left. Promoted {next_user['name']} to DJ for room {r_id}")
                
                # Broadcast state update & listeners update
                await sio.emit("music_state_update", {
                    "roomId": r_id,
                    "djName": room["djName"],
                    "isPlaying": room["isPlaying"],
                    "currentTime": room["currentTime"],
                    "trackUrl": room["trackUrl"],
                    "trackTitle": room["trackTitle"]
                }, room=room_name)
                
                await sio.emit("music_listeners_updated", {
                    "roomId": r_id,
                    "listeners": list(room["listeners"].values())
                }, room=room_name)
                
    for r_id in to_delete:
        if r_id in _music_rooms:
            del _music_rooms[r_id]

# --- Socket.IO Event Handlers ---

@sio.on("create_music_room")
async def on_create_music_room(sid: str, data: dict):
    """
    Create a new music room.
    data = { "room_name": str, "username": str }
    """
    room_name = data.get("room_name", "").strip()
    username = data.get("username", "Unknown").strip()
    
    if not room_name or not username:
        await sio.emit("music_error", {"message": "Invalid room name or username"}, to=sid)
        return
        
    # Generate simple unique room ID
    r_id = "".join(c if c.isalnum() else "_" for c in room_name.lower())
    r_id = f"{r_id}_{int(time.time())}"
    
    # Initialize room structure
    _music_rooms[r_id] = {
        "id": r_id,
        "displayName": room_name,
        "djSid": sid,
        "djName": username,
        "trackUrl": "",
        "trackTitle": "",
        "isPlaying": False,
        "currentTime": 0.0,
        "lastUpdated": time.time(),
        "listeners": {
            sid: { "name": username, "isDj": True, "sid": sid }
        }
    }
    
    logger.info(f"[MusicRoom] Room created: '{room_name}' ({r_id}) by DJ {username}")
    
    # Join socket room
    socket_room = f"music_room_{r_id}"
    await sio.enter_room(sid, socket_room)
    
    # Acknowledge room creation
    await sio.emit("music_room_created", {
        "roomId": r_id,
        "room": _music_rooms[r_id]
    }, to=sid)

@sio.on("join_music_room")
async def on_join_music_room(sid: str, data: dict):
    """
    Join an existing music room.
    data = { "room_id": str, "username": str }
    """
    r_id = data.get("room_id")
    username = data.get("username", "Unknown").strip()
    
    if not r_id or r_id not in _music_rooms:
        await sio.emit("music_error", {"message": "Room not found or has been closed."}, to=sid)
        return
        
    room = _music_rooms[r_id]
    
    # If the user is already in the listeners, don't duplicate
    if sid in room["listeners"]:
        return
        
    # Check if this user was already a DJ in another room or needs to be cleaned up
    await cleanup_music_user(sid)
    
    # Refresh room reference in case cleanup deleted it
    if r_id not in _music_rooms:
        await sio.emit("music_error", {"message": "Room not found."}, to=sid)
        return
    room = _music_rooms[r_id]
    
    # Add to room listeners
    room["listeners"][sid] = { "name": username, "isDj": (room["djSid"] == sid), "sid": sid }
    
    # Enter the Socket.IO room channel
    socket_room = f"music_room_{r_id}"
    await sio.enter_room(sid, socket_room)
    
    logger.info(f"[MusicRoom] User {username} joined room {r_id}")
    
    # Send current room state to the joining user
    await sio.emit("music_room_joined", {
        "roomId": r_id,
        "room": room
    }, to=sid)
    
    # Broadcast updated listener list to all members in the room
    await sio.emit("music_listeners_updated", {
        "roomId": r_id,
        "listeners": list(room["listeners"].values())
    }, room=socket_room)

@sio.on("leave_music_room")
async def on_leave_music_room(sid: str, data: dict):
    """
    Explicitly leave a music room.
    data = { "room_id": str }
    """
    r_id = data.get("room_id")
    if not r_id or r_id not in _music_rooms:
        return
        
    room = _music_rooms[r_id]
    socket_room = f"music_room_{r_id}"
    
    if sid in room["listeners"]:
        user_info = room["listeners"].pop(sid)
        await sio.leave_room(sid, socket_room)
        
        logger.info(f"[MusicRoom] User {user_info['name']} explicitly left room {r_id}")
        
        # Broadcast updated listener list
        await sio.emit("music_listeners_updated", {
            "roomId": r_id,
            "listeners": list(room["listeners"].values())
        }, room=socket_room)
        
        # If room is now empty, delete it
        if not room["listeners"]:
            if r_id in _music_rooms:
                del _music_rooms[r_id]
            logger.info(f"[MusicRoom] Room {r_id} is empty, cleaning up")
        # If DJ left, promote someone else
        elif room["djSid"] == sid:
            next_sid = next(iter(room["listeners"].keys()))
            next_user = room["listeners"][next_sid]
            room["djSid"] = next_sid
            room["djName"] = next_user["name"]
            room["isPlaying"] = False
            room["currentTime"] = 0.0
            next_user["isDj"] = True
            
            logger.info(f"[MusicRoom] DJ left. Promoted {next_user['name']} to DJ for room {r_id}")
            
            # Broadcast state updates
            await sio.emit("music_state_update", {
                "roomId": r_id,
                "djName": room["djName"],
                "isPlaying": room["isPlaying"],
                "currentTime": room["currentTime"],
                "trackUrl": room["trackUrl"],
                "trackTitle": room["trackTitle"]
            }, room=socket_room)
            
            await sio.emit("music_listeners_updated", {
                "roomId": r_id,
                "listeners": list(room["listeners"].values())
            }, room=socket_room)

@sio.on("dj_state_change")
async def on_dj_state_change(sid: str, data: dict):
    """
    Receive playback updates from the DJ.
    data = { "room_id": str, "isPlaying": bool, "currentTime": float, "trackUrl": str, "trackTitle": str }
    """
    r_id = data.get("room_id")
    if not r_id or r_id not in _music_rooms:
        return
        
    room = _music_rooms[r_id]
    
    # Verify the sender is the DJ of this room
    if room["djSid"] != sid:
        # Client is not the DJ, ignore or send error
        return
        
    # Update room state
    room["isPlaying"] = data.get("isPlaying", False)
    room["currentTime"] = data.get("currentTime", 0.0)
    room["trackUrl"] = data.get("trackUrl", "")
    room["trackTitle"] = data.get("trackTitle", "")
    room["lastUpdated"] = time.time()
    
    # Broadcast state change to everyone in the room (except the DJ)
    socket_room = f"music_room_{r_id}"
    await sio.emit("music_state_update", {
        "roomId": r_id,
        "djName": room["djName"],
        "isPlaying": room["isPlaying"],
        "currentTime": room["currentTime"],
        "trackUrl": room["trackUrl"],
        "trackTitle": room["trackTitle"]
    }, room=socket_room, skip_sid=sid)
