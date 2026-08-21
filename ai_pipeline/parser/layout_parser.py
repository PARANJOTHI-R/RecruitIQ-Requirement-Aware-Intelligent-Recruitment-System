# parser/layout_parser.py
#
# Layout-aware PDF parser using PyMuPDF block metadata.
#
# ARCHITECTURE:
#   PDF -> page.get_text('dict') -> blocks with bbox, font size, flags
#       -> column detection (x-coordinate clustering)
#       -> header detection (top region + large font)
#       -> spatially sorted reading order per region
#       -> section detection (text + font signals)
#       -> structured content extraction
#       -> LayoutDocument
#
# This module is the PRIMARY parse path.  main.py falls back to the old
# linear SectionParser if this raises an unrecoverable exception.

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

import pymupdf  # PyMuPDF

# ---------------------------------------------------------------------------
# Known section headings -- these must NEVER become candidate names
# ---------------------------------------------------------------------------
KNOWN_SECTION_HEADINGS: set[str] = {
    "profile", "summary", "professional summary", "about me",
    "objective", "career objective",
    "skills", "technical skills", "tech skills", "soft skills",
    "programming languages", "database", "design skills",
    "ar/vr", "frameworks", "tools", "technologies",
    "experience", "work experience", "professional experience",
    "employment", "employment history",
    "education", "academic background", "qualifications",
    "education details", "educational qualification",
    "projects", "project", "academic projects", "major projects",
    "certifications", "certifications & licenses", "certificates",
    "achievements", "achievements & hackathons", "awards",
    "internship", "internships", "industrial training",
    "leadership", "leadership experience",
    "contact", "publications", "research",
}


# ---------------------------------------------------------------------------
# Section aliases: maps heading text (lowercase) -> canonical section key
# ---------------------------------------------------------------------------
SECTION_ALIASES: dict[str, str] = {
    # Summary / profile
    "profile": "summary",
    "summary": "summary",
    "professional summary": "summary",
    "about me": "summary",
    "objective": "summary",
    "career objective": "summary",

    # Skills (flat -- sub-categories handled separately)
    "skills": "skills",
    "technical skills": "skills",
    "tech skills": "skills",
    "core skills": "skills",
    "core competencies": "skills",
    "technology stack": "skills",
    "tech stack": "skills",
    "technologies": "skills",
    "tools": "skills",
    "frameworks": "skills",
    "competencies": "skills",

    # Specific skill sub-categories (kept as their own section keys)
    "programming languages": "skills_programming",
    "database": "skills_database",
    "databases": "skills_database",
    "design skills": "skills_design",
    "ar/vr": "skills_arvr",
    "ar vr": "skills_arvr",

    # Education
    "education": "education",
    "academic background": "education",
    "academic qualifications": "education",
    "qualifications": "education",
    "education details": "education",
    "educational qualification": "education",

    # Experience
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "employment": "experience",
    "employment history": "experience",
    "career history": "experience",

    # Projects
    "projects": "projects",
    "project": "projects",
    "project experience": "projects",
    "academic projects": "projects",
    "personal projects": "projects",
    "major projects": "projects",
    "minor projects": "projects",

    # Certifications
    "certifications": "certifications",
    "certificates": "certifications",
    "licenses": "certifications",
    "professional certifications": "certifications",
    "certifications & licenses": "certifications",

    # Achievements
    "achievements": "achievements",
    "awards": "achievements",
    "honors": "achievements",
    "accomplishments": "achievements",
    "achievements & hackathons": "achievements",

    # Internships
    "internships": "internships",
    "internship": "internships",
    "industrial training": "internships",

    # Soft skills
    "soft skills": "soft_skills",
    "interpersonal skills": "soft_skills",

    # Leadership
    "leadership": "leadership",
    "leadership experience": "leadership",

    # Publications
    "publications": "publications",
    "research": "publications",
    "research papers": "publications",

    # Contact (sidebar info -- not a content section)
    "contact": "_contact",
}

