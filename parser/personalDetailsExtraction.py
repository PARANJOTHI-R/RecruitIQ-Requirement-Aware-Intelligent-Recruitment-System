import re

EMAIL_PATTERN = re.compile(
    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
)

PHONE_PATTERN = re.compile(
    r"(?:\+91[-\s]?)?[6-9]\d{9}"
)

def extract_github(links):

    for link in links:

        if "github.com" in link.lower():
            return link

    return None


def extract_linkedin(links):

    for link in links:

        if "linkedin.com" in link.lower():
            return link

    return None

def extract_email(text):
    match = EMAIL_PATTERN.search(text)
    return match.group(0) if match else None


def extract_phone(text):
    match = PHONE_PATTERN.search(text)
    return match.group(0) if match else None


def extract_name(text):

    lines = text.splitlines()

    for line in lines[:10]:

        line = line.strip()

        if not line:
            continue

        if "@" in line:
            continue

        if "github" in line.lower():
            continue

        if "linkedin" in line.lower():
            continue

        if re.search(r"\d", line):
            continue

        words = line.split()

        if 2 <= len(words) <= 4:
            return line.title()

    return None