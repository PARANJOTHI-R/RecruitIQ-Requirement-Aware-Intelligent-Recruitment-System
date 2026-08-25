"""
engine/ollama_insights.py
=========================
Ollama-powered recruiter insights — local-LLM replacement for the Gemini
layer, same position in the pipeline:

    ... → Scoring → Ranking → [THIS MODULE] Local LLM Recruiter Insights

Drop-in requirement: `generate_recruiter_insights(...)` and
`answer_followup_question(...)` have the SAME signatures and SAME return
shapes as engine/gemini_insights.py, so service.py can switch providers
by changing one import (see the bottom of this file / notes below).

Responsibilities:
  - Load OLLAMA_HOST and OLLAMA_MODEL from environment.
  - Accept ALREADY PROCESSED ATS data (candidate dict, job_profile dict,
    score_result dict) — never raw PDF text or unscored candidates.
  - Generate the same seven structured recruiter-facing insights using
    Ollama's structured-output mode (`format=<json schema>`).
  - Return a structured dict; never raise to the caller.

Requires: `pip install ollama` and a running local daemon (`ollama serve`,
usually already running as a background service after install), plus at
least one pulled model, e.g.:

    ollama pull llama3.1
    # or: ollama pull qwen2.5:7b-instruct / mistral / etc.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

# ── Constants ──────────────────────────────────────────────────────────────────

_DEFAULT_MODEL = "llama3.1"
_DEFAULT_HOST = "http://localhost:11434"

# Standard JSON Schema (lowercase types) — Ollama's structured outputs
# use plain JSON Schema via the `format` parameter, unlike Gemini's
# uppercase OBJECT/STRING/ARRAY convention.
_INSIGHT_SCHEMA = {
    "type": "object",
    "properties": {
        "candidate_summary": {
            "type": "string",
            "description": "2-3 sentence overview of the candidate for a recruiter",
        },
        "key_strengths": {
            "type": "array",
            "items": {"type": "string"},
            "description": "2-4 specific strengths based on matched skills/experience",
        },
        "skill_gaps": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Missing required or preferred skills from the job",
        },
        "experience_relevance": {
            "type": "string",
            "description": "1-2 sentences on how experience aligns (or doesn't) with the role",
        },
        "potential_concerns": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Notable gaps or risks for the recruiter to be aware of",
        },
        "interview_focus_areas": {
            "type": "array",
            "items": {"type": "string"},
            "description": "2-4 specific topics to probe in an interview",
        },
        "match_quality_explanation": {
            "type": "string",
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

_UNAVAILABLE: dict[str, Any] = {
    "status": "unavailable",
    "reason": "Local LLM insights unavailable",
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
    Return a configured ollama.Client pointed at OLLAMA_HOST.
    Raises ImportError if the `ollama` package isn't installed.
    """
    from ollama import Client  # pip install ollama

    host = os.environ.get("OLLAMA_HOST", "").strip() or _DEFAULT_HOST
    return Client(host=host)


def _get_model_names() -> list[str]:
    """Model + optional comma-separated fallbacks, e.g. OLLAMA_FALLBACK_MODELS=mistral,qwen2.5"""
    primary = os.environ.get("OLLAMA_MODEL", "").strip() or _DEFAULT_MODEL
    fallbacks = os.environ.get("OLLAMA_FALLBACK_MODELS", "").strip()
    models = [primary] + [m.strip() for m in fallbacks.split(",") if m.strip()]
    # de-dupe while preserving order
    seen = set()
    out = []
    for m in models:
        if m not in seen:
            seen.add(m)
            out.append(m)
    return out


def _build_prompt(candidate: dict, job_profile: dict, score_result: dict) -> str:
    """Identical content/shape to the Gemini prompt — same inputs, same instructions."""
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
Respond ONLY with a single JSON object matching the required schema. No prose, no markdown fences.

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


