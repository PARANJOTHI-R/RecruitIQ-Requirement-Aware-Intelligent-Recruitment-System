# Canonical skill dictionary. Add aliases as you discover them in real resumes.
CANONICAL_SKILLS = {
    "js": "javascript",
    "javascript": "javascript",
    "reactjs": "react",
    "react.js": "react",
    "react": "react",
    "node": "nodejs",
    "node.js": "nodejs",
    "nodejs": "nodejs",
    "springboot": "spring boot",
    "spring boot": "spring boot",
    "spring": "spring boot",
    "sql": "sql",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "aws": "aws",
    "docker": "docker",
    "kafka": "kafka",
    "java": "java",
    "python": "python",
    "rest": "rest apis",
    "rest apis": "rest apis",
    "restapi": "rest apis",
    "rest api": "rest apis",
}


def normalize_skill(raw_skill: str) -> str:
    """Maps a raw skill string to its canonical form."""
    key = raw_skill.strip().lower()
    return CANONICAL_SKILLS.get(key, key)  # unknown skills pass through as-is


def normalize_skill_list(skills: list) -> set:
    return {normalize_skill(s) for s in skills}
