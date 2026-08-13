"""Quick test to check which Gemini call modes work."""
from dotenv import load_dotenv; load_dotenv()
from google import genai
from google.genai import types
import os, json

c = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Test 1: JSON response_mime_type
print("=== Test 1: JSON mime type ===")
try:
    r = c.models.generate_content(
        model="gemini-flash-latest",
        contents='Return this JSON exactly: {"greeting": "hello", "status": "ok"}',
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    print("OK:", r.text.strip()[:200])
    print("finish_reason:", r.candidates[0].finish_reason if r.candidates else "N/A")
except Exception as e:
    print(f"FAIL {type(e).__name__}: {str(e)[:300]}")

# Test 2: Plain text asking for JSON
print("\n=== Test 2: Plain text JSON request ===")
try:
    r2 = c.models.generate_content(
        model="gemini-flash-latest",
        contents="Give me a brief recruiter note for a Java developer with 3 years experience who matches 80% of job requirements. Plain text, 1-2 sentences.",
    )
    print("OK:", r2.text.strip()[:200] if r2.text else "(empty text)")
    print("finish_reason:", r2.candidates[0].finish_reason if r2.candidates else "N/A")
    if r2.candidates:
        print("safety_ratings:", r2.candidates[0].safety_ratings)
except Exception as e:
    print(f"FAIL {type(e).__name__}: {str(e)[:300]}")

# Test 3: Structured JSON with schema
print("\n=== Test 3: JSON schema response ===")
try:
    schema = {
        "type": "object",
        "properties": {
            "candidate_summary": {"type": "string"},
            "key_strengths": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["candidate_summary", "key_strengths"],
    }
    r3 = c.models.generate_content(
        model="gemini-flash-latest",
        contents="Candidate: Java developer, 3 years exp, matched Java and SQL. Missing Spring Boot. Score: 80%. Give recruiter insights.",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
        )
    )
    print("OK:", r3.text.strip()[:300] if r3.text else "(empty)")
    print("finish_reason:", r3.candidates[0].finish_reason if r3.candidates else "N/A")
except Exception as e:
    print(f"FAIL {type(e).__name__}: {str(e)[:300]}")
