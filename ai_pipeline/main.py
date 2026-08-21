"""
main.py — ATS Terminal POC Entry Point
=======================================
Run:  python main.py

Discovers every .pdf in files/, parses each one, scores against
job_description.txt, prints results, then prints a final ranking.

Pipeline:
  PDF
  → layout_parser.extract_layout()  [PRIMARY — layout-aware, preserves bbox/font]
  → structured sections, personal details, candidate profile
  → validation
  → matching (exact → normalized → semantic)
  → scoring
  → ranking
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

# ── Load .env FIRST — before any module that reads os.environ ────────────────
# load_dotenv() is called exactly once here so that GEMINI_API_KEY, HF_TOKEN,
# and GEMINI_MODEL are available to engine/gemini_insights.py and
# engine/semantic_matcher.py without each module needing its own dotenv call.
try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(override=False)  # does not overwrite values already in env
except ImportError:
    pass  # python-dotenv not installed — rely on environment variables directly

# Force UTF-8 stdout on Windows so Unicode chars print correctly
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass  # Not fatal

# ── Parser modules ──────────────────────────────────────────────────────────
from ai_pipeline.parser.layout_parser import (
    extract_layout,
    get_full_text,
    KNOWN_SECTION_HEADINGS,
    LayoutDocument,
)
from ai_pipeline.parser.normalizer import normalize_text

# Legacy fallback imports (used if layout parse fails)
from ai_pipeline.parser.textAndLinkSeperator import extract_pdf
from ai_pipeline.parser.personalDetailsExtraction import (
    extract_email,
    extract_phone,
    extract_github,
    extract_linkedin,
    extract_name,
)
from ai_pipeline.parser.section_parser import SectionParser

# ── Engine modules ──────────────────────────────────────────────────────────
from ai_pipeline.engine.skill_normalizer import extract_skills_from_text, normalize_skill_list
from ai_pipeline.engine.job_requirement_analyzer import analyze_job_description
from ai_pipeline.engine.scoring_engine import score_candidate
from ai_pipeline.engine.gemini_insights import generate_recruiter_insights

# ── Constants ───────────────────────────────────────────────────────────────
FILES_DIR = Path("files")
JD_FILE = Path("job_description.txt")

# Semantic skill-matching threshold (documented).
# 0.55 is intentionally set at the low end of the semantic range to catch
# synonyms (e.g., SQL ↔ MySQL scores ~0.69) while avoiding noise.
# False-positive guards in matcher.py prevent Java ↔ JavaScript matches.
SEMANTIC_SKILL_THRESHOLD = 0.55


# ══════════════════════════════════════════════════════════════════════════════
# Section ALIASES not in the layout_parser (for section_detector legacy path)
# ══════════════════════════════════════════════════════════════════════════════

# Skill sub-section keys produced by layout_parser
_SKILL_SUBSECTION_KEYS = {
    "skills", "skills_programming", "skills_database",
    "skills_design", "skills_arvr",
}


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


def _parse_experience_years(
    sections: dict,
    *,
    include_internships: bool = False
) -> Optional[float]:
    """
    Extract date ranges ONLY from experience/internship sections.

    IMPORTANT: Does NOT scan education sections (avoids degree dates
    being counted as work experience).  Does NOT scan full resume text
    as fallback — that is the bug that caused education dates to inflate
    experience in the previous version.

    Returns None if no date ranges are found (preserves "Unknown" semantic).
    """
    # Collect lines from relevant sections only
    exp_lines = list(sections.get("experience", []))
    if include_internships:
        exp_lines += list(sections.get("internships", []))

    if not exp_lines:
        return None  # Explicitly no experience section found

    exp_text = "\n".join(exp_lines)
    today = date.today()
    intervals: list[tuple[date, date]] = []

    for match in _RANGE_PATTERN.finditer(exp_text):
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

    intervals.sort(key=lambda x: x[0])
    merged: list[tuple[date, date]] = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))

    total_days = sum((end - start).days for start, end in merged)
    return round(total_days / 365.25, 2)


def _parse_internship_years(sections: dict) -> Optional[float]:
    """Separately compute internship duration."""
    internship_lines = sections.get("internships", [])
    if not internship_lines:
        return None
    # Reuse experience parser with only internship lines
    return _parse_experience_years({"experience": internship_lines})


# ══════════════════════════════════════════════════════════════════════════════
# Skill extraction from layout-aware sections
# ══════════════════════════════════════════════════════════════════════════════

def _parse_candidate_skills(sections: dict, full_text: str) -> list[str]:
    """
    Extract and normalize technical skills from the structured sections.

    Source priority:
    1. skills_* sub-section keys (layout parser extracted categories)
    2. skills section (flat list)
    3. Project technologies (from projects section)
    4. Internship technologies
    5. Summary/profile text (skills mentioned inline)

    Soft-skill and leadership sections are NOT scanned here.
    Awards/achievements are NOT scanned.

    Returns sorted deduplicated list of canonical skill names.
    """
    skills: set[str] = set()

    # 1. Layout-parsed skill sub-sections
    for key in _SKILL_SUBSECTION_KEYS:
        lines = sections.get(key, [])
        if lines:
            raw_tokens: list[str] = []
            for line in lines:
                line = re.sub(r"[•●▪◦\-]", " ", line)
                parts = re.split(r"[,/|:]+", line)
                for part in parts:
                    token = part.strip()
                    if token:
                        raw_tokens.append(token)
            skills |= normalize_skill_list(raw_tokens)
            # Also scan as free text for compound skills
            skills |= set(extract_skills_from_text(" ".join(lines)))

    # 2. Flat skills section
    flat_lines = sections.get("skills", [])
    if flat_lines:
        raw_tokens = []
        for line in flat_lines:
            line = re.sub(r"[•●▪◦\-]", " ", line)
            parts = re.split(r"[,/|:]+", line)
            for part in parts:
                token = part.strip()
                if token:
                    raw_tokens.append(token)
        skills |= normalize_skill_list(raw_tokens)
        skills |= set(extract_skills_from_text(" ".join(flat_lines)))

    # 3. Project sections — extract technologies
    for key in ("projects", "project"):
        proj_lines = sections.get(key, [])
        if proj_lines:
            skills |= set(extract_skills_from_text(" ".join(proj_lines)))

    # 4. Internship sections
    intern_lines = sections.get("internships", [])
    if intern_lines:
        skills |= set(extract_skills_from_text(" ".join(intern_lines)))

    # 5. Summary / profile — skills mentioned inline
    summary_lines = sections.get("summary", [])
    if summary_lines:
        skills |= set(extract_skills_from_text(" ".join(summary_lines)))

    # 6. Experience section
    exp_lines = sections.get("experience", [])
    if exp_lines:
        skills |= set(extract_skills_from_text(" ".join(exp_lines)))

    return sorted(skills)


# ══════════════════════════════════════════════════════════════════════════════
# Validation layer
# ══════════════════════════════════════════════════════════════════════════════

def validate_candidate(candidate_json: dict) -> dict:
    """
    Validate the structured candidate profile before it enters matching.

    Returns:
    {
        "ok": bool,
        "warnings": [str],
        "extraction_status": "ok" | "degraded" | "failed"
    }
    """
    warnings = []
    personal = candidate_json.get("personal", {})
    sections = candidate_json.get("sections", {})
    skills = candidate_json.get("candidate_profile", {}).get("skills", [])

    name = personal.get("name", "")
    name_confidence = personal.get("name_confidence", 1.0)

    # 1. Name checks
    if not name or name == "Unknown Candidate":
        warnings.append("NAME_MISSING")
    elif name.lower() in KNOWN_SECTION_HEADINGS:
        warnings.append("NAME_IS_SECTION_HEADING")
    elif name_confidence < 0.3:
        warnings.append(f"NAME_LOW_CONFIDENCE ({name_confidence:.2f}): {name!r}")

    # 2. Skill count
    if len(skills) == 0:
        # Check if there's a skills section that was detected but produced nothing
        skill_sections_present = any(
            sections.get(k) for k in _SKILL_SUBSECTION_KEYS | {"skills"}
        )
        if skill_sections_present:
            warnings.append("SKILLS_SECTION_PRESENT_BUT_ZERO_EXTRACTED")
        else:
            warnings.append("SKILLS_SECTION_NOT_FOUND_AND_ZERO_EXTRACTED")

    # 3. Projects
    if sections.get("projects") is not None and len(sections.get("projects", [])) == 0:
        warnings.append("PROJECTS_SECTION_PRESENT_BUT_EMPTY")

    # 4. Education
    if sections.get("education") is not None and len(sections.get("education", [])) == 0:
        warnings.append("EDUCATION_SECTION_PRESENT_BUT_EMPTY")

    # 5. Experience issues
    exp_years = candidate_json.get("candidate_profile", {}).get("experience_years")
    if isinstance(exp_years, (int, float)) and exp_years > 50:
        warnings.append(f"IMPOSSIBLE_EXPERIENCE ({exp_years}y)")

    ok = len(warnings) == 0
    if not ok:
        critical_warnings = [
            w for w in warnings
            if any(kw in w for kw in ("NAME_MISSING", "NAME_IS_SECTION", "SKILLS_SECTION_NOT_FOUND_AND_ZERO_EXTRACTED"))
        ]
        # SKILLS_SECTION_PRESENT_BUT_ZERO_EXTRACTED is DEGRADED, not FAILED:
        # it means the section existed but held no technical keywords
        # (correct for non-tech resumes like warehouse workers).
        status = "failed" if critical_warnings else "degraded"
    else:
        status = "ok"

    return {"ok": ok, "warnings": warnings, "extraction_status": status}


# ══════════════════════════════════════════════════════════════════════════════
# Resume processing pipeline
# ══════════════════════════════════════════════════════════════════════════════

def process_resume(pdf_path: str) -> dict:
    """
    Full pipeline: PDF → structured candidate dict.

    Primary path: layout_parser.extract_layout() (layout-aware)
    Fallback path: legacy textAndLinkSeperator + SectionParser

    Returns a dict compatible with the existing scoring/matching pipeline.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    def _build_result(method: str, layout_doc: Optional[LayoutDocument] = None) -> dict:
        if method == "layout" and layout_doc is not None:
            sections = layout_doc.sections
            personal = layout_doc.personal
            clean_text = get_full_text(layout_doc)
            links = layout_doc.links
            parse_method = "layout"
            clean_text = normalize_text(clean_text)
        else:
            extracted = extract_pdf(str(path))
            raw_text: str = extracted.get("text", "")
            links: list[str] = extracted.get("links", [])
            clean_text = normalize_text(raw_text)

            parser = SectionParser()
            sections = parser.segment(clean_text)

            personal = {
                "name": extract_name(clean_text) or "Unknown Candidate",
                "name_confidence": 0.5,  # unknown confidence for fallback
                "email": extract_email(clean_text),
                "phone": extract_phone(clean_text),
                "github": extract_github(links, clean_text),
                "linkedin": extract_linkedin(links, clean_text),
            }
            parse_method = "linear_fallback"

        skills = _parse_candidate_skills(sections, clean_text)
        experience_years = _parse_experience_years(sections)
        internship_years = _parse_internship_years(sections)

        candidate_profile = {
            "name": personal["name"],
            "skills": skills,
            "experience_years": experience_years,
            "internship_years": internship_years,
        }

        result_dict = {
            "filename": path.name,
            "clean_text": clean_text,
            "resume_lines": [line.strip() for line in clean_text.splitlines() if line.strip()],
            "sections": sections,
            "personal": personal,
            "contact": personal,
            "candidate_profile": candidate_profile,
            "parse_method": parse_method,
        }

        validation = validate_candidate(result_dict)
        result_dict["validation"] = validation
        return result_dict

    # ── PRIMARY: layout-aware parse ─────────────────────────────────────────
    try:
        doc = extract_layout(str(path))
        result = _build_result("layout", doc)
        if result["validation"]["extraction_status"] == "failed":
            print(f"  [WARN] Layout parse quality FAILED (warnings: {result['validation']['warnings']}), falling back to linear parse")
            result = _build_result("linear")
    except Exception as e:
        print(f"  [WARN] Layout parse failed ({e}), falling back to linear parse")
        result = _build_result("linear")

    return result


