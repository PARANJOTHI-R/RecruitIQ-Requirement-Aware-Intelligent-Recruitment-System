# api/main.py
"""
RecruitIQ FastAPI Application.
Exposes REST endpoints for JD analysis, multi-resume ATS screening, leaderboard ranking, and on-demand Gemini AI insights.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv(override=False)
except ImportError:
    pass

from api.models import (
    ScreeningResponseModel,
    JobProfileModel,
    InsightChatRequest,
    AnalyzeJdRequest,
)
from api.document_reader import extract_text_from_file
from api.screening_service import (
    analyze_jd,
    screen_candidates,
    get_candidate_insights,
    answer_candidate_question,
)

FILES_DIR = Path("files")
DEFAULT_JD_PATH = Path("job_description.txt")

app = FastAPI(
    title="RecruitIQ API",
    description="Intelligent ATS Resume Screening & Ranking Engine with Requirement-Aware Matching and AI Insights",
    version="2.0.0",
)

# Enable CORS for React frontend (localhost:5173, localhost:3000, and any local origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "RecruitIQ ATS Engine",
        "version": "2.0.0",
        "demo_resumes_available": len(list(FILES_DIR.glob("*.pdf"))) if FILES_DIR.exists() else 0,
    }


@app.get("/api/sample-jds")
def get_sample_jds():
    """Return pre-configured sample Job Descriptions for instant testing."""
    default_jd_text = ""
    if DEFAULT_JD_PATH.exists():
        try:
            default_jd_text = DEFAULT_JD_PATH.read_text(encoding="utf-8")
        except Exception:
            pass

    return {
        "samples": [
            {
                "id": "backend-python",
                "title": "Backend Software Engineer (Python/FastAPI)",
                "content": default_jd_text or """Backend Software Engineer

We are looking for a Backend Software Engineer with at least 1 year of experience building scalable backend services and web applications.

Required Skills:
Python
FastAPI
REST APIs
PostgreSQL
Git

Preferred Skills:
Docker
AWS
Redis
MongoDB
Microservices
CI/CD
Linux

The candidate should have experience developing backend applications, designing and consuming REST APIs, working with relational databases, and using Git for version control. Experience with cloud deployment, caching, containerization, and microservices architecture is preferred."""
            },
            {
                "id": "fullstack-react-python",
                "title": "Full Stack Developer (React / Python)",
                "content": """Full Stack Developer

We are seeking a versatile Full Stack Developer to build modern interactive applications. Minimum 2+ years experience.

Required Skills:
Python
React.js
JavaScript
REST APIs
HTML
CSS
Git

Preferred Skills:
FastAPI
Node.js
PostgreSQL
MongoDB
Docker
AWS
Figma

The candidate will work on front-end components using React and scalable backend services with Python."""
            },
            {
                "id": "java-backend",
                "title": "Senior Java Backend Engineer",
                "content": """Senior Java Backend Engineer

Looking for an enterprise Java engineer with 3+ years experience designing resilient microservices and distributed databases.

Required Skills:
Java
Spring Boot
REST APIs
SQL
Git

Preferred Skills:
Microservices
Docker
Kafka
AWS
MongoDB
Oracle SQL
Maven

Key duties include building high-throughput APIs, database optimization, and cloud architecture."""
            },
            {
                "id": "ai-data-engineer",
                "title": "AI / Data Science Engineer",
                "content": """AI / Data Science Engineer

Looking for a specialist with at least 1 year experience in machine learning, NLP, and data pipelines.

Required Skills:
Python
SQL
Git
Computer Vision

Preferred Skills:
PyTorch
TensorFlow
FastAPI
Docker
PostgreSQL
Linux

