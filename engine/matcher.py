from rapidfuzz import fuzz
from engine.skill_normalizer import normalize_skill


def match_skills(job_skills: list, candidate_skills: list, threshold: float = 75.0) -> list:
    """
    Requirement-aware skill matcher supporting:
    - Exact Match (status: "MATCH")
    - Normalized Match via canonical dictionary (status: "MATCH")
    - Fuzzy / Semantic Match via token_sort_ratio >= 75% (status: "RELATED")
    - Missing (status: "MISSING")

    Attaches non-normalized candidate skill string as 'evidence' for MATCH and RELATED.
    
    Returns: [{"skill": job_skill, "status": "MATCH"|"RELATED"|"MISSING", "evidence": str|None, "score": float}, ...]
    """
    results = []

    for job_skill in job_skills:
        clean_js = job_skill.strip()
        norm_js = normalize_skill(clean_js)
        lower_js = clean_js.lower()

        matched = False
        match_evidence = None

        # 1. Exact and Normalized Matching Pass
        for cand_skill in candidate_skills:
            clean_cs = cand_skill.strip()
            norm_cs = normalize_skill(clean_cs)
            lower_cs = clean_cs.lower()

            # Strip section prefixes if present (e.g., "Languages: Java" -> "Java")
            sub_cs = clean_cs.split(":", 1)[-1].strip() if ":" in clean_cs else clean_cs
            norm_sub_cs = normalize_skill(sub_cs)
            lower_sub_cs = sub_cs.lower()

            if (
                lower_cs == lower_js
                or lower_sub_cs == lower_js
                or norm_cs == norm_js
                or norm_sub_cs == norm_js
            ):
                matched = True
                match_evidence = cand_skill  # original non-normalized string
                break

        if matched:
            results.append({
                "skill": clean_js,
                "status": "MATCH",
                "evidence": match_evidence,
                "score": 100.0,
            })
            continue

        # 2. Fuzzy / Semantic Matching Pass
        best_ratio = 0.0
        best_cand_evidence = None

        for cand_skill in candidate_skills:
            clean_cs = cand_skill.strip()
            norm_cs = normalize_skill(clean_cs)
            lower_cs = clean_cs.lower()

            sub_cs = clean_cs.split(":", 1)[-1].strip() if ":" in clean_cs else clean_cs
            norm_sub_cs = normalize_skill(sub_cs)
            lower_sub_cs = sub_cs.lower()

            # Check fuzzy token ratios across raw, normalized, and prefix-stripped variants
            r1 = fuzz.token_sort_ratio(lower_js, lower_cs)
            r2 = fuzz.token_sort_ratio(norm_js, norm_cs)
            r3 = fuzz.token_sort_ratio(lower_js, lower_sub_cs)
            r4 = fuzz.token_sort_ratio(norm_js, norm_sub_cs)

            cand_best = max(r1, r2, r3, r4)
            if cand_best > best_ratio:
                best_ratio = cand_best
                best_cand_evidence = cand_skill

        if best_ratio >= threshold and best_cand_evidence is not None:
            results.append({
                "skill": clean_js,
                "status": "RELATED",
                "evidence": best_cand_evidence,
                "score": round(best_ratio, 1),
            })
        else:
            results.append({
                "skill": clean_js,
                "status": "MISSING",
                "evidence": None,
                "score": 0.0,
            })

    return results
