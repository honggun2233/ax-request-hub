import sys
sys.stdout.reconfigure(encoding="utf-8")
from docx import Document

doc = Document("docs/AI_거버넌스_지침_v3_0.docx")

def get_style(name):
    for s in doc.styles:
        if s.name == name:
            return s
    return None

h1 = get_style("Heading 1")
h2 = get_style("Heading 2")
h3 = get_style("Heading 3")
li = get_style("List Paragraph")

def p(text, style=None):
    para = doc.add_paragraph(text)
    if style:
        para.style = style
    return para

new_paras = []
new_paras.append(p("9jang", h1))
new_paras.append(p("28jo", h2))
new_paras.append(p("body1"))
print("스타일 테스트 성공:", new_paras[0].style.name)