def _build_followup_messages(
    candidate: dict,
    job_profile: dict,
    score_result: dict,
    conversation: list[dict],
    question: str,
) -> list[dict]:
    """
    Build an OpenAI-style messages list (what Ollama's chat API expects):
    [{"role": "system"/"user"/"assistant", "content": "..."}, ...]
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

    messages: list[dict] = [{"role": "system", "content": system_instruction}]

    # Ollama/OpenAI-style roles are "user"/"assistant" (Gemini used "model" — normalize it)
    for msg in conversation[-4:]:
        role = msg.get("role", "user")
        role = "assistant" if role in ("model", "assistant") else "user"
        messages.append({"role": role, "content": msg.get("content", "")})

    messages.append({"role": "user", "content": question})
    return messages


def _is_retriable(exc: Exception) -> bool:
    """Local daemon errors worth a short retry: connection refused, timeouts, transient 5xx."""
    exc_str = str(exc).lower()
    return any(
        s in exc_str
        for s in ("connection refused", "timed out", "timeout", "503", "502", "500", "temporarily")
    )


# ── Public API (same signatures as gemini_insights.py) ─────────────────────────

def generate_recruiter_insights(
    candidate: dict,
    job_profile: dict,
    score_result: dict,
) -> dict[str, Any]:
    """
    Generate structured recruiter-facing insights using a local Ollama model.
    Uses Ollama's `format=<json schema>` structured-output mode.
    NEVER raises — returns _UNAVAILABLE sentinel on any failure.
    """
    try:
        client = _get_client()
    except ImportError:
        return {**_UNAVAILABLE, "reason": "ollama package not installed (pip install ollama)"}

    prompt = _build_prompt(candidate, job_profile, score_result)
    models_to_try = _get_model_names()

    max_attempts_per_model = 3
    delay = 1.5
    last_exc: Exception | None = None
    response = None

    for model_name in models_to_try:
        success = False
        for attempt in range(max_attempts_per_model):
            try:
                response = client.chat(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    format=_INSIGHT_SCHEMA,
                    options={"temperature": 0.2},
                    think=False,  # skip reasoning tokens (Qwen3 etc.) — big latency win, no quality loss for this task
                )
                success = True
                break
            except Exception as exc:
                last_exc = exc
                if _is_retriable(exc) and attempt < max_attempts_per_model - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                break  # try next model
        if success:
            break
    else:
        return {**_UNAVAILABLE, "reason": f"All local models failed: {last_exc}"}

    if response is None:
        return {**_UNAVAILABLE, "reason": f"All local models failed: {last_exc}"}

    try:
        raw_text = response["message"]["content"] if isinstance(response, dict) else response.message.content
        raw_text = (raw_text or "").strip()
        if not raw_text:
            return {**_UNAVAILABLE, "reason": "Ollama returned empty response"}

        data = json.loads(raw_text)
        data["status"] = "ok"

        for key in ("candidate_summary", "experience_relevance", "match_quality_explanation"):
            data.setdefault(key, None)
        for key in ("key_strengths", "skill_gaps", "potential_concerns", "interview_focus_areas"):
            data.setdefault(key, [])

        return data

    except json.JSONDecodeError:
        return {**_UNAVAILABLE, "reason": "Ollama returned unparseable JSON"}
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return {**_UNAVAILABLE, "reason": f"AI insights are currently unavailable due to a service error: {exc}"}


def answer_followup_question(
    candidate: dict,
    job_profile: dict,
    score_result: dict,
    conversation: list[dict],
    question: str,
) -> dict[str, Any]:
    """Answer a recruiter's follow-up question using a local Ollama model. NEVER raises."""
    try:
        client = _get_client()
    except ImportError:
        return {"status": "unavailable", "answer": "ollama package not installed (pip install ollama)"}

    messages = _build_followup_messages(candidate, job_profile, score_result, conversation, question)
    models_to_try = _get_model_names()

    max_attempts_per_model = 3
    delay = 1.5
    last_exc: Exception | None = None
    response = None

    for model_name in models_to_try:
        success = False
        for attempt in range(max_attempts_per_model):
            try:
                response = client.chat(
                    model=model_name,
                    messages=messages,
                    options={"temperature": 0.3},
                    think=False,
                )
                success = True
                break
            except Exception as exc:
                last_exc = exc
                if _is_retriable(exc) and attempt < max_attempts_per_model - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                break
        if success:
            break
    else:
        return {"status": "unavailable", "answer": f"AI insights are currently unavailable due to a service error: {last_exc}"}

    if response is None:
        return {"status": "unavailable", "answer": "AI insights are currently unavailable due to a service error."}

    try:
        raw_text = response["message"]["content"] if isinstance(response, dict) else response.message.content
        raw_text = (raw_text or "").strip()
        if not raw_text:
            return {"status": "unavailable", "answer": "Ollama returned empty response"}
        return {"status": "ok", "answer": raw_text}
    except Exception:
        return {"status": "unavailable", "answer": "AI insights are currently unavailable due to a service error."}