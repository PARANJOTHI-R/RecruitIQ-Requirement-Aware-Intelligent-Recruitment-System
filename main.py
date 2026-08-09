from parser.textAndLinkSeperator import extract_pdf
from parser.personalDetailsExtraction import *

pdf = extract_pdf("D:/Development/ATS-Git_version/files/res2.pdf")

text = pdf["text"]

links = pdf["links"]

contact = {

    "name": extract_name(text),

    "email": extract_email(text),

    "phone": extract_phone(text),

    "github": extract_github(links),

    "linkedin": extract_linkedin(links)
}

print(contact)