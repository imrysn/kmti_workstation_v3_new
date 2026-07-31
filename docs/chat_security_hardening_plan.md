# KMTI Workstation Chat — Security Hardening Plan
## Column-Level Encryption (Content) + WSS Transport (TLS)

**Document Status**: Future Implementation Reference  
**Author**: Antigravity (AI Pair Programmer)  
**Created**: 2026-07-31  
**Target Version**: v3.8.x or later  

---

## 1. Background & Motivation

The current chat system (`kmti_chat_messages`) stores all message `content` as **plaintext** in MySQL and communicates over plain **HTTP/WS** (no TLS). On a LAN-only deployment this is often acceptable, but it exposes messages to:

| Risk | Scenario |
|------|----------|
| DB admin read access | Anyone with MySQL credentials can `SELECT * FROM kmti_chat_messages` |
| LAN traffic sniffing | Wireshark/tcpdump on the same switch sees cleartext WebSocket frames |
| Log leakage | Unhandled exceptions can print message content to `production.log` |
| Physical server access | Direct console access to the server workstation exposes all data |

This plan addresses both concerns in two independent phases so they can be implemented and deployed separately.

---

## 2. Phase 1 — Column-Level Encryption on `content`

### 2.1 Approach

Use **`cryptography.fernet`** (AES-128-CBC + HMAC-SHA256) for symmetric encryption of the message `content` column before it is written to MySQL and after it is read back. The encryption key is stored in a separate `.env` variable — not in the database — so raw DB access cannot read messages without the key.

**This does NOT break:**
- Unread counts (counted by row, not content)
- Thread grouping (based on `sender`, `recipient`, `group_id`)
- Reactions, pins, edits (metadata columns are not encrypted)
- Attachment paths (not encrypted; file contents on NAS are a separate concern)

