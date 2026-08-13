"""
server.py — RecruitIQ Web Application Runner
===========================================
Starts the FastAPI server with the built React frontend.

Usage:
  python server.py
  (or: uvicorn api.main:app --reload --port 8000)

Access in browser:
  http://127.0.0.1:8000
"""

import sys
import webbrowser
import uvicorn

if __name__ == "__main__":
    port = 8000
    host = "127.0.0.1"
    url = f"http://{host}:{port}"
    
    print("=" * 60)
    print("  🚀 RecruitIQ Web Application")
    print("  ATS Intelligent Screening & Ranking Platform")
    print("=" * 60)
    print(f"  Server URL  : {url}")
    print(f"  Swagger Docs: {url}/docs")
    print("=" * 60)
    
    try:
        webbrowser.open(url)
    except Exception:
        pass
        
    uvicorn.run("api.main:app", host=host, port=port, reload=True)
