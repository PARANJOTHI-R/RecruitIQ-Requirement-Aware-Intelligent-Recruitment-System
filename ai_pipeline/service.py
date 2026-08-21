import os
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, request, jsonify

# Import existing AI pipeline modules
from ai_pipeline.main import process_resume
from ai_pipeline.engine.scoring_engine import score_candidate
from ai_pipeline.engine.gemini_insights import generate_recruiter_insights, answer_followup_question
from ai_pipeline.engine.job_requirement_analyzer import analyze_job_description

app = Flask(__name__)

# Eagerly initialize the semantic model once per process on startup
try:
    from ai_pipeline.engine.semantic_matcher import init_model
    init_model()
except Exception as e:
    print(f"Warning: Failed to initialize semantic model eagerly: {e}")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ai-pipeline"})


@app.route("/analyze-jd", methods=["POST"])
def analyze_jd():
    data = request.get_json() or {}
    jd_text = data.get("job_description")
    if not jd_text:
        return jsonify({"error": "job_description is required"}), 400
    try:
        job_profile = analyze_job_description(jd_text)
        return jsonify(job_profile)
    except Exception as e:
        return jsonify({"error": f"Failed to analyze JD: {str(e)}"}), 500


@app.route("/parse", methods=["POST"])
def parse():
    """
    Parses a resume PDF.
    Expects: {"pdf_path": "/absolute/path/to/resume.pdf"}
    Returns: JSON output of process_resume()
    """
    data = request.get_json() or {}
    pdf_path = data.get("pdf_path")

    if not pdf_path or not os.path.exists(pdf_path):
        return jsonify({"error": "Invalid or missing pdf_path"}), 400

    try:
        parsed_data = process_resume(pdf_path)
        return jsonify(parsed_data)
    except Exception as e:
        return jsonify({"error": f"Failed to parse resume: {str(e)}"}), 500


@app.route("/screen", methods=["POST"])
def screen():
    """
    Scores a candidate against a job profile.
    Expects: {
        "job_profile": {...},
        "candidate_profile": {...},
        "resume_lines": [...]
    }
    """
    data = request.get_json() or {}
    job_profile = data.get("job_profile")
    candidate_profile = data.get("candidate_profile")
    resume_lines = data.get("resume_lines", [])

    if not job_profile or not candidate_profile:
        return jsonify({"error": "job_profile and candidate_profile are required"}), 400

    try:
        score_result = score_candidate(job_profile, candidate_profile, resume_lines=resume_lines)
        return jsonify(score_result)
    except Exception as e:
        return jsonify({"error": f"Scoring failed: {str(e)}"}), 500


@app.route("/insights", methods=["POST"])
def insights():
    """
    Generates AI insights for a candidate.
    Expects: {
        "candidate_profile": {...},
        "job_profile": {...},
        "score_result": {...}
    }
    """
    data = request.get_json() or {}
    
    try:
        result = generate_recruiter_insights(
            data.get("candidate_profile", {}),
            data.get("job_profile", {}),
            data.get("score_result", {})
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "reason": str(e)}), 500


@app.route("/chat", methods=["POST"])
def chat():
    """
    Handles follow-up chat questions.
    Expects: {
        "candidate_profile": {...},
        "job_profile": {...},
        "score_result": {...},
        "conversation": [...],
        "question": "..."
    }
    """
    data = request.get_json() or {}
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"status": "error", "reason": "No question provided"}), 400

    try:
        result = answer_followup_question(
            data.get("candidate_profile", {}),
            data.get("job_profile", {}),
            data.get("score_result", {}),
            data.get("conversation", []),
            question
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "reason": str(e)}), 500


if __name__ == "__main__":
    print("==================================================")
    print(" Starting AI Pipeline Service on port 5001")
    print("==================================================")
    # The Express backend expects this service on 5001
    app.run(debug=False, use_reloader=False, host="127.0.0.1", port=5001)
