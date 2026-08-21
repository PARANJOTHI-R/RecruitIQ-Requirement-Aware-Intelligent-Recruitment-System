# parser/personalDetailsExtraction.py
#
# Extracts personal contact details from resume text + PDF link annotations.

import re

# ── Patterns ──────────────────────────────────────────────────────────────────

EMAIL_PATTERN = re.compile(
    r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"
)

# Broader phone: supports +91, +1, international (+XX), or plain 10-digit numbers
PHONE_PATTERN = re.compile(
    r"(?:"
    r"\+?\d{1,3}[\s\-.]?"        # optional country code
    r")?"
    r"(?:\(?\d{2,4}\)?[\s\-.]?)" # area code (optional parens)
    r"\d{3,4}[\s\-.]?"           # first block
    r"\d{3,4}"                   # second block
)

# URL patterns for GitHub / LinkedIn in plain text
_GITHUB_TEXT_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/[A-Za-z0-9_\-./]+"
)
_LINKEDIN_TEXT_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Za-z0-9_\-./]+"
)


# ── Extractors ────────────────────────────────────────────────────────────────

def extract_email(text: str) -> str | None:
    match = EMAIL_PATTERN.search(text)
    return match.group(0) if match else None


def extract_phone(text: str) -> str | None:
    """
    Returns the first plausible phone number found.
    Filters out short or obviously invalid matches.
    """
    for match in PHONE_PATTERN.finditer(text):
        raw = match.group(0)
        digits = re.sub(r"\D", "", raw)
        # Require at least 7 digits, at most 15 (E.164 max)
        if 7 <= len(digits) <= 15:
            return raw.strip()
    return None


def extract_github(links: list, text: str = "") -> str | None:
    """
    Look for a GitHub URL in:
    1. PDF link annotations (links list)
    2. Visible text (text argument)
    Returns the URL or None.
    """
    # 1. PDF link annotations
    for link in links:
        if "github.com" in link.lower():
            return _normalize_url(link)

    # 2. Visible text
    match = _GITHUB_TEXT_PATTERN.search(text)
    if match:
        return _normalize_url(match.group(0))

    return None


def extract_linkedin(links: list, text: str = "") -> str | None:
    """
    Look for a LinkedIn URL in:
    1. PDF link annotations (links list)
    2. Visible text (text argument)
    Returns the URL or None.
    """
    # 1. PDF link annotations
    for link in links:
        if "linkedin.com" in link.lower():
            return _normalize_url(link)

    # 2. Visible text
    match = _LINKEDIN_TEXT_PATTERN.search(text)
    if match:
        return _normalize_url(match.group(0))

    return None


def extract_name(text: str) -> str | None:
    """
    Heuristic name extraction: look at the first 10 non-empty lines.
    Picks the first line that looks like a proper name (2-4 title-case words,
    no digits, no URL fragments).
    """
    lines = text.splitlines()

    for line in lines[:10]:
        line = line.strip()
        if not line:
            continue
        if "@" in line:
            continue
        if any(kw in line.lower() for kw in ("github", "linkedin", "http", "www.", ".com")):
            continue
        if re.search(r"\d", line):
            continue
        words = line.split()
        if 2 <= len(words) <= 5:
            # Basic check: most words should start with a capital letter
            cap_count = sum(1 for w in words if w[0].isupper())
            if cap_count >= len(words) - 1:
                return line.title()

    return None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_url(url: str) -> str:
    """Ensure URL starts with https://"""
    url = url.strip().rstrip("/")
    if not url.startswith("http"):
        url = "https://" + url
    return url