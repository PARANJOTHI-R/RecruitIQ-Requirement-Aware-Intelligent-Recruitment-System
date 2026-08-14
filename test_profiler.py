import time
import os
import glob
from pathlib import Path
from engine.job_requirement_analyzer import analyze_job_description
from engine.scoring_engine import score_candidate
from main import process_resume

def run_profiler():
    print("=== PERFORMANCE PROFILER ===")
    
    t0 = time.time()
    from engine.semantic_matcher import init_model
    init_model()
    t1 = time.time()
    print(f"1. Model initialization time: {t1 - t0:.4f} seconds")
    
    jd_text = """Java Backend Developer
    Required: Java, Spring Boot, REST APIs, SQL, 2+ years experience
    Preferred: Docker, AWS, Kafka
    Education: Computer Science or related field"""
    
    t2 = time.time()
    job_profile = analyze_job_description(jd_text)
    t3 = time.time()
    print(f"2. JD parsing time: {t3 - t2:.4f} seconds")
    
    pdf_files = glob.glob("files/*.pdf")
    if not pdf_files:
        print("No PDF files found.")
        return
        
    print(f"Processing {len(pdf_files)} resumes...")
    
    total_parse_time = 0
    total_score_time = 0
    
    for pdf in pdf_files:
        pt0 = time.time()
        parsed_data = process_resume(pdf)
        pt1 = time.time()
        total_parse_time += (pt1 - pt0)
        
        candidate_profile = parsed_data.get("candidate_profile", {})
        
        st0 = time.time()
        score_result = score_candidate(job_profile, candidate_profile, resume_lines=parsed_data.get("resume_lines", []), use_semantic=True)
        st1 = time.time()
        total_score_time += (st1 - st0)

    print(f"3. Total parsing time for {len(pdf_files)} resumes: {total_parse_time:.4f} seconds (Avg: {total_parse_time/len(pdf_files):.4f}s)")
    print(f"4. Total scoring time (including embeddings) for {len(pdf_files)} resumes: {total_score_time:.4f} seconds (Avg: {total_score_time/len(pdf_files):.4f}s)")
    
    print(f"5. Total batch time: {(time.time() - t1):.4f} seconds")
    
if __name__ == '__main__':
    run_profiler()
