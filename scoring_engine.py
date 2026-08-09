from matcher import match_skills


def score_candidate(job_profile: dict, candidate: dict) -> dict:
    """
    Requirement-aware scoring engine (Section 14).
    Combines required-skill fit, preferred-skill fit and experience fit
    into a DECOMPOSABLE score - never a single opaque number
    (Section 24: "Score Explainability Requirement").
    """
    required_results = match_skills(job_profile["required_skills"], candidate["skills"])
    preferred_results = match_skills(job_profile["preferred_skills"], candidate["skills"])

    required_matched = sum(1 for r in required_results if r["status"] == "MATCH")
    preferred_matched = sum(1 for r in preferred_results if r["status"] == "MATCH")

    required_fit = (required_matched / len(required_results) * 100) if required_results else 100
    preferred_fit = (preferred_matched / len(preferred_results) * 100) if preferred_results else 100

    min_years = job_profile["experience"]["minimum_years"]
    candidate_years = candidate.get("experience_years", 0)
    if min_years == 0:
        experience_fit = 100
    else:
        experience_fit = 100 if candidate_years >= min_years else round((candidate_years / min_years) * 100, 1)

    # NOTE: weights below are illustrative - the doc explicitly warns (Section 24)
    # against hardcoding arbitrary weights just to look impressive. Tune these
    # once you define what "matters most" for your evaluation.
    overall_score = round(
        required_fit * 0.5 + preferred_fit * 0.2 + experience_fit * 0.3, 1
    )

    return {
        "candidate": candidate["name"],
        "overall_score": overall_score,
        "required_skill_fit": round(required_fit, 1),
        "preferred_skill_fit": round(preferred_fit, 1),
        "experience_fit": round(experience_fit, 1),
        "matched_required": [r["skill"] for r in required_results if r["status"] == "MATCH"],
        "missing_required": [r["skill"] for r in required_results if r["status"] == "MISSING"],
        "matched_preferred": [r["skill"] for r in preferred_results if r["status"] == "MATCH"],
    }
