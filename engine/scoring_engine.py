from engine.matcher import match_skills


def score_candidate(job_profile: dict, candidate: dict) -> dict:
    """
    Requirement-aware scoring engine (Section 14).
    Combines required-skill fit, preferred-skill fit and experience fit
    into a DECOMPOSABLE score - never a single opaque number
    (Section 24: "Score Explainability Requirement").
    """
    required_results = match_skills(job_profile.get("required_skills", []), candidate.get("skills", []))
    preferred_results = match_skills(job_profile.get("preferred_skills", []), candidate.get("skills", []))

    # Exact match = 1.0, Related match = 0.75
    required_score = sum(
        1.0 if r["status"] == "MATCH" else (0.75 if r["status"] == "RELATED" else 0.0)
        for r in required_results
    )
    preferred_score = sum(
        1.0 if r["status"] == "MATCH" else (0.75 if r["status"] == "RELATED" else 0.0)
        for r in preferred_results
    )

    required_fit = (required_score / len(required_results) * 100) if required_results else 100.0
    preferred_fit = (preferred_score / len(preferred_results) * 100) if preferred_results else 100.0

    min_years = job_profile.get("experience", {}).get("minimum_years", 0)
    candidate_years = candidate.get("experience_years", 0)
    if min_years == 0:
        experience_fit = 100.0
    else:
        experience_fit = 100.0 if candidate_years >= min_years else round((candidate_years / min_years) * 100.0, 1)

    # Decomposable overall score
    overall_score = round(
        required_fit * 0.5 + preferred_fit * 0.2 + experience_fit * 0.3, 1
    )

    return {
        "candidate": candidate.get("name", "Unknown Candidate"),
        "overall_score": overall_score,
        "required_skill_fit": round(required_fit, 1),
        "preferred_skill_fit": round(preferred_fit, 1),
        "experience_fit": round(experience_fit, 1),
        "candidate_experience": candidate_years,
        "required_experience": min_years,
        "matched_required": [r for r in required_results if r["status"] in ("MATCH", "RELATED")],
        "missing_required": [r["skill"] for r in required_results if r["status"] == "MISSING"],
        "matched_preferred": [r for r in preferred_results if r["status"] in ("MATCH", "RELATED")],
        "missing_preferred": [r["skill"] for r in preferred_results if r["status"] == "MISSING"],
        "all_required_results": required_results,
        "all_preferred_results": preferred_results,
    }

