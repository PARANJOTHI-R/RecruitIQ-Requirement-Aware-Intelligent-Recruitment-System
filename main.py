"""
main.py — ATS Terminal POC Entry Point
=======================================
Run:  python main.py

Discovers every .pdf in files/, parses each one, scores against
job_description.txt, prints results, then prints a final ranking.
"""

from __future__ import annotations

import io
import os
import re
import sys
import traceback
from pathlib import Path
from datetime import date
from typing import Optional

# Force UTF-8 stdout on Windows so Unicode chars (✓ ✗) print correctly
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass  # Not fatal — worst case we get replacement chars


# ── Parser modules ─────────────────────────────────────────────────────────────
from parser.textAndLinkSeperator import extract_pdf
from parser.normalizer import normalize_text
from parser.personalDetailsExtraction import (
    extract_email,
    extract_phone,
    extract_github,
    extract_linkedin,
    extract_name,
)
from parser.section_parser import SectionParser

# ── Engine modules ─────────────────────────────────────────────────────────────
from engine.skill_normalizer import extract_skills_from_text, normalize_skill_list
from engine.job_requirement_analyzer import analyze_job_description
from engine.scoring_engine import score_candidate

# ── Constants ──────────────────────────────────────────────────────────────────
FILES_DIR = Path("files")
JD_FILE = Path("job_description.txt")
SEMANTIC_THRESHOLD = 0.55   # minimum cosine for a semantic skill match


# ══════════════════════════════════════════════════════════════════════════════
# Experience date-range parser
# ══════════════════════════════════════════════════════════════════════════════

MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

# Regex: captures date ranges like "Jan 2021 - Jul 2022" or "2021 - Present"
# Uses positional groups to avoid duplicate named-group errors
# Group layout: (optional_month_1)(year_1)(optional_month_2)(year_2 | present)
_PRESENT_RE = r"(?:present|current|now|ongoing)"
_SEP_RE = r"[\s]*(?:[-\u2013\u2014]|to)[\s]*"
_MONTH_OPT = r"(?:([A-Za-z]+)\s+)?"    # optional month word
_YEAR = r"(\d{4})"                      # 4-digit year

_RANGE_PATTERN = re.compile(
    rf"{_MONTH_OPT}{_YEAR}{_SEP_RE}(?:{_MONTH_OPT}{_YEAR}|({_PRESENT_RE}))",
    re.IGNORECASE,
)


def _parse_date_token(month_str: Optional[str], year_str: str) -> date:
    year = int(year_str)
    month = MONTH_MAP.get(month_str.lower(), 1) if month_str else 1
    return date(year, month, 1)


def _parse_experience_years(sections: dict, clean_text: str) -> Optional[float]:
    """
    Extract date ranges from the experience section and compute total experience
    in years (non-overlapping intervals).
    Returns None if no date ranges are found.
    """
    exp_lines = sections.get("experience", []) or sections.get("internships", [])
    if not exp_lines:
        # Fallback: search the whole resume
        exp_text = clean_text
    else:
        exp_text = "\n".join(exp_lines)

    today = date.today()
    intervals: list[tuple[date, date]] = []

    for match in _RANGE_PATTERN.finditer(exp_text):
        # Positional groups from _RANGE_PATTERN:
        #   1 = left month (optional word)
        #   2 = left year  (4 digits)
        #   3 = right month (optional word)
        #   4 = right year (4 digits, optional)
        #   5 = "present" keyword (optional)
        month1  = match.group(1)
        year1   = match.group(2)
        month2  = match.group(3)
        year2   = match.group(4)
        present = match.group(5)

        if not year1:
            continue
        try:
            start_date = _parse_date_token(month1, year1)
        except (ValueError, KeyError):
            continue

        if present:
            end_date = today
        elif year2:
            try:
                end_date = _parse_date_token(month2, year2)
            except (ValueError, KeyError):
                continue
        else:
            continue

        if end_date < start_date:
            continue

        intervals.append((start_date, end_date))

    if not intervals:
        return None


    # Merge overlapping intervals to avoid double-counting
    intervals.sort(key=lambda x: x[0])
    merged: list[tuple[date, date]] = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))

    total_days = sum((end - start).days for start, end in merged)
    return round(total_days / 365.25, 2)


# ══════════════════════════════════════════════════════════════════════════════
# Skill extraction
# ══════════════════════════════════════════════════════════════════════════════

