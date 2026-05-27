import math
import re
from typing import List, Dict, Tuple, Optional

class TFIDFVectorizer:
    """Zero-dependency TF-IDF vectorizer for semantic text similarity."""
    def __init__(self):
        self.vocab = {}
        self.idf = {}
        self.doc_count = 0

    def fit(self, docs: List[str]):
        term_docs = []
        doc_freqs = {}
        self.doc_count = len(docs)
        
        for doc in docs:
            words = self._tokenize(doc)
            unique_words = set(words)
            term_docs.append(words)
            for w in unique_words:
                doc_freqs[w] = doc_freqs.get(w, 0) + 1

        # Build vocabulary & IDF
        vocab_idx = 0
        for w, df in doc_freqs.items():
            if df > 1 or len(docs) < 10:  # prune very rare terms if collection is large
                self.vocab[w] = vocab_idx
                # IDF with smoothing
                self.idf[w] = math.log((1 + self.doc_count) / (1 + df)) + 1
                vocab_idx += 1

    def _tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        # split by non-alphanumeric, lowercase, filter short tokens
        return [w for w in re.split(r'[^a-zA-Z0-9]', text.lower()) if len(w) > 1]

    def transform(self, text: str) -> Dict[int, float]:
        tokens = self._tokenize(text)
        tf = {}
        for t in tokens:
            if t in self.vocab:
                tf[self.vocab[t]] = tf.get(self.vocab[t], 0) + 1
        
        # Multiply TF by IDF
        vector = {}
        for idx, freq in tf.items():
            term = list(self.vocab.keys())[list(self.vocab.values()).index(idx)]
            vector[idx] = freq * self.idf[term]
        return vector

    def cosine_similarity(self, vec1: Dict[int, float], vec2: Dict[int, float]) -> float:
        if not vec1 or not vec2:
            return 0.0
            
        dot_product = sum(vec1[idx] * vec2.get(idx, 0.0) for idx in vec1)
        norm1 = math.sqrt(sum(val ** 2 for val in vec1.values()))
        norm2 = math.sqrt(sum(val ** 2 for val in vec2.values()))
        
        if norm1 == 0.0 or norm2 == 0.0:
            return 0.0
        return dot_product / (norm1 * norm2)

class SemanticEngine:
    def __init__(self):
        self.vectorizer = TFIDFVectorizer()
        self.is_fitted = False
        self.transformer_model = None
        self._load_transformer()

    def _load_transformer(self):
        """Try loading offline SentenceTransformer if installed."""
        try:
            from sentence_transformers import SentenceTransformer
            # Load a tiny, fast offline model
            self.transformer_model = SentenceTransformer('all-MiniLM-L6-v2')
            print("Loaded offline SentenceTransformer model successfully.")
        except Exception:
            self.transformer_model = None

    def fit_vocabulary(self, documents: List[str]):
        """Train the vectorizer on the corpus of files."""
        if not self.transformer_model and documents:
            self.vectorizer.fit(documents)
            self.is_fitted = True

    def compute_similarity(self, query: str, document_texts: List[str]) -> List[float]:
        """Compute similarity scores between query and documents."""
        if self.transformer_model:
            try:
                query_emb = self.transformer_model.encode(query, convert_to_tensor=True)
                doc_embs = self.transformer_model.encode(document_texts, convert_to_tensor=True)
                from sentence_transformers.util import cos_sim
                scores = cos_sim(query_emb, doc_embs)[0].tolist()
                return scores
            except Exception:
                pass

        # Fallback to TF-IDF Cosine Similarity
        if not self.is_fitted:
            self.fit_vocabulary(document_texts + [query])
            
        q_vec = self.vectorizer.transform(query)
        scores = []
        for doc in document_texts:
            d_vec = self.vectorizer.transform(doc)
            scores.append(self.vectorizer.cosine_similarity(q_vec, d_vec))
        return scores

    def re_rank(self, query: str, items: List[dict]) -> List[dict]:
        """Re-rank candidate search items using semantic scores (Two-Stage Retrieval)."""
        if not items or not query:
            return items

        # Build list of text representations for each record (combining filename, path and snippet)
        doc_texts = []
        for item in items:
            name = item.get("fileName", "")
            path = item.get("filePath", "")
            snippet = item.get("snippet", "") or ""
            doc_texts.append(f"{name} {path} {snippet}")

        scores = self.compute_similarity(query, doc_texts)
        
        # Update scores in items
        for idx, score in enumerate(scores):
            # Scale semantic score into the ranking weights (e.g. up to 400 points max boost)
            semantic_boost = score * 400.0
            items[idx]["semanticScore"] = score
            # If no ranking exists, default to 0
            original_rank = items[idx].get("rankScore", 0.0)
            items[idx]["combinedScore"] = original_rank + semantic_boost

        # Sort descending by combinedScore, then folder priority, then alphabetical
        items.sort(key=lambda x: (
            -x.get("combinedScore", 0.0),
            -1 if x.get("isFolder") else 0,
            x.get("fileName", "").lower()
        ))
        
        return items

semantic_engine = SemanticEngine()
