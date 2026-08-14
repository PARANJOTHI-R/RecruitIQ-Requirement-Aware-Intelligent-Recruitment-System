"""
engine/gemini_insights.py
=========================
Gemini-powered recruiter insights — the FINAL layer of the ATS pipeline.

Architecture position:
    PDF
    → Layout Parser
    → Structured Candidate
    → Job Requirement Analysis
    → Exact Matching
    → Normalized Matching
    → Semantic Matching (MiniLM)
    → Evidence
    → Scoring
    → Ranking
    → [THIS MODULE] Gemini Recruiter Insights

Responsibilities:
  - Load GEMINI_API_KEY and GEMINI_MODEL from environment (populated by
    load_dotenv() called once in main.py at startup).
  - Accept ALREADY PROCESSED ATS data (candidate dict, job_profile dict,
    score_result dict) — never raw PDF text or unscored candidates.
  - Generate seven structured recruiter-facing insights via Gemini using
    native JSON schema mode (response_mime_type + response_schema).
  - Return a structured dict; never raise to the caller.
  - Never log, print, or embed the API key anywhere.

Gemini does NOT:
  - Parse PDFs
  - Detect layout or columns
  - Extract names, emails, or phone numbers
  - Extract or normalize skills
  - Perform semantic matching
  - Calculate scores or rankings

All of those remain the exclusive responsibility of the existing
deterministic + MiniLM pipeline.
"""

from __future__ import annotations

import json
import os
from typing import Any

# ── Constants ──────────────────────────────────────────────────────────────────

# Default model — override via GEMINI_MODEL in .env
_DEFAULT_MODEL = "gemini-3.5-flash"

# JSON schema for the structured response Gemini must produce.
# Using the SDK's native schema enforcement so we don't embed JSON templates
# in the prompt (which confused the model and caused ServerErrors).
_INSIGHT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "candidate_summary": {
            "type": "STRING",
            "description": "2-3 sentence overview of the candidate for a recruiter",
        },
        "key_strengths": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "2-4 specific strengths based on matched skills/experience",
        },
        "skill_gaps": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "Missing required or preferred skills from the job",
        },
        "experience_relevance": {
            "type": "STRING",
            "description": "1-2 sentences on how experience aligns (or doesn't) with the role",
        },
        "potential_concerns": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "Notable gaps or risks for the recruiter to be aware of",
        },
        "interview_focus_areas": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "2-4 specific topics to probe in an interview",
        },
        "match_quality_explanation": {
            "type": "STRING",
            "description": "2-3 sentences explaining the overall score in recruiter-friendly language",
        },
    },
    "required": [
        "candidate_summary",
        "key_strengths",
        "skill_gaps",
        "experience_relevance",
        "potential_concerns",
        "interview_focus_areas",
        "match_quality_explanation",
    ],
}

# Sentinel returned when Gemini is unavailable or fails
_UNAVAILABLE: dict[str, Any] = {
    "status": "unavailable",
    "reason": "Gemini insights unavailable",
    "candidate_summary": None,
    "key_strengths": [],
    "skill_gaps": [],
    "experience_relevance": None,
    "potential_concerns": [],
    "interview_focus_areas": [],
    "match_quality_explanation": None,
}


# ── Internal helpers ───────────────────────────────────────────────────────────

def _get_client():
    """
    Return a configured google.genai Client.
    Raises ValueError (without exposing the key value) if the key is absent.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in the environment")

    from google import genai  # google-genai >= 2.0
    return genai.Client(api_key=api_key)


def _get_model_name() -> str:
    """Return the configured Gemini model, falling back to the default."""
    return os.environ.get("GEMINI_MODEL", "").strip() or _DEFAULT_MODEL


def _build_prompt(
    candidate: dict,
    job_profile: dict,
    score_result: dict,
) -> str:
    """
    Build a concise, clean prompt for Gemini.

    The prompt contains ONLY candidate/job data extracted by the ATS pipeline.
    The API key is NEVER included in the prompt.
    We rely on response_mime_type + response_schema for structure — no JSON
    template is embedded in the prompt itself (that caused ServerErrors).
    """
    name = candidate.get("name", "Unknown Candidate")
    skills = candidate.get("skills", [])
    exp_years = candidate.get("experience_years")
    intern_years = candidate.get("internship_years")

    req_skills = job_profile.get("required_skills", [])
    pref_skills = job_profile.get("preferred_skills", [])
    min_exp = job_profile.get("minimum_experience_years", 0)

    overall = score_result.get("overall_score", 0)
    req_fit = score_result.get("required_skill_fit", 0)
    pref_fit = score_result.get("preferred_skill_fit", 0)
    exp_fit = score_result.get("experience_fit")

    req_results = score_result.get("required_results", [])
    pref_results = score_result.get("preferred_results", [])

    matched_req = [r["skill"] for r in req_results if r.get("status") == "MATCH"]
    missing_req = [r["skill"] for r in req_results if r.get("status") == "MISSING"]
    matched_pref = [r["skill"] for r in pref_results if r.get("status") == "MATCH"]
    missing_pref = [r["skill"] for r in pref_results if r.get("status") == "MISSING"]

    # Top evidence lines (no sensitive data)
    evidence_lines: list[str] = []
    for r in req_results:
        if r.get("status") == "MATCH" and r.get("evidence"):
            evidence_lines.append(f"{r['skill']}: {r['evidence'][:80]}")
    evidence_block = "; ".join(evidence_lines[:4]) or "none available"

    exp_str = f"{exp_years} years" if exp_years is not None else "not found in parsed resume"
    intern_str = f"{intern_years} years" if intern_years is not None else "none found"
    exp_fit_str = f"{exp_fit}%" if exp_fit is not None else "N/A (experience not found)"

    return f"""\
