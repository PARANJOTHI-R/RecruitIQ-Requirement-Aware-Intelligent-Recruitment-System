from collections import defaultdict

from parser.section_detector import SectionDetector


class SectionParser:

    def __init__(self):

        self.detector = SectionDetector()

    def segment(self, text):

        sections = defaultdict(list)

        current_section = "header"

        lines = text.splitlines()

        for line in lines:

            line = line.strip()

            if not line:
                continue

            heading = self.detector.detect(line)

            if heading:

                current_section = heading["section"]

                continue

            sections[current_section].append(line)

        return dict(sections)