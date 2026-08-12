# engine/semantic_matcher.py
#
# MiniLM-based semantic similarity using sentence-transformers.
# Loaded once as a module-level singleton so we don't reload per-candidate.

from __future__ import annotations

import numpy as np

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed(text: str) -> np.ndarray:
    """Return a unit-norm sentence embedding for the given text."""
    model = _get_model()
    vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return vec


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

    threshold is intentionally low because we're comparing a 1-2 word skill
    against a full sentence — pure embedding won't be that high.
    We primarily use this as fallback evidence when exact/alias match already found
    a line, or as the semantic match method itself.
    """
    if not resume_lines:
        return None, 0.0

    skill_vec = embed(skill)
    best_line = None
    best_score = 0.0

    for line in resume_lines:
        if len(line.strip()) < 5:
            continue
        line_vec = embed(line)
        score = cosine_similarity(skill_vec, line_vec)
        if score > best_score:
            best_score = score
            best_line = line

    if best_score >= threshold:
        return best_line, round(best_score, 4)
    return None, 0.0
