import re
import json


def analyze_job_description(jd_text: str) -> dict:
    """
    Converts a raw job description into a structured requirement profile.
    This is a RULE-BASED analyzer (no LLM/embedding needed) - good enough
    for a POC. Maps to Section 9 of the project doc: "Job Requirement Analyzer".
    """
    profile = {
        "required_skills": [],
        "preferred_skills": [],
        "experience": {"minimum_years": 0},
        "education": [],
        "constraints": [],
    }

    current_section = None
    for line in jd_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        lower = stripped.lower()

        if lower.startswith("required"):
            current_section = "required"
            stripped = stripped.split(":", 1)[-1]
        elif lower.startswith("preferred"):
            current_section = "preferred"
            stripped = stripped.split(":", 1)[-1]
        elif lower.startswith("education"):
            current_section = "education"
            stripped = stripped.split(":", 1)[-1]

        # pick up "2+ years" / "3 years" anywhere in the line
        exp_match = re.search(r"(\d+)\+?\s*years?", lower)
        if exp_match:
            years = int(exp_match.group(1))
            profile["experience"]["minimum_years"] = max(
                profile["experience"]["minimum_years"], years
            )

        if current_section in ("required", "preferred") and stripped.strip():
            skills = [s.strip() for s in stripped.split(",") if s.strip()]
            # drop fragments like "2+ years experience" that aren't real skills
            skills = [
                s for s in skills
                if not re.match(r"^\d+\+?\s*years?", s.strip().lower())
            ]
            if current_section == "required":
                profile["required_skills"].extend(skills)
            else:
                profile["preferred_skills"].extend(skills)
        elif current_section == "education" and stripped.strip():
            profile["education"].append(stripped.strip())

    return profile


if __name__ == "__main__":
    sample_jd = """
    Java Backend Developer
    Required: Java, Spring Boot, REST APIs, SQL, 2+ years experience
    Preferred: Docker, AWS, Kafka
    Education: Computer Science or related field
    """
    print(json.dumps(analyze_job_description(sample_jd), indent=2))
