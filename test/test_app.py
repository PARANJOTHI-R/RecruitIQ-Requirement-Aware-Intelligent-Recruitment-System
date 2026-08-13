import io
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app

def test_flask_app():
    app.config["TESTING"] = True
    client = app.test_client()

    # (Removed GET / test since the API no longer serves HTML)

    # Test POST /api/screen with files
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
        res_post = client.post("/api/screen", data=data, content_type="multipart/form-data")
        assert res_post.status_code == 200
        
        json_data = res_post.get_json()
        assert json_data is not None, "Response is not JSON"
        assert json_data["total_processed"] == 3
        assert json_data["successful_count"] == 2
        
        names = [c["name"] for c in json_data["candidates"]]
        assert "Paranjothi R" in names
        assert "Jason Miller" in names
        
        errors = [e["filename"] for e in json_data["errors"]]
        assert "corrupted.pdf" in errors
        
        print("[OK] POST /api/screen with multiple resumes and error simulation passed")

    print("\nALL FLASK TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_flask_app()
