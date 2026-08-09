import json
import os
import re
import sys

# Engine Modules (Set 1)
from engine.job_requirement_analyzer import analyze_job_description
from engine.scoring_engine import score_candidate

# Parser Modules (Set 2)
from parser.normalizer import normalize_text
from parser.personalDetailsExtraction import (
    extract_email,
    extract_github,
    extract_linkedin,
    extract_name,
    extract_phone,
)
from parser.section_parser import SectionParser
from parser.textAndLinkSeperator import extract_pdf


def parse_candidate_skills(sections: dict, clean_text: str) -> list:
    """Extracts candidate skills from parsed sections or full resume body."""
    raw_skill_lines = sections.get("skills", [])

    # Fallback if no specific skills section was detected
    if not raw_skill_lines:
        raw_skill_lines = [
            line for line in clean_text.splitlines() if "," in line or "•" in line
        ]

    extracted_skills = []
    for line in raw_skill_lines:
        cleaned_line = re.sub(r"[•●▪◦\-]", "", line)
        items = re.split(r"[,/|\n]", cleaned_line)
        for item in items:
            skill = item.strip()
            # Ignore bullet fragments, dates, or full sentences
            if skill and len(skill) < 40 and not re.search(r"\d", skill):
                extracted_skills.append(skill)

    return list(set(extracted_skills))


def parse_experience_years(sections: dict, clean_text: str) -> float:
    """Calculates total experience years from explicit text or date ranges."""
    exp_lines = sections.get("experience", [])
    exp_text = "\n".join(exp_lines) if exp_lines else clean_text

    # Search for explicit experience statements (e.g., "5 years' tenure")
    match = re.search(r"(\d+(?:\.\d+)?)\+?\s*years?", exp_text, re.IGNORECASE)
    if match:
        return float(match.group(1))

    # Calculate span from extracted four-digit years (e.g., 2019 - 2022)
    years = [int(y) for y in re.findall(r"\b(19\d\d|20\d\d)\b", exp_text)]
    if len(years) >= 2:
        diff = max(years) - min(years)
        if 0 < diff <= 40:
            return float(diff)

    return 0.0


def process_resume(pdf_path: str) -> dict:
    """Full parsing pipeline: PDF -> Text -> Cleaning -> Segmentation -> JSON."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"Resume PDF not found at path: {pdf_path}")

    # 1. Extract raw text and hyperlink URIs
    extracted = extract_pdf(pdf_path)
    raw_text = extracted.get("text", "")
    links = extracted.get("links", [])

    # 2. Normalize unicode characters, spaces, and line breaks
    clean_text = normalize_text(raw_text)

    # 3. Detect and segment section headers
    parser = SectionParser()
    sections = parser.segment(clean_text)

    # 4. Extract personal details & contact links
    contact_info = {
        "name": extract_name(clean_text) or "Unknown Candidate",
        "email": extract_email(clean_text),
        "phone": extract_phone(clean_text),
        "github": extract_github(links),
        "linkedin": extract_linkedin(links),
    }

    # 5. Extract skills and calculate total experience
    skills = parse_candidate_skills(sections, clean_text)
    exp_years = parse_experience_years(sections, clean_text)

    return {
        "contact": contact_info,
        "candidate_profile": {
            "name": contact_info["name"],
            "skills": skills,
            "experience_years": exp_years,
        },
    }


# Sample job description for demonstration
DEFAULT_JD = """
Java Backend Developer
Required: Java, Spring Boot, REST APIs, SQL, 2+ years experience
Preferred: Docker, AWS, Kafka
Education: Computer Science or related field
"""


def main():
    # Dynamically select input resume file or default to files/Resume-24cdr080.pdf
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else "files/Resume-24cdr080.pdf"

    print("==================================================")
    print(f" Processing Resume File: {pdf_path}")
    print("==================================================\n")

    # Step 1: Ingest and parse PDF resume into candidate schema
    parsed_data = process_resume(pdf_path)
    contact = parsed_data["contact"]
    candidate_profile = parsed_data["candidate_profile"]

    print("=== Extracted Candidate Contact Details ===")
    print(json.dumps(contact, indent=2))

    print("\n=== Parsed Candidate Profile ===")
    print(json.dumps(candidate_profile, indent=2))

    # Step 2: Extract requirements from Job Description
    job_profile = analyze_job_description(DEFAULT_JD)
    print("\n=== Structured Job Requirement Profile ===")
    print(json.dumps(job_profile, indent=2))

    # Step 3: Run requirement-aware scoring engine
    score_result = score_candidate(job_profile, candidate_profile)

    print("\n=== Requirement-Aware Evaluation Results ===")
    print(f"Candidate Name:       {score_result['candidate']}")
    print(f"Overall Score:        {score_result['overall_score']}%")
    print(f"Required Skill Fit:   {score_result['required_skill_fit']}%")
    print(f"Preferred Skill Fit:  {score_result['preferred_skill_fit']}%")
    print(f"Experience Fit:       {score_result['experience_fit']}%")
    print(f"Matched Required:     {score_result['matched_required']}")
    print(f"Missing Required:     {score_result['missing_required']}")
    print(f"Matched Preferred:    {score_result['matched_preferred']}")


if __name__ == "__main__":
    main()