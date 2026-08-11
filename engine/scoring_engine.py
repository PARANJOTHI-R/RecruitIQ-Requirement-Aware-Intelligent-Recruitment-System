# engine/scoring_engine.py
#
# Requirement-aware scoring engine.
# Weights: Required 50% | Preferred 20% | Experience 30%
# Python calculates all numbers. Gemini never touches these values.

from __future__ import annotations

from engine.matcher import match_skills


def score_candidate(
    job_profile: dict,
    candidate: dict,
    resume_lines: list[str] | None = None,
    use_semantic: bool = True,
) -> dict:
    """
    Score a candidate against the job profile.

    job_profile keys:
        required_skills         list[str]
        preferred_skills        list[str]
        minimum_experience_years int

    candidate keys:
        name             str
        skills           list[str]
        experience_years float | None

    Returns a rich dict with scores + per-skill match details.
    """
    if resume_lines is None:
        resume_lines = []

    required_results = match_skills(
        job_profile.get("required_skills", []),
        candidate.get("skills", []),
        resume_lines,
        use_semantic=use_semantic,
    )
    preferred_results = match_skills(
        job_profile.get("preferred_skills", []),
        candidate.get("skills", []),
        resume_lines,
        use_semantic=use_semantic,
    )

    # ── Skill fit scores ─────────────────────────────────────────────────────
    req_total = len(required_results)
    req_matched = sum(1 for r in required_results if r["status"] == "MATCH")
    pref_total = len(preferred_results)
    pref_matched = sum(1 for r in preferred_results if r["status"] == "MATCH")

    required_fit = round((req_matched / req_total * 100), 1) if req_total else 100.0
    preferred_fit = round((pref_matched / pref_total * 100), 1) if pref_total else 100.0

    # ── Experience fit ───────────────────────────────────────────────────────
    min_years = job_profile.get("minimum_experience_years", 0)
    candidate_years = candidate.get("experience_years")  # may be None

    if candidate_years is None:
        experience_fit = None          # unknown — do NOT fake as 0
    elif min_years == 0:
        experience_fit = 100.0
    else:
        experience_fit = min(100.0, round((candidate_years / min_years) * 100, 1))

    # ── Overall score ────────────────────────────────────────────────────────
    # If experience is unknown we exclude it and re-weight 50/20 → 50/20/(70 total)
    if experience_fit is None:
        # Weight just required + preferred, normalise to 100
        overall_score = round(
            (required_fit * 0.5 + preferred_fit * 0.2) / 0.7, 1
        )
    else:
        overall_score = round(
            required_fit * 0.5 + preferred_fit * 0.2 + experience_fit * 0.3, 1
        )

    return {
        "candidate": candidate.get("name", "Unknown"),
        "overall_score": overall_score,
        "required_skill_fit": required_fit,
        "preferred_skill_fit": preferred_fit,
        "experience_fit": experience_fit,       # None if unknown
        "required_results": required_results,   # full evidence objects
        "preferred_results": preferred_results,
    }