def _parse_candidate_skills(sections: dict, clean_text: str) -> list[str]:
    """
    1. Try the explicit skills section lines — tokenise and normalise.
    2. Fall back to scanning the full resume text for known skill tokens.
    Returns a sorted, deduplicated list of canonical skill names.
    """
    raw_skill_lines = sections.get("skills", [])

    if raw_skill_lines:
        raw_tokens: list[str] = []
        for line in raw_skill_lines:
            # Remove bullets / decorators
            line = re.sub(r"[•●▪◦\-]", " ", line)
            # Split by common delimiters
            parts = re.split(r"[,/|:]+", line)
            for part in parts:
                token = part.strip()
                if token:
                    raw_tokens.append(token)

        # Also try multi-word combos from the skills section text
        skills_text = " ".join(raw_skill_lines)
        # Normalize via whitelist
        from_tokens = normalize_skill_list(raw_tokens)
        from_text = set(extract_skills_from_text(skills_text))
        skills = from_tokens | from_text
    else:
        # No skills section — scan entire resume
        skills = set(extract_skills_from_text(clean_text))

    # Also augment from experience/projects sections (catches tech mentioned in bullets)
    extra_sections = ["experience", "projects", "internships"]
    for sec in extra_sections:
        sec_text = " ".join(sections.get(sec, []))
        if sec_text:
            skills |= set(extract_skills_from_text(sec_text))

    return sorted(skills)


# ══════════════════════════════════════════════════════════════════════════════
# Resume processing pipeline
# ══════════════════════════════════════════════════════════════════════════════

def process_resume(pdf_path: str) -> dict:
    """
    Full pipeline: PDF → structured candidate dict.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    # 1. Extract raw text + PDF link annotations
    extracted = extract_pdf(str(path))
    raw_text: str = extracted.get("text", "")
    links: list[str] = extracted.get("links", [])

    # 2. Normalize text
    clean_text = normalize_text(raw_text)

    # 3. Detect and segment sections
    parser = SectionParser()
    sections = parser.segment(clean_text)

    # 4. Personal details (text + links)
    personal = {
        "name": extract_name(clean_text) or "Unknown Candidate",
        "email": extract_email(clean_text),
        "phone": extract_phone(clean_text),
        "github": extract_github(links, clean_text),
        "linkedin": extract_linkedin(links, clean_text),
    }

    # 5. Skills
    skills = _parse_candidate_skills(sections, clean_text)

    # 6. Experience
    experience_years = _parse_experience_years(sections, clean_text)

    return {
        "filename": path.name,
        "clean_text": clean_text,
        "resume_lines": [line.strip() for line in clean_text.splitlines() if line.strip()],
        "sections": sections,
        "personal": personal,
        "contact": personal,
        "candidate_profile": {
            "name": personal["name"],
            "skills": skills,
            "experience_years": experience_years,
        },
    }


def _gemini_insights(candidate: dict, job_profile: dict, score_result: dict) -> str:
    """
    Call Gemini for human-readable insights.
    Returns formatted string or "AI Insights: unavailable" on failure.
    """
    try:
        import google.generativeai as genai

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return "AI Insights: unavailable (GEMINI_API_KEY not set)"

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        matched_req = [r["skill"] for r in score_result["required_results"] if r["status"] == "MATCH"]
        missing_req = [r["skill"] for r in score_result["required_results"] if r["status"] == "MISSING"]
        matched_pref = [r["skill"] for r in score_result["preferred_results"] if r["status"] == "MATCH"]
        missing_pref = [r["skill"] for r in score_result["preferred_results"] if r["status"] == "MISSING"]

        prompt = f"""You are an ATS assistant generating a brief candidate screening summary.
Do NOT recalculate scores. Do NOT invent skills or experience. Only use the data provided below.

Candidate: {candidate['name']}
Skills: {', '.join(candidate['skills']) or 'None listed'}
Experience: {candidate['experience_years']} years

Job: {', '.join(job_profile['required_skills'])} (required), {', '.join(job_profile['preferred_skills'])} (preferred)
Min experience: {job_profile['minimum_experience_years']} years

Overall Score (calculated by Python): {score_result['overall_score']}%
Required Skill Fit: {score_result['required_skill_fit']}%
Preferred Skill Fit: {score_result['preferred_skill_fit']}%
Experience Fit: {score_result['experience_fit']}%

Matched Required Skills: {', '.join(matched_req) or 'None'}
Missing Required Skills: {', '.join(missing_req) or 'None'}
Matched Preferred Skills: {', '.join(matched_pref) or 'None'}
Missing Preferred Skills: {', '.join(missing_pref) or 'None'}

