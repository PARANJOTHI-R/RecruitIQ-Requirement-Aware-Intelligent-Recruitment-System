# engine/matcher.py
#
# Hybrid matcher: Exact → Alias-normalized → Semantic fallback.
# Returns rich evidence objects for every skill.

from __future__ import annotations

import re

from engine.skill_normalizer import ALIAS_MAP, normalize_skill


# ── Helpers ────────────────────────────────────────────────────────────────────

def _normalize_key(text: str) -> str:
    """Lowercase + collapse whitespace."""
    return re.sub(r"\s+", " ", text.strip().lower())


def _find_evidence_line(skill_canonical: str, resume_lines: list[str]) -> str | None:
    """
    Return the first resume line that contains the skill (or any of its aliases)
    as a substring.  Case-insensitive, whole-word preferred but not required.
    """
    # Collect all aliases whose canonical form matches this skill
    aliases = [alias for alias, canon in ALIAS_MAP.items() if canon == skill_canonical]
    aliases.append(skill_canonical.lower())

    for line in resume_lines:
        line_lower = line.lower()
        for alias in aliases:
            # Whole-word match preferred
            pattern = r'(?<![a-z0-9.+#])' + re.escape(alias) + r'(?![a-z0-9.+#])'
            if re.search(pattern, line_lower):
                return line.strip()
    return None


# ── Main matching function ──────────────────────────────────────────────────────

def match_skills(
    jd_skills: list[str],
    candidate_skills: list[str],
    resume_lines: list[str],
    use_semantic: bool = True,
    semantic_threshold: float = 0.55,
) -> list[dict]:
    """
    For each JD skill, attempt to match against candidate skills.

    Matching tiers (in order):
      1. Exact match (case-insensitive)
      2. Alias-normalized match (both sides normalized via ALIAS_MAP)
      3. Semantic fallback via MiniLM cosine (if use_semantic=True)

    Returns a list of result dicts:
    {
        "skill":       str,           # canonical JD skill name
        "status":      "MATCH"|"MISSING",
        "match_type":  "exact"|"normalized"|"semantic"|None,
        "evidence":    str|None,      # relevant resume line
        "similarity":  float|None,    # only for semantic matches
    }
    """
    # Pre-normalize candidate skills to canonical form
    # Map: canonical_name → list of original raw strings
    cand_canonical_map: dict[str, list[str]] = {}
    for cs in candidate_skills:
        canon = normalize_skill(cs)
        if canon is None:
            # Not in our dictionary — store the raw lowercased for exact fallback
            canon = cs.strip().lower()
        cand_canonical_map.setdefault(canon, []).append(cs)

    # Also build a simple lowercase set of raw candidate strings for exact check
    cand_raw_lower = {c.strip().lower() for c in candidate_skills}

    results = []

    for jd_skill in jd_skills:
        jd_lower = _normalize_key(jd_skill)
        jd_canonical = normalize_skill(jd_skill) or jd_skill  # fallback: use as-is

        result = {
            "skill": jd_skill,
            "status": "MISSING",
            "match_type": None,
            "evidence": None,
            "similarity": None,
        }

        # ── Tier 1: Exact match ─────────────────────────────────────────────
        if jd_lower in cand_raw_lower:
            result["status"] = "MATCH"
            result["match_type"] = "exact"
            result["evidence"] = _find_evidence_line(jd_canonical, resume_lines)
            results.append(result)
            continue

        # ── Tier 2: Normalized alias match ──────────────────────────────────
        jd_canon_lower = jd_canonical.lower()
        matched_canon = jd_canon_lower in {k.lower() for k in cand_canonical_map}
        if matched_canon:
            result["status"] = "MATCH"
            result["match_type"] = "normalized"
            result["evidence"] = _find_evidence_line(jd_canonical, resume_lines)
            results.append(result)
            continue

        # Also check: normalize the JD skill and see if cand has the same canonical
        jd_norm = normalize_skill(jd_skill)
        if jd_norm:
            jd_norm_lower = jd_norm.lower()
            for cand_canon in cand_canonical_map:
                if cand_canon.lower() == jd_norm_lower:
                    result["status"] = "MATCH"
                    result["match_type"] = "normalized"
                    result["evidence"] = _find_evidence_line(jd_norm, resume_lines)
                    results.append(result)
                    break
            if result["status"] == "MATCH":
                continue

        # ── Tier 3: Semantic fallback ────────────────────────────────────────
        if use_semantic:
            try:
                from engine.semantic_matcher import best_evidence_line, embed, cosine_similarity

                # Embed the JD skill name
                jd_skill_vec = embed(jd_skill)

                # Compare against each candidate skill name
                best_cand = None
                best_score = 0.0
                for cs in candidate_skills:
                    cs_vec = embed(cs)
                    score = cosine_similarity(jd_skill_vec, cs_vec)
                    if score > best_score:
                        best_score = score
                        best_cand = cs

                # Guard against obvious false positives (Java vs JavaScript, etc.)
                if best_score >= semantic_threshold and best_cand:
                    # Extra guard: reject if token overlap is dangerously misleading
                    # e.g. "Java" should not match "JavaScript" semantically
                    if not _is_false_positive(jd_skill, best_cand):
                        evidence_line, _ = best_evidence_line(
                            normalize_skill(best_cand) or best_cand,
                            resume_lines,
                            threshold=0.30,
                        )
                        result["status"] = "MATCH"
                        result["match_type"] = "semantic"
                        result["similarity"] = round(best_score, 4)
                        result["evidence"] = evidence_line or _find_evidence_line(
                            normalize_skill(best_cand) or best_cand, resume_lines
                        )
            except Exception:
                pass  # Semantic unavailable — remain MISSING

        results.append(result)

    return results


def _is_false_positive(skill_a: str, skill_b: str) -> bool:
    """
    Detect known false-positive pairs where semantic similarity is misleadingly high
    but the technologies are NOT equivalent.
    """
    FALSE_POSITIVE_PAIRS = [
        ("java", "javascript"),
        ("javascript", "java"),
        ("react", "react native"),
        ("react native", "react"),
        ("node", "java"),
        ("java", "node"),
        ("node.js", "java"),
    ]
    a = skill_a.strip().lower()
    b = skill_b.strip().lower()
    return (a, b) in FALSE_POSITIVE_PAIRS