# Single-word aliases that are ALSO common content words.
# These require heading-level typography to be accepted as section headings.
# (Prevents "Leadership" soft-skill item from being a section heading.)
_AMBIGUOUS_SINGLE_WORD_ALIASES: set[str] = {
    "leadership", "education", "experience", "projects", "project",
    "skills", "tools", "technologies", "frameworks", "competencies",
    "publications", "research", "licenses", "awards", "honors",
    "qualifications", "employment", "summary", "profile", "objective",
    "certifications", "certificates", "achievements", "accomplishments",
    "internship", "internships",
}


# ---------------------------------------------------------------------------
# Data classes for intermediate representation
# ---------------------------------------------------------------------------

@dataclass
class Span:
    text: str
    font_size: float
    flags: int
    font_name: str
    bbox: tuple  # (x0, y0, x1, y1)

    @property
    def is_bold(self) -> bool:
        # PyMuPDF flags: bit 4 (16) = bold; also check font name
        return bool(self.flags & 16) or "bold" in self.font_name.lower()

    @property
    def is_italic(self) -> bool:
        return bool(self.flags & 2)

    @property
    def x0(self) -> float:
        return self.bbox[0]

    @property
    def y0(self) -> float:
        return self.bbox[1]

    @property
    def x1(self) -> float:
        return self.bbox[2]

    @property
    def y1(self) -> float:
        return self.bbox[3]

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0


