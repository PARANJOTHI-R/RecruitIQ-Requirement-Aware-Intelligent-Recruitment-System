import sys
from fastapi.testclient import TestClient
from api.main import app

def test_full_pipeline():
    client = TestClient(app)
    
    # 1. Health check
    print("Testing GET /api/health...")
    res = client.get("/api/health")
    assert res.status_code == 200
    print("Health response:", res.json())
    
    # 2. Sample JDs
    print("Testing GET /api/sample-jds...")
    res = client.get("/api/sample-jds")
    assert res.status_code == 200
    samples = res.json().get("samples", [])
    print(f"Loaded {len(samples)} sample JDs.")
    assert len(samples) >= 4
    
    # 3. Sample Resumes
    print("Testing GET /api/sample-files...")
    res = client.get("/api/sample-files")
    assert res.status_code == 200
    files = res.json().get("files", [])
    print(f"Found {len(files)} sample resumes.")
    assert len(files) == 13
    
    # 4. Screen Sample Resumes against Default JD
    print("Testing POST /api/screen-samples...")
    res = client.post("/api/screen-samples")
    assert res.status_code == 200
    data = res.json()
    
    candidates = data.get("candidates", [])
    print(f"Successfully processed {len(candidates)} candidates.")
    assert len(candidates) == 13
    
    print("\n--- RANKING SUMMARY ---")
    for c in candidates:
        status_flag = "[!REVIEW]" if not c.get("validation", {}).get("ok") else "OK"
        print(f"Rank {c['rank']}: {c['name']:<25} Score: {c['score']['overall_score']:.1f}% ({c['score']['required_skill_fit']:.0f}% req fit) - {c['parse_method']} [{status_flag}]")
    
    # Verify Top Candidates match terminal POC
    assert candidates[0]["name"] == "Akshay Chandar M"
    assert round(candidates[0]["score"]["overall_score"], 1) == 95.9
    
    assert candidates[1]["name"] == "Alex Chen"
    assert round(candidates[1]["score"]["overall_score"], 1) == 94.3
    
    assert candidates[2]["name"] == "Sarah Jenkins"
    assert round(candidates[2]["score"]["overall_score"], 1) == 75.7
    
    # Verify Evidence extraction
    top_cand = candidates[0]
    matched_reqs = top_cand["score"]["matched_required"]
    print(f"\nTop Candidate ({top_cand['name']}) Matched Required Skills:")
    for r in matched_reqs:
        print(f"  [+] {r['skill']} ({r['match_type']}) -> Evidence: {r['evidence']}")
        assert r["evidence"] is not None
        
    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY! ✨")

if __name__ == "__main__":
    test_full_pipeline()