You are an expert technical recruiter reviewing an ATS-screened candidate.
Base your analysis ONLY on the structured data below. Do NOT invent details not present.
If information is missing, state it was not found in the parsed resume.
Do NOT recalculate or second-guess the ATS scores — they are correct.

CANDIDATE: {name}
Extracted Skills: {", ".join(skills) if skills else "None detected"}
Work Experience: {exp_str}
Internship Experience: {intern_str}

JOB REQUIREMENTS:
Required Skills: {", ".join(req_skills) if req_skills else "None specified"}
Preferred Skills: {", ".join(pref_skills) if pref_skills else "None specified"}
Minimum Experience: {min_exp} years

ATS SCORES (computed by deterministic pipeline — do not change these):
Overall Score: {overall}%
Required Skill Fit: {req_fit}%
Preferred Skill Fit: {pref_fit}%
Experience Fit: {exp_fit_str}

SKILL MATCHING RESULTS:
Matched Required: {", ".join(matched_req) if matched_req else "None"}
Missing Required: {", ".join(missing_req) if missing_req else "None"}
Matched Preferred: {", ".join(matched_pref) if matched_pref else "None"}
Missing Preferred: {", ".join(missing_pref) if missing_pref else "None"}

Evidence from resume: {evidence_block}

Generate recruiter insights for all seven fields as specified."""


def _build_followup_prompt(
    candidate: dict,
    job_profile: dict,
    score_result: dict,
    conversation: list[dict],
    question: str,
) -> list:
    """
    Build a multi-turn conversation context for Gemini follow-up questions.
    Uses the genai.types.Content structure.
    """
    name = candidate.get("name", "Unknown Candidate")
    skills = candidate.get("skills", [])
    overall = score_result.get("overall_score", 0)

    system_instruction = f"""\
You are an expert technical recruiter answering a follow-up question about an ATS-screened candidate.
Base your analysis ONLY on the structured data below. Do NOT invent details not present.
Do NOT recalculate or second-guess the ATS scores — they are correct.

CANDIDATE: {name}
Extracted Skills: {", ".join(skills) if skills else "None detected"}
Overall Score: {overall}%

Please answer the user's question directly and concisely based on this context."""

    from google.genai import types

    contents = []
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=system_instruction)]))
    contents.append(types.Content(role="model", parts=[types.Part.from_text(text="Understood. I will answer based strictly on the provided context.")]))

    # Add limited conversation history (last 4 turns)
    for msg in conversation[-4:]:
        role = msg.get("role", "user")
        if role not in ["user", "model"]:
            role = "user"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.get("content", ""))]))

    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=question)]))

    return contents

# ── Public API ─────────────────────────────────────────────────────────────────

