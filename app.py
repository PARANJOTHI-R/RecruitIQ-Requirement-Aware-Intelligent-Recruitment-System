import os
import tempfile
import uuid
from flask import Flask, render_template, request, flash, redirect, url_for, jsonify
from werkzeug.utils import secure_filename

# Import existing engine and parser modules
from engine.job_requirement_analyzer import analyze_job_description
from engine.scoring_engine import score_candidate
from engine.gemini_insights import generate_recruiter_insights, answer_followup_question
from main import process_resume

app = Flask(__name__)
app.secret_key = "recruitiq-secret-key-for-poc"

DEFAULT_SAMPLE_JD = """Java Backend Developer
Required: Java, Spring Boot, REST APIs, SQL, 2+ years experience
Preferred: Docker, AWS, Kafka
Education: Computer Science or related field"""

# Global in-memory cache for the POC to support on-demand insights
# without re-parsing the PDF.
# Structure: { candidate_id: { "candidate_profile": dict, "job_profile": dict, "score_result": dict, "cached_insight": dict|None } }
CANDIDATE_STORE = {}


@app.route("/api/screen", methods=["POST"])
def screen_resumes():
    jd_text = request.form.get("job_description", "").strip()
    uploaded_files = request.files.getlist("resumes")

    if not jd_text:
        return jsonify({"error": "Please enter or paste a job description."}), 400

    # Filter valid uploaded files
    valid_files = [f for f in uploaded_files if f and f.filename and f.filename.strip()]
    if not valid_files:
        return jsonify({"error": "Please upload at least one resume PDF."}), 400

    # 1. Analyze Job Description once
    job_profile = analyze_job_description(jd_text)

    candidates = []
    errors = []

    # 2. Process each resume PDF in isolation
    temp_dir = tempfile.mkdtemp(prefix="recruitiq_")
    for file_storage in valid_files:
        orig_filename = file_storage.filename
        if not orig_filename.lower().endswith(".pdf"):
            errors.append({
                "filename": orig_filename,
                "error": "Unsupported file format. Please upload PDF files only.",
            })
            continue

        unique_filename = f"{uuid.uuid4().hex}_{secure_filename(orig_filename)}"
        temp_path = os.path.join(temp_dir, unique_filename)

        try:
            file_storage.save(temp_path)

            # Parse candidate profile using existing parser pipeline
            parsed_data = process_resume(temp_path)
            candidate_profile = parsed_data.get("candidate_profile", {})
            contact = parsed_data.get("contact", {})

            # Score candidate against job requirement profile
            score_result = score_candidate(job_profile, candidate_profile)

            # Generate a unique ID for on-demand insight retrieval
            candidate_id = uuid.uuid4().hex

            # Store in global cache
            CANDIDATE_STORE[candidate_id] = {
                "candidate_profile": candidate_profile,
                "job_profile": job_profile,
                "score_result": score_result,
                "cached_insight": None,
                "conversation": [],
            }

            candidates.append({
                "id": candidate_id,
                "filename": orig_filename,
                "name": candidate_profile.get("name") or contact.get("name") or "Unknown Candidate",
                "contact": contact,
                "profile": candidate_profile,
                "score": score_result,
            })
        except Exception as e:
            errors.append({
                "filename": orig_filename,
                "error": f"Failed to parse resume: {str(e)}",
            })
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

    # Cleanup temp directory
    try:
        os.rmdir(temp_dir)
    except Exception:
        pass

    # 3. Rank candidates by overall_score descending
    candidates.sort(key=lambda c: c["score"]["overall_score"], reverse=True)

    for rank_idx, cand in enumerate(candidates, start=1):
        cand["rank"] = rank_idx

    return jsonify({
        "job_profile": job_profile,
        "candidates": candidates,
        "errors": errors,
        "total_processed": len(valid_files),
        "successful_count": len(candidates),
    })


@app.route("/candidates/<candidate_id>/insights", methods=["POST"])
def get_insights(candidate_id):
    """
    On-demand AI Insights endpoint.
    Retrieves the candidate from cache and generates insights if not already cached.
    """
    if candidate_id not in CANDIDATE_STORE:
        return jsonify({"status": "unavailable", "message": "Candidate data not found or expired."}), 404

    data = CANDIDATE_STORE[candidate_id]

    # Return cached insight if available
    if data.get("cached_insight"):
        return jsonify(data["cached_insight"])

    insights = generate_recruiter_insights(
        data["candidate_profile"],
        data["job_profile"],
        data["score_result"]
    )

    if insights.get("status") == "ok":
        data["cached_insight"] = insights
        insights["candidate_id"] = candidate_id
        return jsonify(insights)
    else:
        return jsonify({"status": "unavailable", "message": insights.get("reason", "AI insights are currently unavailable.")}), 503


@app.route("/candidates/<candidate_id>/insights/chat", methods=["POST"])
def followup_chat(candidate_id):
    """
    On-demand AI Follow-up Q&A endpoint.
    Maintains conversation context strictly scoped to the candidate and job.
    """
    if candidate_id not in CANDIDATE_STORE:
        return jsonify({"status": "unavailable", "message": "Candidate data not found or expired."}), 404

    req_data = request.get_json() or {}
    question = req_data.get("question", "").strip()

    if not question:
        return jsonify({"status": "unavailable", "message": "No question provided."}), 400

    data = CANDIDATE_STORE[candidate_id]
    conversation = data.get("conversation", [])

    response = answer_followup_question(
        data["candidate_profile"],
        data["job_profile"],
        data["score_result"],
        conversation,
        question
    )

    if response.get("status") == "ok":
        # Update conversation context
        conversation.append({"role": "user", "content": question})
        conversation.append({"role": "model", "content": response["answer"]})
        data["conversation"] = conversation

    return jsonify(response)


if __name__ == "__main__":
    print("==================================================")
    print(" Starting RecruitIQ Web Application on port 5000")
    print(" Open in browser: http://127.0.0.1:5000")
    print("==================================================")
    app.run(debug=True, host="127.0.0.1", port=5000)
