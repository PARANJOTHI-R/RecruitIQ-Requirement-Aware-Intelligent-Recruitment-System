import io
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app

def test_flask_app():
    app.config["TESTING"] = True
    client = app.test_client()

    # Test GET /
    res = client.get("/")
    assert res.status_code == 200
    assert b"RecruitIQ" in res.data
    assert b"Job Description" in res.data
    print("[OK] GET / test passed")

    # Test POST / with files
    pdf1_path = os.path.join("files", "Resume-24cdr080.pdf")
    pdf2_path = os.path.join("files", "res2.pdf")

    with open(pdf1_path, "rb") as f1, open(pdf2_path, "rb") as f2:
        data = {
            "job_description": """Java Backend Developer
Required: Java, Spring Boot, REST APIs, SQL, 2+ years experience
Preferred: Docker, AWS, Kafka
Education: Computer Science or related field""",
            "resumes": [
                (f1, "Resume-24cdr080.pdf"),
                (f2, "res2.pdf"),
                (io.BytesIO(b"Not a valid PDF"), "corrupted.pdf")
            ]
        }
        res_post = client.post("/", data=data, content_type="multipart/form-data")
        assert res_post.status_code == 200
        html = res_post.data.decode("utf-8")
        assert "Ranked Candidate Leaderboard" in html
        assert "Paranjothi R" in html
        assert "Jason Miller" in html
        assert "corrupted.pdf" in html  # error section should report corrupted.pdf
        assert "Languages: Java" in html  # evidence check
        print("[OK] POST / with multiple resumes and error simulation passed")

    print("\nALL FLASK TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_flask_app()
