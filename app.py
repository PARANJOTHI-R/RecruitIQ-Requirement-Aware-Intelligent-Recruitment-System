import os
import tempfile
import uuid
from flask import Flask, render_template, request, flash, redirect, url_for
from werkzeug.utils import secure_filename

# Import existing engine and parser modules
from engine.job_requirement_analyzer import analyze_job_description
from engine.scoring_engine import score_candidate
from main import process_resume

app = Flask(__name__)
app.secret_key = "recruitiq-secret-key-for-poc"

DEFAULT_SAMPLE_JD = """Java Backend Developer
Required: Java, Spring Boot, REST APIs, SQL, 2+ years experience
Preferred: Docker, AWS, Kafka
Education: Computer Science or related field"""


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        jd_text = request.form.get("job_description", "").strip()
        uploaded_files = request.files.getlist("resumes")

        if not jd_text:
            flash("Please enter or paste a job description.", "warning")
            return render_template("index.html", default_jd=DEFAULT_SAMPLE_JD)

        # Filter valid uploaded files
        valid_files = [f for f in uploaded_files if f and f.filename and f.filename.strip()]
        if not valid_files:
            flash("Please upload at least one resume PDF.", "warning")
            return render_template("index.html", jd_text=jd_text, default_jd=DEFAULT_SAMPLE_JD)

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

                candidates.append({
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

        return render_template(
            "index.html",
            jd_text=jd_text,
            default_jd=DEFAULT_SAMPLE_JD,
            job_profile=job_profile,
            candidates=candidates,
            errors=errors,
            has_results=True,
            total_processed=len(valid_files),
            successful_count=len(candidates),
        )

    return render_template("index.html", default_jd=DEFAULT_SAMPLE_JD)


if __name__ == "__main__":
    print("==================================================")
    print(" Starting RecruitIQ Web Application on port 5000")
    print(" Open in browser: http://127.0.0.1:5000")
    print("==================================================")
    app.run(debug=True, host="127.0.0.1", port=5000)
