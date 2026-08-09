import fitz

file=fitz.open("D:/Development/ATS-Git_version/files/res2.pdf")

output_txt=""

for page in file:
    output_txt+=page.get_text("text")
file.close()

with open("D:/Development/ATS-Git_version/output/output.txt", "w", encoding="utf-8") as f:
    f.write(output_txt)

print("Text extraction completed. The output has been saved to 'output.txt'.")
