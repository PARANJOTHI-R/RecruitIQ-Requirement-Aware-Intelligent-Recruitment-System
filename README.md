# RecruitIQ (ExplainHire)

### Requirement-Aware Intelligent Recruitment & Candidate Ranking System

RecruitIQ is an explainable AI-assisted recruitment screening system designed to make candidate screening **requirement-aware, evidence-backed, and transparent**.

It combines **layout-aware resume parsing, skill normalization, deterministic matching, MiniLM semantic similarity with false-positive guards, verbatim evidence extraction, requirement-aware scoring, and Gemini-powered recruiter insights**.

---

## 🚀 Quick Start (Web Application)

### 1. Run the Web Application
Run the unified FastAPI + React server:

```bash
# Activate virtual environment
.\.venv\Scripts\activate

# Launch RecruitIQ Web Server
python server.py
```

Then open your browser at **`http://127.0.0.1:8000`** (or API docs at `http://127.0.0.1:8000/docs`).

### 2. Frontend Development Mode (Hot Reload)
If you want to edit the React frontend with instant hot-reloading:

```bash
cd frontend
npm run dev
```
Open **`http://localhost:5173`**. Requests to `/api/*` are automatically proxied to the FastAPI server at `http://127.0.0.1:8000`.

---

## 🌟 Key Web Platform Features

1. **Light Theme UI**: Clean, responsive, modern interface built with React, Plus Jakarta Sans typography, glassmorphism cards, and podium badges.
2. **Flexible Job Description Ingestion**:
   - **Paste / Edit Text** with 4 built-in industry role presets (*Backend Engineer*, *Full Stack*, *Java Enterprise*, *AI / Data Scientist*).
   - **Upload PDF JD**.
   - **Upload Word (.docx, .doc) or Text JD**.
   - Live requirement extraction preview (Required Skills, Preferred Skills, Min Experience).
3. **Multi-Resume Batch Uploader**:
   - Multi-file drag-and-drop zone supporting `.pdf`, `.docx`, `.doc`, `.txt`.
   - **1-Click "Demo Pool (13)"**: Instantly screen the 13 benchmark candidate profiles.
4. **Explainable Screening Leaderboard**:
   - Ranks with visual podium medals (🥇 #1, 🥈 #2, 🥉 #3, etc.).
   - Overall Score (%) with color-coded score pills.
   - Required Skill Fit %, Preferred Skill Fit %, Experience Fit %, and Parser Quality flags (`[!REVIEW]`, `DEGRADED`).
   - One-click CSV export and candidate filtering/search.
5. **Candidate Match Inspector (Drawer)**:
   - **Skill Matching Table**: Status badges (`[+] Match`, `[-] Missing`), Match Type (`Exact`, `Normalized`, `Semantic`), and **verbatim resume evidence snippets**.
   - **Deterministic Scoring Matrix**: 50% Required + 20% Preferred + 30% Experience.
   - **MiniLM Semantic Similarity Gauge** with false-positive prevention explanation.
   - **Parser Quality Diagnostic Banners**.
6. **Gemini AI Recruiter Insights & Follow-up Q&A**:
   - Executive Candidate Summary, Key Strengths, Skill Gaps, Experience Relevance, Interview Focus Questions.
   - Interactive Recruiter Chat Copilot scoped to the candidate's profile.

---

## 🖥️ Command Line (CLI) Terminal Mode

You can also run the original command line terminal screening tool:

```bash
python main.py
```