@dataclass
class Block:
    block_no: int
    bbox: tuple  # (x0, y0, x1, y1)
    spans: list = field(default_factory=list)
    region: str = "body"  # "header" | "left" | "right" | "body"

    @property
    def text(self) -> str:
        return " ".join(s.text for s in self.spans if s.text.strip())

    @property
    def dominant_font_size(self) -> float:
        if not self.spans:
            return 10.0
        sizes = [s.font_size for s in self.spans if s.text.strip()]
        return max(sizes) if sizes else 10.0

    @property
    def is_bold(self) -> bool:
        return any(s.is_bold for s in self.spans if s.text.strip())

    @property
    def x0(self) -> float:
        return self.bbox[0]

    @property
    def y0(self) -> float:
        return self.bbox[1]

    @property
    def x1(self) -> float:
        return self.bbox[2]

    @property
    def y1(self) -> float:
        return self.bbox[3]

    @property
    def center_x(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class LayoutDocument:
    """Intermediate representation after layout-aware extraction."""
    page_count: int
    page_width: float
    page_height: float
    links: list

    # Ordered content regions (reconstructed reading order)
    header_blocks: list         # top of page -- name, title, tagline
    ordered_blocks: list        # all blocks in correct reading order

    # Structured sections
    sections: dict              # section_key -> list of text lines

    # Personal details
    personal: dict              # name, email, phone, linkedin, github

    # Extraction metadata
    column_boundary: Optional[float]   # x-coord separating left/right columns
    is_multi_column: bool
    body_font_size: float              # estimated body text font size

    # Quality metrics
    extraction_quality: dict


# ---------------------------------------------------------------------------
# Main extraction function
# ---------------------------------------------------------------------------

def extract_layout(pdf_path: str) -> LayoutDocument:
    """
    Primary entry point. Extracts a LayoutDocument from a PDF file.
    Uses PyMuPDF block-level dict extraction to preserve spatial metadata.
    """
    doc = pymupdf.open(pdf_path)

    all_blocks: list[Block] = []
    links: list[str] = []
    page_w = 595.0
    page_h = 842.0

    for page_idx, page in enumerate(doc):
        # Read dimensions BEFORE any other operation
        page_w = page.rect.width
        page_h = page.rect.height

        # Collect link annotations
        for link in page.get_links():
            if "uri" in link:
                links.append(link["uri"])

        # Extract blocks with full metadata
        page_dict = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)

        for raw_block in page_dict.get("blocks", []):
            if raw_block.get("type") != 0:  # skip image blocks
                continue

            spans: list[Span] = []
            for line in raw_block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    spans.append(Span(
                        text=text,
                        font_size=span.get("size", 10.0),
                        flags=span.get("flags", 0),
                        font_name=span.get("font", ""),
                        bbox=tuple(span.get("bbox", [0, 0, 0, 0])),
                    ))

            if not spans:
                continue

            block = Block(
                block_no=raw_block.get("number", 0),
                bbox=tuple(raw_block.get("bbox", [0, 0, 0, 0])),
                spans=spans,
            )
            all_blocks.append(block)

    doc.close()

    if not all_blocks:
        return _empty_document(links)

    # Estimate body font size (most common font size among body text blocks)
    body_font_size = _estimate_body_font_size(all_blocks)

    # Detect header region
    header_threshold_y = page_h * 0.15  # top 15% of page
    header_blocks_primary = [b for b in all_blocks if b.y1 <= header_threshold_y]

    # Also include large-font blocks near the top
    large_font_threshold = body_font_size * 1.5
    extra_header = [
        b for b in all_blocks
        if b not in header_blocks_primary
        and b.dominant_font_size >= large_font_threshold
        and b.y0 < page_h * 0.25
    ]
    # Deduplicate using object identity (Block is mutable, not hashable)
    seen_ids: set[int] = set()
    combined: list[Block] = []
    for b in header_blocks_primary + extra_header:
        if id(b) not in seen_ids:
            seen_ids.add(id(b))
            combined.append(b)
    header_blocks = sorted(combined, key=lambda b: b.y0)
    header_set = set(id(b) for b in header_blocks)


    # Detect column layout
    non_header_blocks = [b for b in all_blocks if id(b) not in header_set]
    col_boundary, is_multi_col = _detect_column_boundary(non_header_blocks, page_w)

    # Assign regions
    for b in all_blocks:
        if id(b) in header_set:
            b.region = "header"
        elif is_multi_col:
            b.region = "left" if b.center_x <= col_boundary else "right"
        else:
            b.region = "body"

    # Reconstruct reading order
    ordered_blocks = _reconstruct_reading_order(all_blocks, is_multi_col)

    # Split embedded headings (where heading + content are in one block)
    ordered_blocks = _split_embedded_headings(ordered_blocks, body_font_size)

    # Extract sections from ordered blocks
    sections = _extract_sections(ordered_blocks, body_font_size)

    # Extract personal details
    personal = _extract_personal(header_blocks, links, sections)

    # Compute extraction quality
    blocks_assigned = sum(
        1 for b in all_blocks
        if b.region in ("header", "left", "right", "body")
    )
    extraction_quality = {
        "sections_detected": len([
            b for b in ordered_blocks
            if _is_section_heading(b, body_font_size) is not None
        ]),
        "sections_parsed": len(sections),
        "blocks_total": len(all_blocks),
        "blocks_assigned": blocks_assigned,
        "is_multi_column": is_multi_col,
        "column_boundary": round(col_boundary, 1) if is_multi_col else None,
        "body_font_size": body_font_size,
    }

    return LayoutDocument(
        page_count=1,
        page_width=page_w,
        page_height=page_h,
        links=links,
        header_blocks=header_blocks,
        ordered_blocks=ordered_blocks,
        sections=sections,
        personal=personal,
        column_boundary=col_boundary if is_multi_col else None,
        is_multi_column=is_multi_col,
        body_font_size=body_font_size,
        extraction_quality=extraction_quality,
    )


# ---------------------------------------------------------------------------
# Layout analysis helpers
# ---------------------------------------------------------------------------

def _estimate_body_font_size(blocks: list[Block]) -> float:
    """Return the most common (mode) font size -- approximates body text."""
    sizes: list[float] = []
    for b in blocks:
        for s in b.spans:
            if s.text.strip():
                # Round to 0.5pt buckets to avoid floating-point fragmentation
                sizes.append(round(s.font_size * 2) / 2)
    if not sizes:
        return 10.0
    return Counter(sizes).most_common(1)[0][0]


