from normalizer import normalize_text
from section_parser import SectionParser


with open("output.txt", encoding="utf8") as f:
    raw = f.read()

text = normalize_text(raw)

parser = SectionParser()

sections = parser.segment(text)

for section, content in sections.items():

    print("=" * 60)

    print(section.upper())

    print("=" * 60)

    for line in content:

        print(line)