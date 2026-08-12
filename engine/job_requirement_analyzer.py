# engine/job_requirement_analyzer.py
#
# Rule-based JD parser.  No LLM.
# Produces a flat profile dict with keys that match what scoring_engine expects.

import re


def analyze_job_description(jd_text: str) -> dict:
    """
    Convert raw JD text → structured requirement profile.

    Returns:
    {
        "required_skills":         [...],
        "preferred_skills":        [...],
        "minimum_experience_years": int,
    }
    """
    profile = {
        "required_skills": [],
        "preferred_skills": [],
        "minimum_experience_years": 0,
    }

    current_section = None

    for line in jd_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        lower = stripped.lower()

        # ── Section header detection ─────────────────────────────────────────
        if re.match(r"required\s*skills?\s*:?", lower):
            current_section = "required"
            # Content after the colon on the same line (if any)
            after = stripped.split(":", 1)[-1].strip()
            stripped = after
            lower = after.lower()
        elif re.match(r"preferred\s*skills?\s*:?", lower):
            current_section = "preferred"
            after = stripped.split(":", 1)[-1].strip()
            stripped = after
            lower = after.lower()
        elif re.match(r"education\s*:?", lower):
            current_section = "education"
            continue

        # ── Experience year extraction (anywhere in the JD) ──────────────────
        exp_match = re.search(r"(\d+)\+?\s*years?", lower)
        if exp_match:
            years = int(exp_match.group(1))
            profile["minimum_experience_years"] = max(
                profile["minimum_experience_years"], years
            )

        # ── Skill ingestion ───────────────────────────────────────────────────
        if current_section in ("required", "preferred") and stripped:
            # If this looks like a prose sentence rather than a skill list, stop
            # (e.g. "The candidate should have experience developing...")
            if _is_prose(stripped):
                current_section = None
                continue
            # Skills may appear comma-separated on one line OR one per line
            skills = [s.strip() for s in re.split(r"[,\n]", stripped) if s.strip()]
            # Drop obvious non-skills: year fragments, empty, very long phrases
            skills = [
                s for s in skills
                if s
                and not re.match(r"^\d+\+?\s*years?", s.lower())
                and len(s) <= 40
                and not _is_prose(s)
            ]
            if current_section == "required":
                profile["required_skills"].extend(skills)
            else:
                profile["preferred_skills"].extend(skills)

    # Deduplicate while preserving order
    profile["required_skills"] = _dedup(profile["required_skills"])
    profile["preferred_skills"] = _dedup(profile["preferred_skills"])

    return profile


def _is_prose(text: str) -> bool:
    """
    Returns True if the text looks like a prose sentence rather than a skill name.
    Heuristics:
    - More than 6 words
    - Contains common sentence starters or verbs
    """
    words = text.strip().split()
    if len(words) > 6:
        return True
    prose_starters = (
        "the ", "we ", "our ", "candidate ", "applicant ",
        "you ", "this ", "a ", "an ", "please ",
    )
    lower = text.lower()
    if any(lower.startswith(s) for s in prose_starters):
        return True
    # Contains sentence-level conjunctions
    if re.search(r"\b(should|must|will|can|have|has|with|and|or|but|for|are|is)\b", lower):
        if len(words) > 3:
            return True
    return False


def _dedup(lst: list) -> list:
    seen = set()
    out = []
    for x in lst:
        xl = x.lower()
        if xl not in seen:
            seen.add(xl)
            out.append(x)
    return out



if __name__ == "__main__":
    import json
    sample = open("job_description.txt").read()
    print(json.dumps(analyze_job_description(sample), indent=2))
