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

# How many top candidates to show a full "Why ranked?" breakdown for
TOP_N_EXPLAIN = 3


def print_why_ranked(rank: int, result: dict):
    """Prints the full explainable breakdown for a single candidate."""
    print("\n" + "=" * 50)
    print(f" WHY #{rank}? — {result['candidate']}  ({result['overall_score']}%)")
    print("=" * 50)
    print(f"Required Skill Fit:   {result['required_skill_fit']}%")
    print(f"Preferred Skill Fit:  {result['preferred_skill_fit']}%")
    print(f"Experience Fit:       {result['experience_fit']}%")
    print(f"Matched Required:     {result['matched_required']}")
    print(f"Missing Required:     {result['missing_required']}")
    print(f"Matched Preferred:    {result['matched_preferred']}")


def main():
    # Step 1: Analyze the job description once (shared across all candidates)
    job_profile = analyze_job_description(DEFAULT_JD)
    print("=== Structured Job Requirement Profile ===")
    print(json.dumps(job_profile, indent=2))

    # Step 2: Find every resume PDF to process.
    # Pass a single file path as an argument to test just one resume,
    # otherwise it defaults to every PDF found inside the 'files' folder.
    if len(sys.argv) > 1:
        pdf_paths = [sys.argv[1]]
    else:
        pdf_paths = [
            os.path.join("files", f)
            for f in os.listdir("files")
            if f.lower().endswith(".pdf")
        ]

    if not pdf_paths:
        print("\nNo PDF resumes found in the 'files' folder.")
        return

    print(f"\nFound {len(pdf_paths)} resume(s) to evaluate.\n")

    all_results = []

    # Step 3: Parse + score each resume, skipping any that fail to parse
    for pdf_path in pdf_paths:
        print("==================================================")
        print(f" Processing Resume File: {pdf_path}")
        print("==================================================")

        try:
            parsed_data = process_resume(pdf_path)
        except Exception as e:
            print(f"  [SKIPPED] Could not parse {pdf_path}: {e}\n")
            continue

        contact = parsed_data["contact"]
        candidate_profile = parsed_data["candidate_profile"]
        score_result = score_candidate(job_profile, candidate_profile)

        # attach filename + contact info so we can show it in the leaderboard
        score_result["filename"] = os.path.basename(pdf_path)
        score_result["contact"] = contact

        all_results.append(score_result)
        print(f"  -> {score_result['candidate']}: {score_result['overall_score']}% overall\n")

    if not all_results:
        print("No resumes could be successfully parsed.")
        return

    # Step 4: Rank by overall_score, highest first
    all_results.sort(key=lambda r: r["overall_score"], reverse=True)

    # Step 5: Print the ranked leaderboard (every candidate)
    print("\n" + "=" * 50)
    print(" CANDIDATE RANKING")
    print("=" * 50)
    for i, r in enumerate(all_results, 1):
        print(f"{i}. {r['candidate']:<25} {r['overall_score']}%   ({r['filename']})")

    # Step 6: Full "Why ranked?" breakdown for the top N candidates
    top_n = all_results[:TOP_N_EXPLAIN]
    for i, result in enumerate(top_n, 1):
        print_why_ranked(i, result)


if __name__ == "__main__":
    main()