**This DOES break (requires migration):**
- Full-text search on `content` (MySQL `LIKE` won't work on ciphertext)
- Existing rows in DB (require a one-time migration script)

---

### 2.2 Key Management

```
# .env — add this variable (keep .env out of version control)
CHAT_ENCRYPTION_KEY=<base64-url-safe-32-bytes-generated-once>
```

Generate the key once:
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

> ⚠️ **Critical**: The key must be backed up separately. If lost, all historical encrypted messages become unrecoverable.

---

### 2.3 New File — `backend/core/chat_crypto.py`

```python
import os
from cryptography.fernet import Fernet

_fernet: Fernet | None = None

def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = os.environ.get("CHAT_ENCRYPTION_KEY")
        if not key:
            raise RuntimeError("CHAT_ENCRYPTION_KEY is not set in environment.")
        _fernet = Fernet(key.encode())
    return _fernet

def encrypt_content(plaintext: str) -> str:
    """Encrypt message content before DB insert. Returns base64 ciphertext string."""
    return _get_fernet().encrypt(plaintext.encode()).decode()

def decrypt_content(ciphertext: str) -> str:
    """Decrypt message content after DB read. Returns original plaintext."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        # Graceful fallback: return as-is for any legacy plaintext rows
        return ciphertext
```

The `decrypt_content` fallback handles the migration window where old rows are still plaintext.

---

### 2.4 Changes to `backend/modules/chat/service.py`

**On write** (`create_message` / send flow in `api.py`):
```python
from core.chat_crypto import encrypt_content, decrypt_content

# Before inserting:
new_msg = ChatMessage(
    ...
    content=encrypt_content(content),  # ← encrypt before save
    ...
)
```

**On read** (everywhere a message is serialized back to JSON):
```python
# In get_chat_history return serialization:
{
    "content": decrypt_content(msg.content),   # ← decrypt on read
    ...
}

# In get_chat_threads last_message:
{
    "content": decrypt_content(last_msg.content),
    ...
}
```

---

### 2.5 Migration Script — `backend/scripts/migrate_encrypt_chat.py`

Run once against the live DB to encrypt all existing plaintext rows:

```python
"""
One-time migration: encrypt all existing plaintext chat message content.
Run with: python backend/scripts/migrate_encrypt_chat.py
"""
import asyncio
from sqlalchemy import select, update
from db.database import AsyncSessionLocal
from models.chat import ChatMessage
from core.chat_crypto import encrypt_content, decrypt_content

async def migrate():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ChatMessage))
        messages = result.scalars().all()
        count = 0
        for msg in messages:
            # Skip already-encrypted rows (Fernet tokens start with 'gAAAAA')
            if msg.content and not msg.content.startswith('gAAAAA'):
                await session.execute(
                    update(ChatMessage)
                    .where(ChatMessage.id == msg.id)
                    .values(content=encrypt_content(msg.content))
                )
                count += 1
        await session.commit()
        print(f"Migrated {count} plaintext messages to encrypted.")

asyncio.run(migrate())
```

> ⚠️ **Take a MySQL backup before running this script.**

---

### 2.6 Affected Files — Phase 1 Summary

| File | Change |
|------|--------|
| `backend/core/chat_crypto.py` | **[NEW]** Fernet encrypt/decrypt helpers |
| `backend/modules/chat/api.py` | Wrap `content` with `encrypt_content()` on insert |
| `backend/modules/chat/service.py` | Wrap `content` with `decrypt_content()` on all reads |
| `backend/modules/chat/api.py` (send socket emit) | Emit already-decrypted content (don't emit ciphertext to clients) |
| `backend/scripts/migrate_encrypt_chat.py` | **[NEW]** One-time migration script |
| `.env` / `.env.example` | Add `CHAT_ENCRYPTION_KEY` variable |
| `backend/build_server.py` | Add `--hidden-import=cryptography.fernet` (already has `cryptography`) |

---

## 3. Phase 2 — WSS Transport (TLS via nginx Reverse Proxy)

### 3.1 Approach

The recommended approach for a Windows LAN deployment is to put an **nginx reverse proxy** in front of the Uvicorn/FastAPI server that handles TLS termination. This upgrades:

- `http://SERVER_IP:8000` → `https://SERVER_IP` (or a local hostname)
- `ws://SERVER_IP:8000/socket.io/` → `wss://SERVER_IP/socket.io/`

Uvicorn itself does not need to change. The backend code is unmodified.

---

### 3.2 Certificate Strategy

For a LAN (no public domain), use a **self-signed certificate** or an **internal CA** (e.g., Windows Server CA if the domain is already managed).

Generate a self-signed cert (valid 10 years for internal use):
```bash
openssl req -x509 -newkey rsa:4096 -keyout kmti-server.key \
  -out kmti-server.crt -days 3650 -nodes \
  -subj "/C=PH/O=KMTI/CN=kmti-server" \
  -addext "subjectAltName=IP:192.168.1.X,DNS:kmti-server"
```

Replace `192.168.1.X` with the server's actual LAN IP.

> Distribute `kmti-server.crt` to all client machines and install it in the **Trusted Root CA** store so Electron/browser does not show certificate warnings.

---

### 3.3 nginx Configuration (`nginx.conf`)

```nginx
worker_processes 1;

events { worker_connections 1024; }

http {
    upstream kmti_backend {
        server 127.0.0.1:8000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name kmti-server 192.168.1.X;

        ssl_certificate     C:/kmti/certs/kmti-server.crt;
        ssl_certificate_key C:/kmti/certs/kmti-server.key;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        # REST API + WebSocket proxy
        location / {
            proxy_pass         http://kmti_backend;
            proxy_http_version 1.1;

            # WebSocket upgrade headers (required for Socket.IO)
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection "upgrade";

            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;

            proxy_read_timeout 86400;  # Keep WebSocket connections alive
        }
    }
}
```

---

### 3.4 Frontend Changes (`src/services/api.ts`)

Update `SERVER_BASE` resolution to use `https://` and ensure Socket.IO connects with `wss://`:

```typescript
// src/services/api.ts
// Change: http:// → https://
const SERVER_BASE = import.meta.env.VITE_API_URL ?? 'https://192.168.1.X';

// src/hooks/useSocketSync.ts (or wherever socket is initialized)
// Socket.IO auto-upgrades to WSS when the base URL uses https://
// No explicit wss:// needed — socket.io-client handles the upgrade.
const socket = io(SERVER_BASE, {
    transports: ['websocket', 'polling'],
    // If using self-signed cert in Electron, you may need:
    // rejectUnauthorized: false   ← only for self-signed; remove for CA-signed
});
```

> ⚠️ If using a self-signed cert, Electron's Node.js layer requires `rejectUnauthorized: false` in the socket options OR the cert installed in the system trust store.

---

### 3.5 Electron Main Process (if applicable)

If the app runs as Electron and uses a self-signed cert, add to `electron/main.ts`:

```typescript
import { app } from 'electron';

// Allow self-signed TLS certificates for LAN server
app.commandLine.appendSwitch('ignore-certificate-errors');
// OR — better, install the cert in the OS trust store and remove this line.
```

---

### 3.6 Affected Files — Phase 2 Summary

| File | Change |
|------|--------|
| `nginx.conf` (new, on server) | **[NEW]** Reverse proxy with TLS termination |
| `kmti-server.crt / .key` (on server) | **[NEW]** Self-signed certificate |
| `src/services/api.ts` | Update `SERVER_BASE` from `http://` to `https://` |
| `src/hooks/useSocketSync.ts` | Verify socket connects via HTTPS (auto WSS) |
| `electron/main.ts` (if applicable) | Add cert trust handling for self-signed |
| `.env` / `.env.example` | Update `VITE_API_URL` to `https://` |

---

## 4. Deployment Order

```
Phase 1 (Column Encryption)
  1. Generate CHAT_ENCRYPTION_KEY and add to .env
  2. Deploy new backend/core/chat_crypto.py
  3. Deploy updated api.py and service.py
  4. Take MySQL backup
  5. Run migrate_encrypt_chat.py
  6. Rebuild server.exe and deploy to all workstations

Phase 2 (WSS Transport)
  1. Generate self-signed cert (or get internal CA cert)
  2. Distribute cert to all workstation OS trust stores
  3. Install and configure nginx on the server machine
  4. Update VITE_API_URL in .env to https://
  5. Rebuild frontend and redeploy Electron app
  6. Restart nginx and verify WebSocket connections upgrade to WSS
```

---

## 5. What This Does NOT Cover

- **End-to-End Encryption (E2EE)** — Server still decrypts content to serve it. True E2EE would require client-side key management and would break unread counts, search, and moderation features.
- **Attachment file encryption** — Files stored on `\\KMTI-NAS\Shared\data\storage\chat` are not encrypted by this plan. This is a separate NAS-level concern.
- **Key rotation** — Once deployed, rotating `CHAT_ENCRYPTION_KEY` requires re-encrypting all rows. A key rotation script should be written when rotation policy is defined.
- **Audit logging of message access** — Not covered here but recommended for compliance.