# ══════════════════════════════════════════════════════════════════════════════
# Gemini insights — see engine/gemini_insights.py
# ══════════════════════════════════════════════════════════════════════════════
# generate_recruiter_insights() is imported from engine.gemini_insights above.
# It is called AFTER scoring is complete and returns a structured dict.


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
    validation: dict,
    parse_method: str,
):
    print()
    _banner("ATS SCREENING RESULT")
    print()
    print(f"  Resume        : {filename}")
    print(f"  Parse Method  : {parse_method}")
    print(f"  Candidate     : {personal['name']}")
    if personal.get("name_confidence", 1.0) < 0.5:
        print(f"  Name Conf.    : LOW ({personal.get('name_confidence', 0):.2f})")
    print(f"  Email         : {personal['email'] or 'N/A'}")
    print(f"  Phone         : {personal['phone'] or 'N/A'}")
    print(f"  LinkedIn      : {personal['linkedin'] or 'N/A'}")
    print(f"  GitHub        : {personal['github'] or 'N/A'}")
    print()

    # ── Validation warnings ───────────────────────────────────────────────
    if not validation["ok"]:
        _hr()
        print(f"  PARSER QUALITY: {validation['extraction_status'].upper()}")
        _hr()
        for w in validation["warnings"]:
            print(f"  [!] {w}")
        print()

    # ── Candidate Profile ─────────────────────────────────────────────────
    _hr()
    print("  CANDIDATE PROFILE")
    _hr()
    exp = candidate["experience_years"]
    intern_exp = candidate.get("internship_years")
    print(f"  Experience    : {f'{exp} years' if exp is not None else 'Unknown'}")
    if intern_exp is not None:
        print(f"  Internships   : {intern_exp} years")
    print()
    skills_str = ", ".join(candidate["skills"]) if candidate["skills"] else "None detected"
    print(f"  Skills:")
    _print_wrapped(skills_str, indent=4)
    print()

    # ── Job Requirements ──────────────────────────────────────────────────
    _hr()
    print("  JOB REQUIREMENTS")
    _hr()
    print(f"  Required:  {', '.join(job_profile['required_skills'])}")
    print(f"  Preferred: {', '.join(job_profile['preferred_skills'])}")
    print(f"  Min Exp:   {job_profile['minimum_experience_years']} years")
    print()

    # ── Semantic Matching ─────────────────────────────────────────────────
    _hr()
    print("  SEMANTIC MATCHING")
    _hr()
    print(f"  Candidate <-> Job Semantic Similarity : {semantic_sim * 100:.1f}%")
    print(f"  (Skill-level threshold: {SEMANTIC_SKILL_THRESHOLD}  |  False-positive guards: Java/JS, React/Native)")
    print()

    # ── Skill Matching ────────────────────────────────────────────────────
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

    # ── Scoring ───────────────────────────────────────────────────────────
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

    # ── Extraction reliability note ───────────────────────────────────────
    if validation["extraction_status"] in ("failed", "degraded"):
        print(f"  [NOTE] Parser quality is {validation['extraction_status'].upper()}.")
        print(f"  Score may not reflect true candidate profile. Manual review recommended.")
        print()

    # ── AI Insights ───────────────────────────────────────────────────────────
    # Gemini insights have been moved to an ON-DEMAND backend API.
    # Normal batch screening does not generate or display insights automatically.
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


