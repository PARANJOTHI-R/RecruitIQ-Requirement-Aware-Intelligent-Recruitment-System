# api/models.py
"""
Pydantic data models for the RecruitIQ FastAPI backend.
"""

from __future__ import annotations
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class JobProfileModel(BaseModel):
    title: Optional[str] = "Job Role"
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    minimum_experience_years: int = 0
    raw_text: Optional[str] = None


class PersonalDetailsModel(BaseModel):
    name: str = "Unknown Candidate"
    name_confidence: float = 1.0
    email: Optional[str] = None
    phone: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None


class ValidationResultModel(BaseModel):
    ok: bool = True
    warnings: List[str] = Field(default_factory=list)
    extraction_status: str = "ok"  # "ok" | "degraded" | "failed"


class CandidateProfileModel(BaseModel):
    name: str = "Unknown Candidate"
    skills: List[str] = Field(default_factory=list)
    experience_years: Optional[float] = None
    internship_years: Optional[float] = None


class SkillMatchDetailModel(BaseModel):
    skill: str
    status: str  # "MATCH" | "MISSING" | "RELATED"
    match_type: Optional[str] = None  # "exact" | "normalized" | "semantic"
    evidence: Optional[str] = None
    similarity: Optional[float] = None


class ScoreResultModel(BaseModel):
    candidate: str
    overall_score: float
    required_skill_fit: float
    preferred_skill_fit: float
    experience_fit: Optional[float] = None
    candidate_experience: Optional[float] = None
    required_experience: int = 0
    matched_required: List[SkillMatchDetailModel] = Field(default_factory=list)
    missing_required: List[str] = Field(default_factory=list)
    matched_preferred: List[SkillMatchDetailModel] = Field(default_factory=list)
    missing_preferred: List[str] = Field(default_factory=list)
    required_results: List[SkillMatchDetailModel] = Field(default_factory=list)
    preferred_results: List[SkillMatchDetailModel] = Field(default_factory=list)


class CandidateResultModel(BaseModel):
    id: str
    rank: int = 0
    filename: str
    name: str
    parse_method: str = "layout"
    validation: ValidationResultModel
    contact: PersonalDetailsModel
    profile: CandidateProfileModel
    semantic_similarity: float = 0.0
    score: ScoreResultModel


class ScreeningResponseModel(BaseModel):
    job_profile: JobProfileModel
    candidates: List[CandidateResultModel]
    errors: List[dict] = Field(default_factory=list)
    total_processed: int = 0
    successful_count: int = 0


class InsightChatRequest(BaseModel):
    question: str


class AnalyzeJdRequest(BaseModel):
    jd_text: str