def _detect_column_boundary(blocks: list[Block], page_width: float) -> tuple:
    """
    Detect whether the page has a two-column layout and find the boundary.

    Strategy:
    1. Collect x-extents of all blocks
    2. Build occupancy histogram (10pt buckets)
    3. Find horizontal gaps (zero-occupancy ranges) between 20-80% of page width
    4. Largest gap >= 15pt -> two-column layout; boundary at gap midpoint
    5. Verify both sides have content

    Returns (boundary_x, is_multi_column).
    """
    if not blocks:
        return page_width / 2, False

    BUCKET = 10.0
    n_buckets = int(page_width / BUCKET) + 1
    occupancy = [0] * n_buckets

    for b in blocks:
        i_start = int(b.x0 / BUCKET)
        i_end = min(int(b.x1 / BUCKET), n_buckets - 1)
        for i in range(i_start, i_end + 1):
            occupancy[i] += 1

    # Find zero-occupancy gaps between 20% and 80% of page width
    min_x = int(page_width * 0.20 / BUCKET)
    max_x = int(page_width * 0.80 / BUCKET)

    gaps: list[tuple[int, int]] = []
    in_gap = False
    gap_start = 0
    for i in range(min_x, max_x):
        if occupancy[i] == 0:
            if not in_gap:
                gap_start = i
                in_gap = True
        else:
            if in_gap:
                gaps.append((gap_start, i - 1))
                in_gap = False
    if in_gap:
        gaps.append((gap_start, max_x - 1))

    if not gaps:
        return page_width / 2, False

    # Use the largest gap as the column divider
    largest_gap = max(gaps, key=lambda g: g[1] - g[0])
    gap_width = (largest_gap[1] - largest_gap[0] + 1) * BUCKET

    # Only treat as multi-column if the gap is at least 15pt wide
    if gap_width < 15.0:
        return page_width / 2, False

    boundary_x = (largest_gap[0] + largest_gap[1]) / 2 * BUCKET

    # Verify both sides are occupied
    left_blocks = [b for b in blocks if b.x1 <= boundary_x]
    right_blocks = [b for b in blocks if b.x0 >= boundary_x]
    if not left_blocks or not right_blocks:
        return page_width / 2, False

    return boundary_x, True


def _reconstruct_reading_order(blocks: list[Block], is_multi_col: bool) -> list[Block]:
    """
    Return blocks in logical reading order.
    Header blocks first (sorted by y0).
    Then left column blocks (sorted by y0).
    Then right column blocks (sorted by y0).
    For single-column: all body blocks sorted by y0.

    IMPORTANT: We do NOT interleave left and right column blocks.
    Two-column resumes have self-contained left and right narratives.
    The sections in each column are independent.
    """
    header = sorted([b for b in blocks if b.region == "header"], key=lambda b: b.y0)

    if is_multi_col:
        left = sorted([b for b in blocks if b.region == "left"], key=lambda b: b.y0)
        right = sorted([b for b in blocks if b.region == "right"], key=lambda b: b.y0)
        return header + left + right
    else:
        body = sorted([b for b in blocks if b.region == "body"], key=lambda b: b.y0)
        return header + body


# ---------------------------------------------------------------------------
# Section extraction
# ---------------------------------------------------------------------------

