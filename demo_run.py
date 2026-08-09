"""
End-to-end POC demo, mirrors Section 28 of the project doc:
one job + several deliberately different candidates, to show that the
system does requirement-aware ranking, not just "similarity."

Run: python demo_run.py
"""
import json
from job_requirement_analyzer import analyze_job_description
from scoring_engine import score_candidate

JD_TEXT = """
Java Backend Developer
Required: Java, Spring Boot, REST APIs, SQL, 2+ years experience
Preferred: Docker, AWS, Kafka
Education: Computer Science or related field
"""

# These would eventually come from your teammate's resume parser output.
# Hardcoded for tonight so you're not blocked waiting on integration.
CANDIDATES = [
    {"name": "Candidate A", "skills": ["Java", "Spring Boot", "REST", "SQL", "Docker", "AWS"], "experience_years": 3},
    {"name": "Candidate B", "skills": ["Java", "REST", "SQL"], "experience_years": 1},
    {"name": "Candidate C", "skills": ["JavaScript", "Node.js", "MongoDB"], "experience_years": 3},
    {"name": "Candidate D", "skills": ["Java", "Spring Boot", "REST", "SQL"], "experience_years": 2.5},
]


def main():
    job_profile = analyze_job_description(JD_TEXT)
    print("=== Structured Job Requirement Profile ===")
    print(json.dumps(job_profile, indent=2))

    results = [score_candidate(job_profile, c) for c in CANDIDATES]
    results.sort(key=lambda r: r["overall_score"], reverse=True)

    print("\n=== Candidate Ranking ===")
    for i, r in enumerate(results, 1):
        print(f"{i}. {r['candidate']} - {r['overall_score']}")

    print("\n=== Why #1? ===")
    top = results[0]
    print(f"Required skill fit:  {top['required_skill_fit']}%")
    print(f"Preferred skill fit: {top['preferred_skill_fit']}%")
    print(f"Experience fit:      {top['experience_fit']}%")
    print(f"Matched required:    {top['matched_required']}")
    print(f"Missing required:    {top['missing_required']}")


if __name__ == "__main__":
    main()
