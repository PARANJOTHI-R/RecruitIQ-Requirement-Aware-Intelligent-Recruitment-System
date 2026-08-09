import spacy
from spacy.matcher import PhraseMatcher
from rapidfuzz import fuzz


class SectionDetector:

    FUZZY_THRESHOLD = 85

    def __init__(self):

        self.nlp = spacy.load("en_core_web_sm")

        self.matcher = PhraseMatcher(
            self.nlp.vocab,
            attr="LOWER"
        )

        self.SECTIONS = {

            "summary": [
                "summary",
                "professional summary",
                "profile",
                "career objective",
                "objective",
                "about me"
            ],

            "skills": [
                "skills",
                "technical skills",
                "technical expertise",
                "core skills",
                "core competencies",
                "competencies",
                "technology stack",
                "tech stack",
                "programming languages",
                "technologies",
                "tools",
                "frameworks"
            ],

            "education": [
                "education",
                "academic background",
                "academic qualifications",
                "qualifications",
                "education details"
            ],

            "experience": [
                "experience",
                "work experience",
                "professional experience",
                "employment",
                "employment history",
                "career history"
            ],

            "projects": [
                "projects",
                "project",
                "project experience",
                "academic projects",
                "personal projects",
                "major projects",
                "minor projects"
            ],

            "certifications": [
                "certifications",
                "certificates",
                "licenses",
                "professional certifications"
            ],

            "achievements": [
                "achievements",
                "awards",
                "honors",
                "accomplishments"
            ],

            "internships": [
                "internships",
                "internship",
                "industrial training"
            ],

            "publications": [
                "publications",
                "research",
                "research papers"
            ]
        }

        self.register_patterns()

    def register_patterns(self):

        for section, phrases in self.SECTIONS.items():

            patterns = [self.nlp.make_doc(p) for p in phrases]

            self.matcher.add(section, patterns)

    def phrase_match(self, line):

        doc = self.nlp.make_doc(line)

        matches = self.matcher(doc)

        if not matches:
            return None

        match_id, start, end = matches[0]

        return {
            "section": self.nlp.vocab.strings[match_id],
            "confidence": 100,
            "method": "phrase_match"
        }

    def fuzzy_match(self, line):

        line = line.lower().strip()

        best_section = None
        best_score = 0

        for section, phrases in self.SECTIONS.items():

            for phrase in phrases:

                score = fuzz.token_sort_ratio(
                    line,
                    phrase.lower()
                )

                if score > best_score:

                    best_score = score
                    best_section = section

        if best_score >= self.FUZZY_THRESHOLD:

            return {
                "section": best_section,
                "confidence": best_score,
                "method": "fuzzy_match"
            }

        return None

    def detect(self, line):

        line = line.strip()

        if not line:
            return None

        # Headings are usually short
        if len(line.split()) > 6:
            return None

        result = self.phrase_match(line)

        if result:
            return result

        return self.fuzzy_match(line)