Develop and deploy machine learning models and intelligent data processing systems."""
            }
        ]
    }


@app.get("/api/sample-files")
def get_sample_files():
    """List all available demo resume files from the files/ directory."""
    if not FILES_DIR.exists():
        return {"files": []}
    files = []
    for f in sorted(FILES_DIR.glob("*.pdf")):
        files.append({
            "filename": f.name,
            "size": f.stat().st_size,
            "path": str(f),
        })
    return {"files": files}


@app.post("/api/analyze-jd")
async def analyze_job_description_endpoint(
    jd_text: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None),
):
    """Analyze a Job Description submitted either as raw text or uploaded document (PDF/DOCX/TXT)."""
    raw_text = ""
    if jd_file and jd_file.filename:
        temp_dir = tempfile.mkdtemp(prefix="recruitiq_jd_")
        temp_path = Path(temp_dir) / jd_file.filename
        try:
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(jd_file.file, buffer)
            raw_text = extract_text_from_file(temp_path)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    elif jd_text:
        raw_text = jd_text.strip()

    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a job description either via text or file upload.",
        )

    try:
        profile = analyze_jd(raw_text)
        return profile
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to analyze job description: {str(e)}",
        )


@app.post("/api/screen-samples")
async def screen_sample_resumes(
    jd_text: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None),
):
    """Screen all demo resumes from files/ against the provided Job Description."""
    raw_text = ""
    if jd_file and jd_file.filename:
        temp_dir = tempfile.mkdtemp(prefix="recruitiq_jd_")
        temp_path = Path(temp_dir) / jd_file.filename
        try:
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(jd_file.file, buffer)
            raw_text = extract_text_from_file(temp_path)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    elif jd_text and jd_text.strip():
        raw_text = jd_text.strip()
    elif DEFAULT_JD_PATH.exists():
        raw_text = DEFAULT_JD_PATH.read_text(encoding="utf-8")

    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No job description provided and default job_description.txt not found.",
        )

    if not FILES_DIR.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample files directory 'files/' not found on server.",
        )

    sample_pdfs = sorted(FILES_DIR.glob("*.pdf"))
    if not sample_pdfs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No PDF resumes found in 'files/' directory.",
        )

    resume_paths = [(p.name, str(p)) for p in sample_pdfs]
    result = screen_candidates(raw_text, resume_paths)
    return result


@app.post("/api/screen")
async def screen_uploaded_resumes(
    jd_text: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None),
    resumes: List[UploadFile] = File(...),
):
    """
    Screen multiple uploaded resume files (.pdf, .docx, .doc, .txt) against a Job Description.
    """
    # 1. Resolve JD text
    raw_jd_text = ""
    temp_dir = tempfile.mkdtemp(prefix="recruitiq_batch_")
    try:
        if jd_file and jd_file.filename:
            jd_path = Path(temp_dir) / f"jd_{jd_file.filename}"
            with open(jd_path, "wb") as buffer:
                shutil.copyfileobj(jd_file.file, buffer)
            raw_jd_text = extract_text_from_file(jd_path)
        elif jd_text and jd_text.strip():
            raw_jd_text = jd_text.strip()
        elif DEFAULT_JD_PATH.exists():
            raw_jd_text = DEFAULT_JD_PATH.read_text(encoding="utf-8")

        if not raw_jd_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please provide a Job Description (paste text or upload PDF/DOCX file).",
            )

        # 2. Filter & save uploaded resumes
        valid_uploads = [f for f in resumes if f.filename and f.filename.strip()]
        if not valid_uploads:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload at least one valid resume file (.pdf, .docx, .txt).",
            )

        saved_resume_tuples = []
        for upload in valid_uploads:
            save_path = Path(temp_dir) / upload.filename
            with open(save_path, "wb") as buffer:
                shutil.copyfileobj(upload.file, buffer)
            saved_resume_tuples.append((upload.filename, str(save_path)))

        # 3. Perform screening and ranking
        result = screen_candidates(raw_jd_text, saved_resume_tuples)
        return result
    finally:
        # Cleanup temporary files
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.post("/api/candidates/{candidate_id}/insights")
def get_insights_endpoint(candidate_id: str):
    """Retrieve or generate on-demand Gemini recruiter insights."""
    insights = get_candidate_insights(candidate_id)
    if insights.get("status") == "unavailable":
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=insights)
    return insights


@app.post("/api/candidates/{candidate_id}/insights/chat")
def follow_up_chat_endpoint(candidate_id: str, payload: InsightChatRequest):
    """Ask an interactive follow-up question regarding the candidate and job match."""
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question cannot be empty.")

    res = answer_candidate_question(candidate_id, payload.question.strip())
    if res.get("status") == "unavailable":
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=res)
    return res


# ── Mount Built Frontend (if exists) ──────────────────────────────────────────
FRONTEND_DIST = Path("frontend/dist")
if FRONTEND_DIST.exists():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=True)