def _print_insight_section(label: str, text):
    """Print a single-paragraph insight field."""
    print(f"  {label}:")
    if text:
        for line in text.splitlines():
            print(f"    {line}")
    else:
        print("    (not available)")
    print()


def _print_insight_list(label: str, items: list):
    """Print a bullet-list insight field."""
    print(f"  {label}:")
    if items:
        for item in items:
            print(f"    - {item}")
    else:
        print("    - (none identified)")
    print()


def _print_ranking(ranking: list[dict]):
    print()
    _banner("FINAL RANKING")
    print()
    print(f"  {'Rank':<6} {'Candidate':<25} {'Score':<12} {'Req. Fit':<12} {'Parse'}")
    _hr()
    for i, entry in enumerate(ranking, 1):
        parse_flag = "" if entry.get("parse_ok", True) else " [!REVIEW]"
        print(
            f"  {i:<6} {entry['name']:<25} {entry['overall_score']:.1f}%{'':<7} "
            f"{entry['required_skill_fit']:.0f}%{'':<8} "
            f"{entry.get('parse_method', 'linear')}{parse_flag}"
        )
    print()
    print("=" * W)


# ══════════════════════════════════════════════════════════════════════════════
# Main orchestration
# ══════════════════════════════════════════════════════════════════════════════

