from ai_pipeline.parser.normalizer import normalize_text

with open("output.txt", "r", encoding="utf8") as f:
    raw = f.read()

clean = normalize_text(raw)

with open("normalized.txt", "w", encoding="utf8") as f:
    f.write(clean)