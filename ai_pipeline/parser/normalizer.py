import re
import unicodedata


def normalize_unicode(text: str) -> str:
    """
    Normalize unicode characters.
    Example:
        ﬁ -> fi
        “ ” -> "
        — -> -
    """
    return unicodedata.normalize("NFKC", text)


def normalize_spaces(text: str) -> str:
    """
    Replace multiple spaces/tabs with a single space.
    """
    return re.sub(r"[ \t]+", " ", text)


def normalize_bullets(text: str) -> str:
    """
    Convert different bullet styles into '-'
    """
    return re.sub(r"[•●▪◦]", "-", text)


def cleanup_blank_lines(text: str) -> str:
    """
    Reduce multiple blank lines to a single blank line.
    """
    return re.sub(r"\n\s*\n+", "\n\n", text)


def trim_lines(text: str) -> str:
    """
    Remove leading and trailing whitespace from each line.
    """
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(lines)


def remove_page_artifacts(text: str) -> str:
    """
    Remove common PDF page artifacts.
    Can be expanded later.
    """

    patterns = [
        r"Page\s+\d+\s+of\s+\d+",
        r"Page\s+\d+",
        r"Generated on.*",
        r"Confidential"
    ]

    for pattern in patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    return text


def normalize_text(text: str) -> str:
    """
    Main normalization pipeline.
    """

    text = normalize_unicode(text)
    text = normalize_spaces(text)
    text = normalize_bullets(text)
    text = remove_page_artifacts(text)
    text = cleanup_blank_lines(text)
    text = trim_lines(text)

    return text