import fitz  # PyMuPDF
from pathlib import Path

from parser.personalDetailsExtraction import (
    extract_name,
    extract_email,
    extract_phone,
    extract_github,
    extract_linkedin,
)


# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

PDF_PATH = Path("files/Dhanushree_Resume.pdf")


# ─────────────────────────────────────────────
# Read PDF
# ─────────────────────────────────────────────

def extract_pdf_content(pdf_path):
    text = ""
    links = []

    doc = fitz.open(pdf_path)

    for page in doc:
        text += page.get_text() + "\n"

        for link in page.get_links():
            uri = link.get("uri")
            if uri:
                links.append(uri)

    doc.close()

    return text, links


# ─────────────────────────────────────────────
# Test
# ─────────────────────────────────────────────

def main():

    if not PDF_PATH.exists():
        print(f"ERROR: File not found: {PDF_PATH}")
        return

    print("=" * 60)
    print(f"Testing: {PDF_PATH}")
    print("=" * 60)

    text, links = extract_pdf_content(PDF_PATH)

    print("\n--- Extracted PDF Text ---")
    print(text)

    print("\n--- PDF Links ---")
    for link in links:
        print(link)

    # Run extraction functions
    name = extract_name(text)
    email = extract_email(text)
    phone = extract_phone(text)
    github = extract_github(links, text)
    linkedin = extract_linkedin(links, text)

    print("\n" + "=" * 60)
    print("EXTRACTED PERSONAL DETAILS")
    print("=" * 60)

    print(f"Name     : {name}")
    print(f"Email    : {email}")
    print(f"Phone    : {phone}")
    print(f"GitHub   : {github}")
    print(f"LinkedIn : {linkedin}")

    print("=" * 60)


if __name__ == "__main__":
    main()