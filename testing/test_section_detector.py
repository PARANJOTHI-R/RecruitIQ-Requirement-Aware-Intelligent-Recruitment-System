from section_detector import SectionDetector

detector = SectionDetector()

tests = [
    "Technical Skills",
    "Core Competencies",
    "Professional Experience",
    "Academic Background",
    "Projects",
    "Awards",
    "Professional Summary",
    "Career Objective",
    "Internship",
    "Research Papers",
    "Technical Competencies"
]

for t in tests:
    print(detector.detect(t))