Provide ONLY:
Strengths:
- (2-3 bullet points about what the candidate does well)

Skill Gaps:
- (missing required/preferred skills, if any)

Summary:
(1-2 sentence overall screening summary)
"""
        response = model.generate_content(prompt)
        return response.text.strip()

    except Exception as e:
        return f"AI Insights: unavailable ({type(e).__name__}: {e})"


# ══════════════════════════════════════════════════════════════════════════════
# Terminal output helpers
# ══════════════════════════════════════════════════════════════════════════════

W = 70  # output width


def _hr(char="-"):
    print(char * W)


def _banner(title: str, char="="):
    print(char * W)
    print(title.center(W))
    print(char * W)


def _print_result(
    filename: str,
    personal: dict,
    candidate: dict,
    job_profile: dict,
    semantic_sim: float,
    score_result: dict,
    insights: str,
):
    print()
    _banner("ATS SCREENING RESULT")
    print()
    print(f"  Resume        : {filename}")
    print(f"  Candidate     : {personal['name']}")
    print(f"  Email         : {personal['email'] or 'N/A'}")
    print(f"  Phone         : {personal['phone'] or 'N/A'}")
    print(f"  LinkedIn      : {personal['linkedin'] or 'N/A'}")
    print(f"  GitHub        : {personal['github'] or 'N/A'}")
    print()

    # ── Candidate Profile ─────────────────────────────────────────────────────
    _hr()
    print("  CANDIDATE PROFILE")
    _hr()
    exp = candidate["experience_years"]
    print(f"  Experience    : {f'{exp} years' if exp is not None else 'Unknown'}")
    print()
    skills_str = ", ".join(candidate["skills"]) if candidate["skills"] else "None detected"
    print(f"  Skills:")
    # Word-wrap skills at ~65 chars
    _print_wrapped(skills_str, indent=4)
    print()

    # ── Job Requirements ──────────────────────────────────────────────────────
    _hr()
    print("  JOB REQUIREMENTS")
    _hr()
    print(f"  Required:  {', '.join(job_profile['required_skills'])}")
    print(f"  Preferred: {', '.join(job_profile['preferred_skills'])}")
    print(f"  Min Exp:   {job_profile['minimum_experience_years']} years")
    print()

    # ── Semantic Matching ─────────────────────────────────────────────────────
    _hr()
    print("  SEMANTIC MATCHING")
    _hr()
    print(f"  Candidate <-> Job Semantic Similarity : {semantic_sim * 100:.1f}%")
    print()

    # ── Skill Matching ────────────────────────────────────────────────────────
    _hr()
    print("  SKILL MATCHING")
    _hr()

    def _print_skill_results(results: list[dict]):
        for r in results:
            symbol = "[+]" if r["status"] == "MATCH" else "[-]"
            print(f"  {symbol} {r['skill']}")
            if r["status"] == "MATCH":
                mt = r["match_type"] or "exact"
                print(f"    Match Type : {mt.capitalize()}", end="")
                if r.get("similarity"):
                    print(f"  (similarity: {r['similarity']:.2f})", end="")
                print()
                ev = r.get("evidence")
                ev_display = (ev[:80] + "...") if ev and len(ev) > 80 else (ev or "N/A")
                print(f"    Evidence   : {ev_display}")
            else:
                print(f"    Match Type : Missing")
                print(f"    Evidence   : None")
            print()

    print("\n  REQUIRED SKILLS\n")
    _print_skill_results(score_result["required_results"])
    print("  PREFERRED SKILLS\n")
    _print_skill_results(score_result["preferred_results"])

    # ── Scoring ───────────────────────────────────────────────────────────────
    _hr()
    print("  SCORING")
    _hr()
    req_fit = score_result["required_skill_fit"]
    pref_fit = score_result["preferred_skill_fit"]
    exp_fit = score_result["experience_fit"]
    overall = score_result["overall_score"]

    print(f"  Required Skills      : {req_fit}%")
    print(f"  Preferred Skills     : {pref_fit}%")
    print(f"  Experience           : {f'{exp_fit}%' if exp_fit is not None else 'N/A (unknown experience)'}")
    print()
    print(f"  OVERALL SCORE        : {overall}%")
    print()

    # ── AI Insights ───────────────────────────────────────────────────────────
    _hr()
    print("  AI INSIGHTS")
    _hr()
    for line in insights.splitlines():
        print(f"  {line}")
    print()
    print("=" * W)


def _print_wrapped(text: str, indent: int = 2, width: int = 65):
    words = text.split(", ")
    line = ""
    for word in words:
        if len(line) + len(word) + 2 > width:
            print(" " * indent + line.rstrip(", "))
            line = ""
        line += word + ", "
    if line:
        print(" " * indent + line.rstrip(", "))


def _print_ranking(ranking: list[dict]):
    print()
    _banner("FINAL RANKING")
    print()
    print(f"  {'Rank':<6} {'Candidate':<25} {'Score':<12} {'Required Skill Fit'}")
    _hr()
    for i, entry in enumerate(ranking, 1):
        print(
            f"  {i:<6} {entry['name']:<25} {entry['overall_score']:.1f}%{'':<7} "
            f"{entry['required_skill_fit']:.0f}%"
        )
    print()
    print("=" * W)


# ══════════════════════════════════════════════════════════════════════════════
# Main orchestration
# ══════════════════════════════════════════════════════════════════════════════

def main():
    # ── Discover PDFs ──────────────────────────────────────────────────────────
    if not FILES_DIR.exists():
        print(f"[FATAL] files/ directory not found.")
        sys.exit(1)

    pdfs = sorted(FILES_DIR.glob("*.pdf"))
    if not pdfs:
        print("[FATAL] No PDF files found in files/")
        sys.exit(1)

    print(f"\nFound {len(pdfs)} resume(s) in {FILES_DIR}/")

    # ── Load JD ────────────────────────────────────────────────────────────────
    if not JD_FILE.exists():
        print(f"[FATAL] {JD_FILE} not found. Please create it.")
        sys.exit(1)

    jd_text = JD_FILE.read_text(encoding="utf-8")
    job_profile = analyze_job_description(jd_text)
    print(f"Job profile loaded: {len(job_profile['required_skills'])} required, "
          f"{len(job_profile['preferred_skills'])} preferred skills, "
          f"{job_profile['minimum_experience_years']}y min experience")

    # ── Pre-load MiniLM (once) ─────────────────────────────────────────────────
    print("Loading MiniLM semantic model...")
    try:
        from engine.semantic_matcher import _get_model
        _get_model()
        semantic_available = True
        print("Semantic model ready.")
    except Exception as e:
        semantic_available = False
        print(f"[WARN] Semantic model unavailable: {e}. Falling back to exact/normalized matching only.")

    print()

    # ── Process each resume ────────────────────────────────────────────────────
    ranking: list[dict] = []

    for idx, pdf_path in enumerate(pdfs, 1):
        print(f"Processing {idx}/{len(pdfs)}: {pdf_path.name}")

        try:
            parsed = process_resume(str(pdf_path))
        except Exception as e:
            print(f"\n[ERROR] {pdf_path.name}")
            print(f"  Reason: {e}")
            traceback.print_exc()
            print()
            continue

        personal = parsed["personal"]
        candidate = parsed["candidate_profile"]
        resume_lines = parsed["resume_lines"]
        clean_text = parsed["clean_text"]

        # Semantic similarity (overall profile vs JD)
        if semantic_available:
            try:
                from engine.semantic_matcher import profile_similarity
                # Build a concise candidate profile text for embedding
                profile_text = (
                    f"Skills: {', '.join(candidate['skills'])}. "
                    f"Experience: {candidate['experience_years']} years. "
                    + " ".join(resume_lines[:30])  # first 30 lines for context
                )
                semantic_sim = profile_similarity(profile_text, jd_text)
            except Exception:
                semantic_sim = 0.0

        else:
            semantic_sim = 0.0

        # Score
        score_result = score_candidate(
            job_profile,
            candidate,
            resume_lines=resume_lines,
            use_semantic=semantic_available,
        )

        # Gemini insights
        insights = _gemini_insights(candidate, job_profile, score_result)

        # Print result
        _print_result(
            filename=pdf_path.name,
            personal=personal,
            candidate=candidate,
            job_profile=job_profile,
            semantic_sim=semantic_sim,
            score_result=score_result,
            insights=insights,
        )

        ranking.append({
            "name": personal["name"],
            "filename": pdf_path.name,
            "overall_score": score_result["overall_score"],
            "required_skill_fit": score_result["required_skill_fit"],
        })

    # ── Final ranking ──────────────────────────────────────────────────────────
    if ranking:
        ranking.sort(key=lambda x: x["overall_score"], reverse=True)
        _print_ranking(ranking)
    else:
        print("[WARN] No resumes were successfully processed.")


if __name__ == "__main__":
    main()