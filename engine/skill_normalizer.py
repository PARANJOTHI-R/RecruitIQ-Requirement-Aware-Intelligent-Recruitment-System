# engine/skill_normalizer.py
#
# Canonical skill dictionary for the ATS POC.
# Maps raw text → canonical skill name (lowercase key → display-form value).
# Only skills present here (as VALUES) are treated as valid technical skills.
# Generic category words like "Backend", "Languages", "Cloud" are intentionally
# absent so they are never treated as skills.

ALIAS_MAP = {
    # Python ecosystem
    "python": "Python",
    "python3": "Python",

    # Java ecosystem
    "java": "Java",
    "spring": "Spring Boot",
    "spring boot": "Spring Boot",
    "springboot": "Spring Boot",
    "spring mvc": "Spring Boot",
    "spring framework": "Spring Boot",

    # JavaScript ecosystem
    "javascript": "JavaScript",
    "js": "JavaScript",
    "es6": "JavaScript",
    "ecmascript": "JavaScript",
    "typescript": "TypeScript",
    "ts": "TypeScript",

    # Web frontend
    "html": "HTML",
    "html5": "HTML",
    "css": "CSS",
    "css3": "CSS",
    "react": "React.js",
    "react.js": "React.js",
    "reactjs": "React.js",
    "react native": "React Native",
    "angular": "Angular",
    "angularjs": "Angular",
    "vue": "Vue.js",
    "vue.js": "Vue.js",
    "vuejs": "Vue.js",

    # Node / backend JS
    "node": "Node.js",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "express": "Express.js",
    "express.js": "Express.js",
    "expressjs": "Express.js",

    # Python web
    "django": "Django",
    "flask": "Flask",
    "fastapi": "FastAPI",
    "fast api": "FastAPI",

    # Databases
    "mysql": "MySQL",
    "sql": "SQL",
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "mongodb": "MongoDB",
    "mongo": "MongoDB",
    "redis": "Redis",
    "sqlite": "SQLite",
    "oracle": "Oracle SQL",
    "mssql": "SQL Server",
    "sql server": "SQL Server",

    # REST / APIs
    "rest": "REST API",
    "rest api": "REST API",
    "rest apis": "REST API",
    "restapi": "REST API",
    "restful": "REST API",
    "restful api": "REST API",
    "restful apis": "REST API",
    "graphql": "GraphQL",
    "jwt": "JWT",
    "oauth": "OAuth",

    # Cloud / DevOps
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "k8s": "Kubernetes",
    "aws": "AWS",
    "amazon web services": "AWS",
    "azure": "Azure",
    "gcp": "GCP",
    "google cloud": "GCP",
    "ci/cd": "CI/CD",
    "jenkins": "Jenkins",
    "github actions": "GitHub Actions",

    # Version control
    "git": "Git",
    "github": "GitHub",
    "gitlab": "GitLab",
    "bitbucket": "Bitbucket",

    # Tools
    "postman": "Postman",
    "jira": "Jira",
    "maven": "Maven",
    "gradle": "Gradle",
    "linux": "Linux",
    "bash": "Bash",
    "shell": "Shell",

    # ML / AI
    "machine learning": "Machine Learning",
    "ml": "Machine Learning",
    "deep learning": "Deep Learning",
    "dl": "Deep Learning",
    "nlp": "NLP",
    "natural language processing": "NLP",
    "computer vision": "Computer Vision",
    "cv": "Computer Vision",
    "tensorflow": "TensorFlow",
    "tf": "TensorFlow",
    "pytorch": "PyTorch",
    "scikit-learn": "scikit-learn",
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "spacy": "spaCy",
    "huggingface": "Hugging Face",
    "hugging face": "Hugging Face",
    "sentence transformers": "Sentence Transformers",

    # Architecture patterns
    "microservices": "Microservices",
    "micro services": "Microservices",

    # Other languages
    "c": "C",
    "c++": "C++",
    "cpp": "C++",
    "c#": "C#",
    "csharp": "C#",
    "go": "Go",
    "golang": "Go",
    "rust": "Rust",
    "kotlin": "Kotlin",
    "swift": "Swift",
    "php": "PHP",
    "ruby": "Ruby",
    "scala": "Scala",
    "r": "R",
}

# Set of valid canonical skill names (display form). Only these pass the whitelist.
KNOWN_SKILLS: set = set(ALIAS_MAP.values())


def normalize_skill(raw: str) -> str | None:
    """
    Map a raw token to its canonical display name.
    Returns None if the token is NOT a known technical skill
    (i.e., it's a generic word like 'Backend', 'Languages', etc.)
    """
    key = raw.strip().lower()
    return ALIAS_MAP.get(key)  # None if not found


def normalize_skill_list(skills: list) -> set:
    """
    Normalize a list of raw skill strings into a set of canonical names.
    Drops any token not found in ALIAS_MAP.
    """
    result = set()
    for s in skills:
        canonical = normalize_skill(s)
        if canonical:
            result.add(canonical)
    return result


def extract_skills_from_text(text: str) -> list:
    """
    Scan arbitrary text and extract all recognized skill tokens.
    Used as a fallback when the skills section is missing.
    Returns a sorted list of canonical skill names.
    """
    import re
    found = set()
    # Try multi-word phrases first (longest match wins)
    lower_text = text.lower()
    # Sort by length descending so longer aliases are tried first
    for alias in sorted(ALIAS_MAP.keys(), key=len, reverse=True):
        # Match whole-word alias in text
        pattern = r'(?<![a-z0-9.+#])' + re.escape(alias) + r'(?![a-z0-9.+#])'
        if re.search(pattern, lower_text, re.IGNORECASE):
            found.add(ALIAS_MAP[alias])
    return sorted(found)
