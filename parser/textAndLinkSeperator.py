import fitz


def extract_pdf(pdf_path):

    doc = fitz.open(pdf_path)

    text = ""
    links = []

    for page in doc:

        text += page.get_text()

        for link in page.get_links():

            if "uri" in link:
                links.append(link["uri"])

    doc.close()

    return {
        "text": text,
        "links": links
    }