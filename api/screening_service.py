# api/screening_service.py
"""
Screening Service: Core orchestration logic for RecruitIQ ATS.
Handles JD analysis, resume parsing (PDF/DOCX/TXT), matching, scoring, ranking, and in-memory cache for AI insights.
"""

from __future__ import annotations

import os
import re
import uuid
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional

from engine.job_requirement_analyzer import analyze_job_description
from engine.scoring_engine import score_candidate
from engine.skill_normalizer import extract_skills_from_text, normalize_skill_list
from engine.gemini_insights import generate_recruiter_insights, answer_followup_question
from main import process_resume, _parse_candidate_skills, _parse_experience_years, _parse_internship_years, validate_candidate
from parser.normalizer import normalize_text
from parser.section_parser import SectionParser
from parser.personalDetailsExtraction import (
    extract_email,
    extract_phone,
    extract_github,
    extract_linkedin,
    extract_name,
)
from api.document_reader import extract_text_from_file

# Global in-memory cache for candidate insights and chat context
# { candidate_id: { "candidate_profile": dict, "job_profile": dict, "score_result": dict, "cached_insight": dict|None, "conversation": list } }
CANDIDATE_STORE: Dict[str, Dict[str, Any]] = {}

# Check semantic matcher availability
try:
    from engine.semantic_matcher import _get_model, profile_similarity
    _get_model()
    SEMANTIC_AVAILABLE = True
except Exception:
    SEMANTIC_AVAILABLE = False


def analyze_jd(jd_text: str) -> dict:
    """Analyze and return structured job profile from raw JD text."""
    if not jd_text or not jd_text.strip():
        raise ValueError("Job description text cannot be empty.")
    profile = analyze_job_description(jd_text)
    profile["raw_text"] = jd_text
    return profile


def process_non_pdf_resume(file_path: Path) -> dict:
    """
    Process DOCX/DOC/TXT resumes using text extraction + linear section parsing.
    """
    raw_text = extract_text_from_file(file_path)
    clean_text = normalize_text(raw_text)
    links = re.findall(r'https?://[^\s<>"]+|www\.[^\s<>"]+', raw_text)

    parser = SectionParser()
    sections = parser.segment(clean_text)

    personal = {
        "name": extract_name(clean_text) or file_path.stem.replace("_", " ").title(),
        "name_confidence": 0.6,
        "email": extract_email(clean_text),
        "phone": extract_phone(clean_text),
        "github": extract_github(links, clean_text),
        "linkedin": extract_linkedin(links, clean_text),
    }

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
        "filename": file_path.name,
        "clean_text": clean_text,
        "resume_lines": [line.strip() for line in clean_text.splitlines() if line.strip()],
        "sections": sections,
        "personal": personal,
        "contact": personal,
        "candidate_profile": candidate_profile,
        "parse_method": "docx_text_parser" if file_path.suffix.lower() in (".docx", ".doc") else "text_parser",
    }

    validation = validate_candidate(result_dict)
    result_dict["validation"] = validation
    return result_dict


def process_single_resume(file_path: str | Path) -> dict:
    """
    Dispatch resume parsing based on file extension.
    """
    path = Path(file_path)
    if path.suffix.lower() == ".pdf":
        return process_resume(str(path))
    else:
        return process_non_pdf_resume(path)


def screen_candidates(
    jd_text: str,
    resume_file_paths: List[tuple[str, str]],  # List of (orig_filename, local_disk_path)
) -> dict:
    """
    Score a batch of resumes against a job description.
    """
    job_profile = analyze_jd(jd_text)
    candidates = []
    errors = []

    for orig_filename, disk_path in resume_file_paths:
        try:
            parsed = process_single_resume(disk_path)
            candidate_profile = parsed.get("candidate_profile", {})
            contact = parsed.get("personal", {})
            resume_lines = parsed.get("resume_lines", [])
            validation = parsed.get("validation", {"ok": True, "warnings": [], "extraction_status": "ok"})
            parse_method = parsed.get("parse_method", "layout")

            # Semantic similarity
            semantic_sim = 0.0
            if SEMANTIC_AVAILABLE:
                try:
                    profile_text = (
                        f"Skills: {', '.join(candidate_profile.get('skills', []))}. "
                        f"Experience: {candidate_profile.get('experience_years')} years. "
                        + " ".join(resume_lines[:30])
                    )
                    semantic_sim = profile_similarity(profile_text, jd_text)
                except Exception:
                    semantic_sim = 0.0

            # Score candidate
            score_res = score_candidate(
                job_profile,
                candidate_profile,
                resume_lines=resume_lines,
                use_semantic=SEMANTIC_AVAILABLE,
            )

            candidate_id = uuid.uuid4().hex

            # Store in in-memory store for on-demand insights
            CANDIDATE_STORE[candidate_id] = {
                "candidate_profile": candidate_profile,
                "job_profile": job_profile,
                "score_result": score_res,
                "cached_insight": None,
                "conversation": [],
            }

            candidates.append({
                "id": candidate_id,
                "filename": orig_filename,
                "name": candidate_profile.get("name") or contact.get("name") or "Unknown Candidate",
                "parse_method": parse_method,
                "validation": validation,
                "contact": contact,
                "profile": candidate_profile,
                "semantic_similarity": round(semantic_sim * 100, 1),
                "score": score_res,
            })
        except Exception as e:
            errors.append({
                "filename": orig_filename,
                "error": str(e),
            })

    # Sort descending by overall_score
    candidates.sort(key=lambda c: c["score"]["overall_score"], reverse=True)

    for rank_idx, cand in enumerate(candidates, start=1):
        cand["rank"] = rank_idx

    return {
        "job_profile": job_profile,
        "candidates": candidates,
        "errors": errors,
        "total_processed": len(resume_file_paths),
        "successful_count": len(candidates),
    }


def get_candidate_insights(candidate_id: str) -> dict:
    """Generate or retrieve cached Gemini AI insights for a candidate."""
    if candidate_id not in CANDIDATE_STORE:
        return {"status": "unavailable", "message": "Candidate session not found or expired."}

    data = CANDIDATE_STORE[candidate_id]
    if data.get("cached_insight"):
        return data["cached_insight"]

    insights = generate_recruiter_insights(
        data["candidate_profile"],
        data["job_profile"],
        data["score_result"],
    )

    if insights.get("status") == "ok":
        data["cached_insight"] = insights
        insights["candidate_id"] = candidate_id
        return insights
    else:
        return {
            "status": "unavailable",
            "message": insights.get("reason", "AI insights are currently unavailable. Ensure GEMINI_API_KEY is configured in .env."),
        }


def answer_candidate_question(candidate_id: str, question: str) -> dict:
    """Ask a follow-up question regarding the candidate and job."""
    if candidate_id not in CANDIDATE_STORE:
        return {"status": "unavailable", "message": "Candidate session not found or expired."}

    data = CANDIDATE_STORE[candidate_id]
    conversation = data.get("conversation", [])

    response = answer_followup_question(
        data["candidate_profile"],
        data["job_profile"],
        data["score_result"],
        conversation,
        question,
    )

    if response.get("status") == "ok":
        conversation.append({"role": "user", "content": question})
        conversation.append({"role": "model", "content": response["answer"]})
        data["conversation"] = conversation

    return response