def _is_section_heading(block: Block, body_font_size: float) -> Optional[str]:
    """
    Return the canonical section key if this block is a section heading, else None.

    Uses BOTH text signals AND layout (typography) signals -- Rule 8.

    Typography gate for ambiguous single-word aliases:
    A block is considered heading-typography if EITHER:
      (a) is_bold AND font_size >= body_font_size  (bold heading style)
      (b) font_size >= body_font_size * 1.15       (notably larger than body, no bold needed)

    This handles:
    - Dhanushree: 'Leadership' at 10pt Lato-Regular (not bold) => REJECTED (no typography gate)
    - Dhanushree: 'LEADERSHIP' at 14pt Now-Bold (bold) => ACCEPTED
    - Paranjothi: 'Education' at 12pt non-bold, body=10pt => 12 >= 10*1.15=11.5 => ACCEPTED
    """
    text = block.text.strip()
    if not text:
        return None

    text_lower = text.lower().strip()
    words = text.split()

    # Typography signals
    is_bold = block.is_bold
    font_size = block.dominant_font_size

    # A block has heading-level typography if:
    # (a) it is bold AND at or above body size, OR
    # (b) its font is >= 115% of body size (size-only heading, no bold required), OR
    # (c) it is ALL-CAPS (strong layout signal for headings)
    is_heading_typography = (
        (is_bold and font_size >= body_font_size)
        or (font_size >= body_font_size * 1.15)
        or (text.isupper() and len(text) > 3)
    )

    # --- Direct alias lookup ---
    if text_lower in SECTION_ALIASES:
        key = SECTION_ALIASES[text_lower]

        if key == "_contact":
            return None

        # Single-word ambiguous aliases require heading-level typography.
        # Prevents 'Leadership' (10pt, not bold) from being classified as a section.
        # Allows 'Education' (12pt, not bold, body=10pt) to pass via size-only gate.
        if len(words) == 1 and text_lower in _AMBIGUOUS_SINGLE_WORD_ALIASES:
            if is_heading_typography:
                return key
            return None  # content word, not a heading

        # Multi-word alias -- text match is sufficient
        return key

    # --- Font-based heading detection for unrecognized/compound headings ---
    # e.g., "ACHIEVEMENTS & HACKATHONS", "CERTIFICATIONS & LICENSES"
    if (
        len(words) <= 6
        and is_heading_typography
        and len(text) >= 3
    ):
        # To avoid false positives like "Software Engineer Intern - NovaStack Technologies"
        # matching the "technologies" alias, we require that the heading contains a known alias
        # AND we don't just blindly accept any substring. 
        # A compound heading should mostly consist of aliases and conjunctions/punctuation.
        
        # Check if any alias is present as a standalone word
        matched_key = None
        for alias, key in SECTION_ALIASES.items():
            if key == "_contact":
                continue
            # Use regex for word boundary to avoid partial matches
            if re.search(rf'\b{re.escape(alias)}\b', text_lower):
                matched_key = key
                break
                
        if matched_key:
            # It contains a known alias word. Let's make sure it doesn't contain obvious non-heading words.
            # E.g. dates, companies, job titles.
            # A simple rule: if it contains '|', '-', or dates, it's a job/education entry, not a heading.
            if re.search(r'\d{4}|[-|–—•·▪\u2013\u2014\ufffd]', text):
                return None
                
            # If it's a compound like "Certifications & Licenses", it's fine.
            return matched_key

    return None


def _split_embedded_headings(blocks: list[Block], body_font_size: float) -> list[Block]:
    """
    Splits blocks where a section heading and its content were merged by the PDF
    extractor into a single Block (e.g., "PROFESSIONAL SUMMARY Senior Full-Stack...").
    """
    new_blocks = []
    for block in blocks:
        if _is_section_heading(block, body_font_size):
            new_blocks.append(block)
            continue
            
        if not block.spans:
            new_blocks.append(block)
            continue
            
        first_span = block.spans[0]
        # Check if the first span alone forms a section heading
        temp_block = Block(
            block_no=block.block_no,
            bbox=first_span.bbox,
            spans=[first_span],
            region=block.region
        )
        heading_key = _is_section_heading(temp_block, body_font_size)
        
        if heading_key:
            # Found an embedded heading -- split the block
            new_blocks.append(temp_block)
            
            remaining_spans = block.spans[1:]
            if remaining_spans:
                x0 = min(s.x0 for s in remaining_spans if s.text.strip())
                y0 = min(s.y0 for s in remaining_spans if s.text.strip())
                x1 = max(s.x1 for s in remaining_spans if s.text.strip())
                y1 = max(s.y1 for s in remaining_spans if s.text.strip())
                
                content_block = Block(
                    block_no=block.block_no,
                    bbox=(x0, y0, x1, y1),
                    spans=remaining_spans,
                    region=block.region
                )
                new_blocks.append(content_block)
        else:
            new_blocks.append(block)
            
    return new_blocks


def _extract_sections(ordered_blocks: list[Block], body_font_size: float) -> dict:
    """
    Walk ordered blocks, detect section headings, assign content lines.
    Returns dict: section_key -> list of text lines.

    Content is assigned spatially: each block's content goes to the current
    active section in the SAME column region. This prevents right-column content
    from contaminating left-column sections when they share similar y-coordinates.
    """
    sections: dict[str, list[str]] = {}

    # Track current section per region
    current_section: dict[str, str] = {
        "header": "header",
        "left": "header",
        "right": "header",
        "body": "header",
    }

    for block in ordered_blocks:
        region = block.region
        heading_key = _is_section_heading(block, body_font_size)

        if heading_key:
            current_section[region] = heading_key
            continue

        # This block is content -- assign to current section of its region
        block_text = block.text.strip()
        if not block_text:
            continue

        sec_key = current_section[region]
        if sec_key not in sections:
            sections[sec_key] = []

        # Add each span's text as a separate line to preserve sub-structure
        lines = [s.text.strip() for s in block.spans if s.text.strip()]
        sections[sec_key].extend(lines)

    return sections


