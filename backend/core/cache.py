import logging
import asyncio
from typing import Any, Dict, Optional
from cachetools import TTLCache

logger = logging.getLogger("kmti_backend.cache")

# Initialize caches with approved namespaces and TTLs
CACHES: Dict[str, TTLCache] = {
    "projects": TTLCache(maxsize=10, ttl=60),
    "categories": TTLCache(maxsize=1, ttl=300),
    "tree": TTLCache(maxsize=500, ttl=120),
    "parts_list": TTLCache(maxsize=200, ttl=120),
    "quot_list": TTLCache(maxsize=10, ttl=30),
    "quot_sessions": TTLCache(maxsize=1, ttl=10),
    "tc_grid": TTLCache(maxsize=50, ttl=60),
    "tc_todos": TTLCache(maxsize=1, ttl=30),
    "users": TTLCache(maxsize=1, ttl=120)
}

# Async Locks to avoid race conditions/concurrent DB stampede
LOCKS: Dict[str, asyncio.Lock] = {name: asyncio.Lock() for name in CACHES}

async def cache_get(namespace: str, key: Any) -> Optional[Any]:
    if namespace not in CACHES:
        return None
    async with LOCKS[namespace]:
        val = CACHES[namespace].get(key)
        if val is not None:
            logger.debug(f"Cache HIT - {namespace}:{key}")
        return val

async def cache_set(namespace: str, key: Any, value: Any) -> None:
    if namespace not in CACHES:
        return
    async with LOCKS[namespace]:
        CACHES[namespace][key] = value
        logger.debug(f"Cache SET - {namespace}:{key}")

async def cache_delete(namespace: str, key: Any = None) -> None:
    if namespace not in CACHES:
        return
    async with LOCKS[namespace]:
        if key is None:
            CACHES[namespace].clear()
            logger.debug(f"Cache CLEAR - {namespace}")
        else:
            if key in CACHES[namespace]:
                del CACHES[namespace][key]
                logger.debug(f"Cache DEL - {namespace}:{key}")
