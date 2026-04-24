import logging
import asyncio
from typing import List, Dict, Set, Optional

logger = logging.getLogger("kmti_backend.trie")

class TrieNode:
    __slots__ = ['children', 'is_end']
    
    def __init__(self):
        self.children: Dict[str, 'TrieNode'] = {}
        self.is_end: bool = False

class TrieEngine:
    def __init__(self):
        self.root = TrieNode()
        self.indexed_count = 0
        self.is_ready = False

    def add(self, text: str):
        if not text: return
        node = self.root
        for char in text.lower():
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        if not node.is_end:
            node.is_end = True
            self.indexed_count += 1

    def search(self, prefix: str, limit: int = 10) -> List[str]:
        if not prefix: return []
        
        node = self.root
        for char in prefix.lower():
            if char not in node.children:
                return []
            node = node.children[char]
        
        results = []
        self._dfs(node, prefix, results, limit)
        return results

    def _dfs(self, node: TrieNode, prefix: str, results: List[str], limit: int):
        if len(results) >= limit:
            return
        
        if node.is_end:
            results.append(prefix)
            
        # Sort children to keep suggestions consistent (alphabetical)
        for char in sorted(node.children.keys()):
            self._dfs(node.children[char], prefix + char, results, limit)
            if len(results) >= limit:
                break

    def clear(self):
        self.root = TrieNode()
        self.indexed_count = 0
        self.is_ready = False

async def warm_up_trie():
    """Initializes the trie by fetching all unique filenames and project names."""
    from db.database import AsyncSessionLocal
    from models.part import CadFileIndex, Project
    from sqlalchemy import select, distinct
    import time

    start = time.time()
    logger.info("Trie Engine: Warming up cache...")
    
    try:
        async with AsyncSessionLocal() as session:
            # 1. Index Project Names
            proj_res = await session.execute(select(Project.name))
            for row in proj_res.fetchall():
                trie_service.add(row[0])

            # 2. Index Unique File Names
            # We select unique names to keep the trie memory-efficient
            file_res = await session.execute(select(distinct(CadFileIndex.file_name)))
            
            # Use chunks if there are 400k records to avoid blocking the loop too long
            count = 0
            for row in file_res.fetchall():
                trie_service.add(row[0])
                count += 1
                if count % 10000 == 0:
                    await asyncio.sleep(0) # Yield for other tasks
            
            trie_service.is_ready = True
            duration = time.time() - start
            logger.info(f"Trie Engine: Warm-up complete in {duration:.2f}s. {trie_service.indexed_count} unique terms indexed.")
    except Exception as e:
        logger.error(f"Trie Engine: Warm-up failed: {e}")

# Global Singleton
trie_service = TrieEngine()
