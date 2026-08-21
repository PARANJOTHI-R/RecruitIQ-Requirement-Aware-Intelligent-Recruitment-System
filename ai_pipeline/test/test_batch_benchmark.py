import requests
import time
import subprocess
import os
import glob
import sys

print("Starting Flask app for integration testing...")
# Ensure use_reloader is false
app_process = subprocess.Popen([sys.executable, "app.py"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(15) # Wait for startup and eager model loading

try:
    print("Testing /api/screen with 13 resumes (TEST K & H)...")
    
    # Get all PDF files
    files_to_upload = []
    pdf_paths = glob.glob("files/*.pdf")
    for p in pdf_paths:
        files_to_upload.append(("resumes", (os.path.basename(p), open(p, "rb"), "application/pdf")))
        
    start_time = time.time()
    resp = requests.post(
        "http://127.0.0.1:5000/api/screen",
        data={"job_description": "Java Developer, Spring Boot, SQL"},
        files=files_to_upload
    )
    end_time = time.time()
    elapsed = end_time - start_time
    
    assert resp.status_code == 200, f"Failed with {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "candidates" in data, "No candidates in response"
    assert len(data["candidates"]) > 0, "No candidates processed"
    
    print(f"Batch processing time for {len(files_to_upload)} resumes: {elapsed:.2f} seconds")
    assert elapsed < 20.0, f"Processing is too slow: {elapsed:.2f}s (should be < 20s with pre-loaded batched model)"
    print("[PASS] TEST K: 13-resume batch processing benchmark")
    
    candidate_id = data["candidates"][0]["id"]
    
    print("Testing /candidates/<id>/insights (TEST J & I)...")
    resp_insights = requests.post(f"http://127.0.0.1:5000/candidates/{candidate_id}/insights")
    assert resp_insights.status_code in [200, 503], f"Unexpected status {resp_insights.status_code}"
    insights_data = resp_insights.json() # Verify it's JSON
    print("[PASS] TEST J: Frontend /candidates/<id>/insights receives JSON rather than HTML")
    
    print("Integration tests successful.")
finally:
    for _, f in files_to_upload:
        f[1].close()
    app_process.terminate()