def generate_recruiter_insights(
    candidate: dict,
    job_profile: dict,
    score_result: dict,
) -> dict[str, Any]:
    """
    Generate structured recruiter-facing insights using Gemini.

    Called AFTER the full ATS pipeline:
        process_resume() → score_candidate() → [THIS FUNCTION]

    Uses the google-genai SDK's native JSON schema mode
    (response_mime_type='application/json' + response_schema) to guarantee
    a structured response without embedding JSON templates in the prompt.

    Parameters
    ----------
    candidate    : candidate_profile dict from process_resume()
    job_profile  : dict from analyze_job_description()
    score_result : dict from score_candidate()

    Returns
    -------
    dict with keys:
        status                   : "ok" | "unavailable"
        reason                   : str (only when status == "unavailable")
        candidate_summary        : str | None
        key_strengths            : list[str]
        skill_gaps               : list[str]
        experience_relevance     : str | None
        potential_concerns       : list[str]
        interview_focus_areas    : list[str]
        match_quality_explanation: str | None

    NEVER raises — returns _UNAVAILABLE sentinel on any failure.
    """
    try:
        client = _get_client()
    except ValueError as e:
        return {**_UNAVAILABLE, "reason": str(e)}
    except ImportError:
        return {**_UNAVAILABLE, "reason": "google-genai SDK not installed"}

    try:
        from google.genai import types

        prompt = _build_prompt(candidate, job_profile, score_result)
        
        fallback_models = os.environ.get("GEMINI_FALLBACK_MODELS", _DEFAULT_MODEL)
        models_to_try = [m.strip() for m in fallback_models.split(",") if m.strip()]
        if not models_to_try:
            models_to_try = [_DEFAULT_MODEL]

        import time

        max_attempts_per_model = 3
        delay = 2.0
        
        last_exc = None
        response = None
        
        for model_name in models_to_try:
            success = False
            for attempt in range(max_attempts_per_model):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=_INSIGHT_SCHEMA,
                        ),
                    )
                    success = True
                    break  # success
                except Exception as exc:
                    last_exc = exc
                    err_code = getattr(exc, "code", None)
                    exc_str = str(exc)
                    is_rate_limit = (
                        err_code == 429
                        or "429" in exc_str
                        or "quota" in exc_str.lower()
                        or "resource_exhausted" in exc_str.lower()
                    )
                    is_server_error = (
                        err_code in [500, 502, 503, 504]
                        or "503" in exc_str
                        or "500" in exc_str
                        or "service unavailable" in exc_str.lower()
                    )
                    
                    if is_rate_limit and attempt < max_attempts_per_model - 1:
                        time.sleep(delay)
                        delay *= 2
                        continue
                    
                    # For server errors or if we exhaust rate limit retries, break out of attempt loop to try next model
                    if is_server_error or is_rate_limit:
                        break
                    
                    # Non-retriable auth error, etc.
                    raise
            
            if success:
                break
        else:
            # If we fall through the models loop without success
            raise last_exc or Exception("All fallback models failed.")

        raw_text = response.text or ""
        if not raw_text.strip():
            return {**_UNAVAILABLE, "reason": "Gemini returned empty response"}

        data = json.loads(raw_text)
        data["status"] = "ok"

        # Ensure all expected keys are present with safe defaults
        for key in ("candidate_summary", "experience_relevance", "match_quality_explanation"):
            data.setdefault(key, None)
        for key in ("key_strengths", "skill_gaps", "potential_concerns", "interview_focus_areas"):
            data.setdefault(key, [])

        return data

    except json.JSONDecodeError:
        return {**_UNAVAILABLE, "reason": "Gemini returned unparseable JSON"}
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return {**_UNAVAILABLE, "reason": f"AI insights are currently unavailable due to a service error: {str(exc)}"}


def answer_followup_question(
    candidate: dict,
    job_profile: dict,
    score_result: dict,
    conversation: list[dict],
    question: str,
) -> dict[str, Any]:
    """
    Answer a recruiter's follow-up question about the candidate.
    """
    try:
        client = _get_client()
    except ValueError as e:
        return {"status": "unavailable", "answer": str(e)}
    except ImportError:
        return {"status": "unavailable", "answer": "google-genai SDK not installed"}

    try:
        from google.genai import types

        contents = _build_followup_prompt(candidate, job_profile, score_result, conversation, question)
        
        fallback_models = os.environ.get("GEMINI_FALLBACK_MODELS", _DEFAULT_MODEL)
        models_to_try = [m.strip() for m in fallback_models.split(",") if m.strip()]
        if not models_to_try:
            models_to_try = [_DEFAULT_MODEL]

        import time

        max_attempts_per_model = 3
        delay = 2.0
        
        last_exc = None
        response = None
        
        for model_name in models_to_try:
            success = False
            for attempt in range(max_attempts_per_model):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            response_mime_type="text/plain",
                        ),
                    )
                    success = True
                    break
                except Exception as exc:
                    last_exc = exc
                    err_code = getattr(exc, "code", None)
                    exc_str = str(exc)
                    is_rate_limit = (
                        err_code == 429
                        or "429" in exc_str
                        or "quota" in exc_str.lower()
                        or "resource_exhausted" in exc_str.lower()
                    )
                    is_server_error = (
                        err_code in [500, 502, 503, 504]
                        or "503" in exc_str
                        or "500" in exc_str
                        or "service unavailable" in exc_str.lower()
                    )
                    
                    if is_rate_limit and attempt < max_attempts_per_model - 1:
                        time.sleep(delay)
                        delay *= 2
                        continue
                        
                    if is_server_error or is_rate_limit:
                        break
                        
                    raise
                    
            if success:
                break
        else:
            raise last_exc or Exception("All fallback models failed.")

        raw_text = response.text or ""
        if not raw_text.strip():
            return {"status": "unavailable", "answer": "Gemini returned empty response"}

        return {"status": "ok", "answer": raw_text.strip()}

    except Exception as exc:
        return {"status": "unavailable", "answer": "AI insights are currently unavailable due to a service error."}
