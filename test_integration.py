"""
Test suite for the complete Gemini integration + failure modes.
Runs:
  1. Real insights call (Paranjothi R payload)
  2. Missing key test
  3. Invalid key test
  4. Parser regression check (Dhanushree golden assertions)
  5. vivyn.pdf layout parse (previously failing)
"""
from dotenv import load_dotenv
load_dotenv()

import json, os, sys

# ─────────────────────────────────────────────────────
# TEST 1: Real insights call
# ─────────────────────────────────────────────────────
print("\n" + "="*60)
print("TEST 1: Real insights call (Paranjothi R)")
print("="*60)

from engine.gemini_insights import generate_recruiter_insights

candidate = {
    "name": "Paranjothi R",
    "skills": ["Java", "SQL", "Git", "MongoDB", "React", "Node.js", "Express.js", "Figma"],
    "experience_years": None,
    "internship_years": 0.5,
}
job_profile = {
    "required_skills": ["Java", "Spring Boot", "REST APIs", "SQL", "Git"],
    "preferred_skills": ["Docker", "AWS", "Microservices"],
    "minimum_experience_years": 2,
}
score_result = {
    "overall_score": 57.1,
    "required_skill_fit": 80.0,
    "preferred_skill_fit": 0.0,
    "experience_fit": None,
    "required_results": [
        {"skill": "Java",        "status": "MATCH",   "match_type": "exact",      "evidence": "Bank Management System | Java", "similarity": None},
        {"skill": "Spring Boot", "status": "MISSING",  "match_type": None,         "evidence": None,                           "similarity": None},
        {"skill": "REST APIs",   "status": "MATCH",   "match_type": "normalized", "evidence": "Designed RESTful APIs using Express.js", "similarity": None},
        {"skill": "SQL",         "status": "MATCH",   "match_type": "semantic",   "evidence": "Databases: MongoDB, MySQL",     "similarity": 0.69},
        {"skill": "Git",         "status": "MATCH",   "match_type": "exact",      "evidence": "Developer Tools: Git, GitHub",  "similarity": None},
    ],
    "preferred_results": [
        {"skill": "Docker",        "status": "MISSING", "match_type": None, "evidence": None, "similarity": None},
        {"skill": "AWS",           "status": "MISSING", "match_type": None, "evidence": None, "similarity": None},
        {"skill": "Microservices", "status": "MISSING", "match_type": None, "evidence": None, "similarity": None},
    ],
}

result = generate_recruiter_insights(candidate, job_profile, score_result)
print(f"Status: {result['status']}")
if result["status"] == "ok":
    for key in ["candidate_summary","key_strengths","skill_gaps","experience_relevance",
                "potential_concerns","interview_focus_areas","match_quality_explanation"]:
        val = result.get(key)
        if isinstance(val, list):
            print(f"\n  {key}:")
            for item in val:
                print(f"    - {item}")
        else:
            print(f"\n  {key}:\n    {val}")
    print("\n[PASS] All 7 insight fields returned")
else:
    print(f"[FAIL] {result['reason']}")

# ─────────────────────────────────────────────────────
# TEST 2: Missing GEMINI_API_KEY
# ─────────────────────────────────────────────────────
print("\n" + "="*60)
print("TEST 2: Missing GEMINI_API_KEY")
print("="*60)

real_key = os.environ.pop("GEMINI_API_KEY", None)
result2 = generate_recruiter_insights(candidate, job_profile, score_result)
os.environ["GEMINI_API_KEY"] = real_key or ""

print(f"Status: {result2['status']}")
print(f"Reason: {result2['reason']}")
assert result2["status"] == "unavailable", "Expected unavailable"
assert "GEMINI_API_KEY" in result2["reason"], f"Expected key name in reason, got: {result2['reason']}"
assert real_key not in result2["reason"], "API key VALUE must not appear in reason"
print("[PASS] Graceful unavailable, key not exposed")

# ─────────────────────────────────────────────────────
# TEST 3: Invalid GEMINI_API_KEY
# ─────────────────────────────────────────────────────
print("\n" + "="*60)
print("TEST 3: Invalid GEMINI_API_KEY")
print("="*60)

os.environ["GEMINI_API_KEY"] = "INVALID_KEY_FOR_TESTING"
result3 = generate_recruiter_insights(candidate, job_profile, score_result)
os.environ["GEMINI_API_KEY"] = real_key or ""

print(f"Status: {result3['status']}")
print(f"Reason: {result3['reason']}")
assert result3["status"] == "unavailable", "Expected unavailable"
assert "INVALID_KEY_FOR_TESTING" not in result3["reason"], "Invalid key must not appear in reason"
print("[PASS] Graceful unavailable, bad key not exposed")

# ─────────────────────────────────────────────────────
# TEST 4: Parser regression — vivyn.pdf (previously crashing)
# ─────────────────────────────────────────────────────
print("\n" + "="*60)
print("TEST 4: vivyn.pdf layout parse (previously crashing)")
print("="*60)

from parser.layout_parser import extract_layout
try:
    doc = extract_layout("files/vivyn.pdf")
    print(f"Name: {doc.personal.get('name')} (conf={doc.personal.get('name_confidence')})")
    print(f"Sections: {list(doc.sections.keys())}")
    print("[PASS] vivyn.pdf parses without crash")
except Exception as e:
    print(f"[FAIL] {type(e).__name__}: {e}")

# ─────────────────────────────────────────────────────
# TEST 5: Dhanushree golden assertions (parser regression)
# ─────────────────────────────────────────────────────
print("\n" + "="*60)
print("TEST 5: Dhanushree golden assertions (parser regression)")
print("="*60)

doc2 = extract_layout("files/Resume-24cdr080.pdf")  # Paranjothi R
p = doc2.personal
s = doc2.sections

assertions = [
    (p.get("name") == "Paranjothi R",                   "name == Paranjothi R"),
    ("paranjothi8607@gmail.com" in (p.get("email") or ""), "email correct"),
    (p.get("name_confidence", 0) > 0.7,                  "name confidence > 0.7"),
    (len(s.get("projects", [])) >= 10,                   "projects >= 10 lines"),
    (len(s.get("skills", [])) >= 5,                      "skills >= 5 lines"),
    (len(s.get("certifications", [])) >= 5,              "certifications >= 5 lines"),
]

passed = 0
for ok, label in assertions:
    status = "[PASS]" if ok else "[FAIL]"
    print(f"  {status} {label}")
    if ok:
        passed += 1

print(f"\nGolden assertions: {passed}/{len(assertions)}")
if passed == len(assertions):
    print("[PASS] All assertions passed — parser regression clean")
else:
    print("[FAIL] Some assertions failed")

print("\n" + "="*60)
print("ALL TESTS COMPLETE")
print("="*60)
