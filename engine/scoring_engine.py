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

    def _skill_score(results: list[dict]) -> float:
        return sum(
            1.0 if r["status"] == "MATCH" else (0.75 if r["status"] == "RELATED" else 0.0)
            for r in results
        )

    req_total = len(required_results)
    pref_total = len(preferred_results)
    required_score = _skill_score(required_results)
    preferred_score = _skill_score(preferred_results)

    required_fit = round((required_score / req_total * 100), 1) if req_total else 100.0
    preferred_fit = round((preferred_score / pref_total * 100), 1) if pref_total else 100.0

    min_years = job_profile.get("minimum_experience_years")
    if min_years is None:
        min_years = job_profile.get("experience", {}).get("minimum_years", 0)

    candidate_years = candidate.get("experience_years")
    if candidate_years is None:
        experience_fit = None
    elif min_years == 0:
        experience_fit = 100.0
    else:
        experience_fit = min(100.0, round((candidate_years / min_years) * 100, 1))

    if experience_fit is None:
        overall_score = round((required_fit * 0.5 + preferred_fit * 0.2) / 0.7, 1)
    else:
        overall_score = round(required_fit * 0.5 + preferred_fit * 0.2 + experience_fit * 0.3, 1)

    matched_required = [r for r in required_results if r["status"] in ("MATCH", "RELATED")]
    missing_required = [r["skill"] for r in required_results if r["status"] == "MISSING"]
    matched_preferred = [r for r in preferred_results if r["status"] in ("MATCH", "RELATED")]
    missing_preferred = [r["skill"] for r in preferred_results if r["status"] == "MISSING"]

    return {
        "candidate": candidate.get("name", "Unknown Candidate"),
        "overall_score": overall_score,
        "required_skill_fit": required_fit,
        "preferred_skill_fit": preferred_fit,
        "experience_fit": experience_fit,
        "candidate_experience": candidate_years,
        "required_experience": min_years,
        "matched_required": matched_required,
        "missing_required": missing_required,
        "matched_preferred": matched_preferred,
        "missing_preferred": missing_preferred,
        "all_required_results": required_results,
        "all_preferred_results": preferred_results,
        "required_results": required_results,
        "preferred_results": preferred_results,
    }

