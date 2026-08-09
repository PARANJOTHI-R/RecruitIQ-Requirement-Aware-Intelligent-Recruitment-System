from skill_normalizer import normalize_skill_list


def match_skills(job_skills: list, candidate_skills: list) -> list:
    """
    Exact + normalized matcher (Section 12 of the doc).
    Semantic matching (MiniLM embeddings) is a stretch goal for later -
    your teammate's stack already has the parsing piece, this can plug
    in on top of it once you sync.

    Returns: [{"skill": ..., "status": "MATCH" | "MISSING"}, ...]
    """
    norm_job = normalize_skill_list(job_skills)
    norm_candidate = normalize_skill_list(candidate_skills)

    results = []
    for skill in norm_job:
        status = "MATCH" if skill in norm_candidate else "MISSING"
        results.append({"skill": skill, "status": status})
    return results