# ---------------------------------------------------------------------------
# Personal details extraction
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-.]?)?"
    r"(?:\(?\d{2,4}\)?[\s\-.]?)?"
    r"\d{3,4}[\s\-.]?\d{3,4}"
)
_GITHUB_TEXT_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/[A-Za-z0-9_\-./]+"
)
_LINKEDIN_TEXT_RE = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Za-z0-9_\-./]+"
)


def _guess_name_from_text(full_text: str) -> tuple:
    """
    Heuristic: scan the first several non-empty lines for a name-like line.
    Accepts 2-6 word lines where most tokens look like name parts
    (allow single-letter initials, hyphens, periods). Returns (name, conf).
    Called as a fallback inside _extract_personal when layout-based name
    detection finds nothing.
    """
    if not full_text:
        return "", 0.0

    for line in full_text.splitlines()[:12]:
        line = line.strip()
        if not line:
            continue
        # Skip obvious contact lines
        low = line.lower()
        if "@" in line or "github" in low or "linkedin" in low or ".com" in low or "+" in line:
            continue
        parts = [w for w in line.split() if w]
        if not (2 <= len(parts) <= 6):
            continue
        name_like = [w for w in parts if re.match(r"^[A-Za-z][A-Za-z\.\-']*$", w)]
        if len(name_like) >= max(1, len(parts) - 1):
            return line, 0.55
    return "", 0.0


def _extract_personal(
    header_blocks: list[Block],
    links: list[str],
    sections: dict,
) -> dict:
    """
    Extract name, email, phone, github, linkedin from header blocks and full text.
    """
    all_lines: list[str] = []
    for sec_lines in sections.values():
        all_lines.extend(sec_lines)
    header_text_lines = [b.text for b in header_blocks]
    full_text = "\n".join(header_text_lines + all_lines)

    name, name_confidence = _detect_name(header_blocks, sections)
    # If layout-based detection failed, try a text-based fallback over the
    # full document text (scans the top lines for a name-like line). This
    # catches resumes where header blocks weren't recognized by layout logic.
    if not name and name_confidence == 0.0:
        fallback_name, fallback_conf = _guess_name_from_text(full_text)
        if fallback_name:
            name, name_confidence = fallback_name, fallback_conf
    email = _find_email(full_text)
    phone = _find_phone(full_text)
    github = _find_github(links, full_text)
    linkedin = _find_linkedin(links, full_text)

    return {
        "name": name or "Unknown Candidate",
        "name_confidence": name_confidence,
        "email": email,
        "phone": phone,
        "github": github,
        "linkedin": linkedin,
    }