def main():
    # ── Discover PDFs ─────────────────────────────────────────────────────
    if not FILES_DIR.exists():
        print(f"[FATAL] files/ directory not found.")
        sys.exit(1)

    pdfs = sorted(FILES_DIR.glob("*.pdf"))
    if not pdfs:
        print("[FATAL] No PDF files found in files/")
        sys.exit(1)

    print(f"\nFound {len(pdfs)} resume(s) in {FILES_DIR}/")

    # ── Load JD ───────────────────────────────────────────────────────────
    if not JD_FILE.exists():
        print(f"[FATAL] {JD_FILE} not found. Please create it.")
        sys.exit(1)

    jd_text = JD_FILE.read_text(encoding="utf-8")
    job_profile = analyze_job_description(jd_text)
    print(f"Job profile loaded: {len(job_profile['required_skills'])} required, "
          f"{len(job_profile['preferred_skills'])} preferred skills, "
          f"{job_profile['minimum_experience_years']}y min experience")

    # ── Pre-load MiniLM (once) ────────────────────────────────────────────
    print("Loading MiniLM semantic model...")
    try:
        from ai_pipeline.engine.semantic_matcher import _get_model
        _get_model()
        semantic_available = True
        print("Semantic model ready.")
    except Exception as e:
        semantic_available = False
        print(f"[WARN] Semantic model unavailable: {e}. Falling back to exact/normalized matching only.")

    print()

    # ── Process each resume ───────────────────────────────────────────────
    ranking: list[dict] = []
    
    import time

    for idx, pdf_path in enumerate(pdfs, 1):
        print(f"Processing {idx}/{len(pdfs)}: {pdf_path.name}")
        t0 = time.time()
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
        validation = parsed["validation"]
        parse_method = parsed.get("parse_method", "linear_fallback")

        # Semantic similarity (overall profile vs JD)
        if semantic_available:
            try:
                from ai_pipeline.engine.semantic_matcher import profile_similarity
                profile_text = (
                    f"Skills: {', '.join(candidate['skills'])}. "
                    f"Experience: {candidate['experience_years']} years. "
                    + " ".join(resume_lines[:30])
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
        
        t1 = time.time()
        print(f"  -> Processing time: {t1 - t0:.2f}s")

        # Gemini insights generation removed from batch processing
        # per the ON-DEMAND architecture update.

        # Print result
        _print_result(
            filename=pdf_path.name,
            personal=personal,
            candidate=candidate,
            job_profile=job_profile,
            semantic_sim=semantic_sim,
            score_result=score_result,
            validation=validation,
            parse_method=parse_method,
        )

        ranking.append({
            "name": personal["name"],
            "filename": pdf_path.name,
            "overall_score": score_result["overall_score"],
            "required_skill_fit": score_result["required_skill_fit"],
            "parse_method": parse_method,
            "parse_ok": validation["ok"],
        })

    # ── Final ranking ──────────────────────────────────────────────────────
    if ranking:
        ranking.sort(key=lambda x: x["overall_score"], reverse=True)
        _print_ranking(ranking)
    else:
        print("[WARN] No resumes were successfully processed.")


if __name__ == "__main__":
    main()