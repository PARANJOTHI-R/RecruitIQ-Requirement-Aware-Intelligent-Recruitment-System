# ExplainHire

### Explainable AI Recruitment Screening System

ExplainHire is an AI-assisted recruitment screening system designed to make candidate screening **requirement-aware, evidence-backed, and explainable**.

Instead of relying only on keyword matching or a single semantic similarity score, ExplainHire combines **resume parsing, skill normalization, exact matching, semantic matching, evidence verification, requirement-aware scoring, and LLM-generated insights** to produce transparent candidate rankings.

The goal is not simply to answer:

> "How similar is this resume to the job description?"

but:

> **"How well does this candidate satisfy the actual requirements, what evidence supports the decision, what is missing, and why was the candidate ranked here?"**

---

## 🎯 Problem

Traditional resume screening systems often rely on:

- Keyword matching
- Basic filtering
- Single similarity scores
- Black-box AI predictions

These approaches can create problems when:

- A candidate uses different wording for the same skill.
- Semantically related technologies are incorrectly treated as equivalent.
- A candidate has the required skills but lacks the required experience.
- A candidate has strong semantic similarity but misses a critical requirement.
- Recruiters cannot understand why a candidate received a particular score.

ExplainHire addresses these problems by separating **semantic similarity from actual requirement satisfaction**.

---

## 💡 Core Idea

ExplainHire follows a hybrid recruitment screening approach:

```text
                    Job Description
                           │
                           ▼
                 Requirement Analyzer
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        Required       Preferred      Experience
         Skills          Skills        Criteria
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                     Candidate Profile
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        Exact Match    Semantic Match   Evidence
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                    Scoring Engine
                           │
                           ▼
                  Explainable Ranking
                           │
                           ▼
                    AI Insights
                           │
                           ▼
                  Recruiter Dashboard