def _detect_name(header_blocks: list[Block], sections: dict) -> tuple:
    """
    Detect candidate name using layout-first signals.

    Priority:
    1. Largest-font block in header region, NOT a known section heading
    2. ALL-CAPS / Title-case block with heading typography

    Returns (name, confidence) where confidence in [0.0, 1.0].
    """
    if not header_blocks:
        return "", 0.0

    candidates = []
    for block in sorted(header_blocks, key=lambda b: b.dominant_font_size, reverse=True):
        text = block.text.strip()
        if not text:
            continue

        text_lower = text.lower()

        # Exclude known section headings
        if text_lower in KNOWN_SECTION_HEADINGS:
            continue

        # Exclude contact info patterns
        if _EMAIL_RE.search(text):
            continue
        if _PHONE_RE.search(text) and len(text) < 25:
            continue
        if any(kw in text_lower for kw in ("http", "www.", ".com", "linkedin", "github", "portfolio")):
            continue
        if re.search(r"\d{4}", text):  # contains year -- probably a date
            continue

        words = text.split()
        if not (2 <= len(words) <= 6):
            continue

        # Check that most words are alpha (name-like)
        alpha_words = [w for w in words if re.match(r"^[A-Za-z]+$", w)]
        if len(alpha_words) < len(words) - 1:
            continue

        # Score this candidate
        size = block.dominant_font_size
        score = 0.0

        # Larger font -> higher confidence
        score += min(size / 30.0, 1.0) * 0.5

        # Bold or all-caps
        if block.is_bold or text.isupper():
            score += 0.2

        # Is in header region (near top of page)
        score += 0.2

        # Name-like character pattern (purely alphabetic + spaces)
        if re.match(r"^[A-Za-z ]+$", text):
            score += 0.1

        candidates.append((text, score))

    # Fallback: if no block passed (because name is merged with contact info),
    # evaluate the very first span of the first header block.
    if not candidates and header_blocks:
        first_block = header_blocks[0]
        if first_block.spans:
            first_span = first_block.spans[0]
            text = first_span.text.strip()
            words = text.split()
            if 2 <= len(words) <= 5 and re.match(r"^[A-Za-z ]+$", text):
                candidates.append((text, 0.5))

    # Additional robust fallback: scan header block text lines for a name-like
    # line (useful when contact line(s) precede the name or fonts aren't
    # sufficiently larger than body text). Accept short initials and hyphenated
    # parts. Return immediately with a conservative confidence.
    if not candidates and header_blocks:
        for b in header_blocks:
            line = b.text.strip()
            if not line:
                continue
            parts = [w for w in line.split() if w]
            if not (2 <= len(parts) <= 6):
                continue
            # Count words that look name-like (allow single-letter initials)
            name_like = [w for w in parts if re.match(r"^[A-Za-z][A-Za-z\.\-']*$", w)]
            if len(name_like) >= max(1, len(parts) - 1):
                # Found a plausible name line — return as fallback
                return line, 0.6

    if not candidates:
        return "", 0.0

    candidates.sort(key=lambda x: x[1], reverse=True)
    best_name, best_score = candidates[0]
    return best_name, round(min(best_score, 1.0), 2)


def _find_email(text: str) -> Optional[str]:
    m = _EMAIL_RE.search(text)
    return m.group(0) if m else None


def _find_phone(text: str) -> Optional[str]:
    for m in _PHONE_RE.finditer(text):
        raw = m.group(0)
        digits = re.sub(r"\D", "", raw)
        if 7 <= len(digits) <= 15:
            return raw.strip()
    return None


def _find_github(links: list[str], text: str) -> Optional[str]:
    for link in links:
        if "github.com" in link.lower():
            return _normalize_url(link)
    m = _GITHUB_TEXT_RE.search(text)
    if m:
        return _normalize_url(m.group(0))
    return None


def _find_linkedin(links: list[str], text: str) -> Optional[str]:
    for link in links:
        if "linkedin.com" in link.lower():
            return _normalize_url(link)
    m = _LINKEDIN_TEXT_RE.search(text)
    if m:
        return _normalize_url(m.group(0))
    return None


def _normalize_url(url: str) -> str:
    url = url.strip().rstrip("/")
    if not url.startswith("http"):
        url = "https://" + url
    return url


# ---------------------------------------------------------------------------
# Fallback / utility
# ---------------------------------------------------------------------------

def _empty_document(links: list[str]) -> LayoutDocument:
    return LayoutDocument(
        page_count=0,
        page_width=595.0,
        page_height=842.0,
        links=links,
        header_blocks=[],
        ordered_blocks=[],
        sections={},
        personal={
            "name": "Unknown Candidate",
            "name_confidence": 0.0,
            "email": None,
            "phone": None,
            "github": None,
            "linkedin": None,
        },
        column_boundary=None,
        is_multi_column=False,
        body_font_size=10.0,
        extraction_quality={
            "sections_detected": 0,
            "sections_parsed": 0,
            "blocks_total": 0,
            "blocks_assigned": 0,
        },
    )


def get_full_text(doc: LayoutDocument) -> str:
    """Return all text in correct reading order as a single string."""
    lines = []
    for block in doc.ordered_blocks:
        for span in block.spans:
            if span.text.strip():
                lines.append(span.text.strip())
    return "\n".join(lines)
