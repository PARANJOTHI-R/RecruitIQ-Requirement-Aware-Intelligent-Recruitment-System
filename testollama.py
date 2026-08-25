"""
Quick smoke test — confirms Ollama structured JSON output works end-to-end
before wiring it into service.py. Run directly:

    python test_ollama_setup.py
"""
import json
import time
from ollama import Client

HOST = "http://127.0.0.1:11434"
MODELS_TO_TEST = ["qwen3:4b", "llama3.2:3b", "llama3.1:8b"]

SCHEMA = {
    "type": "object",
    "properties": {
        "candidate_summary": {"type": "string"},
        "key_strengths": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["candidate_summary", "key_strengths"],
}

PROMPT = """\
Respond ONLY with a JSON object matching the schema. No prose, no markdown fences.
Candidate: Jane Doe, skills: Python, React, Node.js. 2 years experience.
Give a one-sentence summary and 2 key strengths."""

client = Client(host=HOST)

for model in MODELS_TO_TEST:
    print(f"\n--- Testing {model} ---")
    start = time.time()
    try:
        response = client.chat(
            model=model,
            messages=[{"role": "user", "content": PROMPT}],
            format=SCHEMA,
            options={"temperature": 0.2},
        )
        elapsed = time.time() - start
        raw = response["message"]["content"]
        data = json.loads(raw)
        print(f"OK in {elapsed:.1f}s -> {data}")
    except Exception as e:
        print(f"FAILED: {e}")