# engine/semantic_matcher.py
#
# MiniLM-based semantic similarity using sentence-transformers.
# Loaded once as a module-level singleton so we don't reload per-candidate.
#
# Hugging Face Authentication
# ----------------------------
# Reads HF_TOKEN from the environment (populated by load_dotenv() in main.py).
# Passes the token to SentenceTransformer so authenticated Hub access is used,
# avoiding unauthenticated-request warnings and rate limits.
# The token is NEVER printed or returned in any output.
# If HF_TOKEN is absent, falls back to unauthenticated loading (no crash).

from __future__ import annotations

import os

import numpy as np

import threading

_init_lock = threading.Lock()
_model = None


def init_model():
    """Eagerly initialize the model to prevent loading during requests."""
    global _model
    if _model is None:
        with _init_lock:
            if _model is None:
                from sentence_transformers import SentenceTransformer

                hf_token: str | None = os.environ.get("HF_TOKEN", "").strip() or None

                _model = SentenceTransformer(
                    "all-MiniLM-L6-v2",
                    token=hf_token,  # type: ignore[arg-type]
                )
    return _model


def _get_model():
    if _model is None:
        return init_model()
    return _model


_embedding_cache = {}

def preload_embeddings(texts: list[str]) -> None:
    """Batch encode texts and store in the module-level cache."""
    unique_texts = [t for t in set(texts) if t and t not in _embedding_cache]
    if not unique_texts:
        return
        
    model = _get_model()
    # Batch encode is vastly faster than individual encode calls
    vecs = model.encode(unique_texts, convert_to_numpy=True, normalize_embeddings=True)
    for t, v in zip(unique_texts, vecs):
        _embedding_cache[t] = v

def embed(text: str) -> np.ndarray:
    """Return a unit-norm sentence embedding for the given text."""
    if text not in _embedding_cache:
        preload_embeddings([text])
    return _embedding_cache[text]


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two unit-norm vectors."""
    return float(np.dot(a, b))


def profile_similarity(candidate_text: str, jd_text: str) -> float:
    """
    High-level cosine similarity between a candidate profile blob
    and the full job description text.
    Returns a float in [0, 1].
    """
    a = embed(candidate_text)
    b = embed(jd_text)
    return round(cosine_similarity(a, b), 4)


def best_evidence_line(skill: str, resume_lines: list[str], threshold: float = 0.40) -> tuple[str | None, float]:
    """
    Find the resume line most semantically similar to the skill name.
    Returns (best_line, similarity_score) or (None, 0.0) if nothing clears threshold.
    """
    if not resume_lines:
        return None, 0.0

    valid_lines = [line for line in resume_lines if len(line.strip()) >= 5]
    
    # Pre-embed the skill and all lines in one batched call to save massive inference time
    preload_embeddings([skill] + valid_lines)

    skill_vec = embed(skill)
    best_line = None
    best_score = 0.0

    for line in valid_lines:
        line_vec = embed(line)
        score = cosine_similarity(skill_vec, line_vec)
        if score > best_score:
            best_score = score
            best_line = line

    if best_score >= threshold:
        return best_line, round(best_score, 4)
    return None, 0.0
