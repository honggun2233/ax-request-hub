"""
10/1 최신 규정·지침 docx → AX Hub governance MD 변환 스크립트
실행: python scripts/governance/convert_docx_to_md.py
"""
import re
import sys
from pathlib import Path
from docx import Document

# 소스: 워크스페이스 최신 docx
SRC_DIR = Path("C:/Users/Samsung/.openclaw/workspace/docs/governance/2026-10-01")

# 대상: AX Hub governance 폴더
DST_ROOT = Path(__file__).parent.parent.parent / "docs" / "governance"

# 변환할 파일 매핑: (docx파일명, 저장경로, doc_id, 문서유형)
FILES = [
    ("50_규정_AI운영규정.docx",      "l1-규정/[규정]_AI운영규정_ax-reg-2026-001.md",       "AX-REG-2026-001",  "규정"),
    ("51_규정_AI위원회규정.docx",     "l1-규정/[규정]_AI위원회규정_ax-com-2026-001.md",      "AX-COM-2026-002",  "규정"),
    ("52_규정_AI위험관리규정.docx",   "l1-규정/[규정]_AI위험관리규정_ax-reg-2026-003.md",    "AX-REG-2026-003",  "규정"),
    ("60_지침_AI운영지침.docx",       "l2-지침/[지침]_AI운영지침_ax-pol-2026-001.md",        "AX-POL-2026-002",  "지침"),
    ("61_지침_AI위험관리지침.docx",   "l2-지침/[지침]_AI위험관리지침_ax-pol-2026-002.md",    "AX-POL-2026-003",  "지침"),
    ("30_데이터취급지침.docx",        "l2-지침/[지침]_데이터취급지침_ax-dat-2026-001.md",    "AX-DAT-2026-001",  "지침"),
    ("20_데이터관리규정.docx",        "l1-규정/[규정]_데이터관리규정_ax-dat-2026-002.md",    "AX-DAT-2026-002",  "규정"),
    ("AI운영가이드.docx",             "l3-가이드라인/[가이드라인]_AI운영가이드_ax-std-2026-007.md", "AX-STD-2026-007", "가이드라인"),
]

VERSION = "2.0"
REVISED_DATE = "2026-10-01"


def para_to_md(para) -> str:
    """단락 → 마크다운 변환 (파서 패턴 호환)"""
    style = para.style.name if para.style else ""
    text = para.text.strip()
    if not text:
        return ""

    if "Heading 1" in style or style == "제목 1":
        return f"# {text}"
    elif "Heading 2" in style or style == "제목 2":
        return f"## {text}"
    elif "Heading 3" in style or style == "제목 3":
        return f"### {text}"

    # 장(章) 헤더: "제 N 장 제목" → "## 제N장 제목"
    m_chapter = re.match(r"^제\s*(\d+)\s*장\s*(.+)$", text)
    if m_chapter:
        return f"## 제{m_chapter.group(1)}장 {m_chapter.group(2)}"

    # 조항 패턴 변환: "제 N조【제목】" or "제N조【제목】" → "**제N조 (제목)**"
    # 패턴 1: 제 N조의M【제목】
    m = re.match(r"^(제\s*\d+\s*조(?:의\s*\d+)?)\s*[【\[](.+?)[】\]](.*)$", text)
    if m:
        art = re.sub(r"\s+", "", m.group(1))   # 공백 제거
        title = m.group(2).strip()
        rest = m.group(3).strip()
        result = f"**{art} ({title})**"
        if rest:
            result += f"\n{rest}"
        return result

    # 패턴 2: 제 N조 (제목) — 이미 괄호 형식
    m2 = re.match(r"^(제\s*\d+\s*조(?:의\s*\d+)?)\s*\(([^)]+)\)(.*)$", text)
    if m2:
        art = re.sub(r"\s+", "", m2.group(1))
        title = m2.group(2).strip()
        rest = m2.group(3).strip()
        result = f"**{art} ({title})**"
        if rest:
            result += f"\n{rest}"
        return result

    # 항(項) 번호: ① ② → 들여쓰기 리스트
    if re.match(r"^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]", text):
        return f"  - {text}"

    # 호(號) 번호: 1. 2. → 리스트
    if re.match(r"^\d+\.", text):
        return f"- {text}"

    return text


def table_to_md(table) -> str:
    """표 → 마크다운 표 변환"""
    rows = []
    for i, row in enumerate(table.rows):
        cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
        rows.append("| " + " | ".join(cells) + " |")
        if i == 0:
            rows.append("| " + " | ".join(["---"] * len(cells)) + " |")
    return "\n".join(rows)


def docx_to_md(docx_path: Path, doc_id: str, doc_type: str, title: str) -> str:
    doc = Document(str(docx_path))
    lines = []

    # 헤더 메타데이터 (파서가 읽는 형식)
    lines.append(f"# {title}")
    lines.append("")
    lines.append("| 항목 | 내용 |")
    lines.append("| --- | --- |")
    lines.append(f"| 문서번호 | {doc_id} |")
    lines.append(f"| 버전 | {VERSION} |")
    lines.append(f"| 최종 개정일 | {REVISED_DATE} |")
    lines.append(f"| 적용범위 | 삼성자산운용 전 임직원 |")
    lines.append(f"| 담당부서 | AX팀 |")
    lines.append(f"| 근거 | 내부 AI 거버넌스 체계 |")
    lines.append("")
    lines.append("---")
    lines.append("")

    for block in doc.element.body:
        tag = block.tag.split("}")[-1]
        if tag == "p":
            from docx.oxml.ns import qn
            para_obj = None
            for p in doc.paragraphs:
                if p._element is block:
                    para_obj = p
                    break
            if para_obj:
                md = para_to_md(para_obj)
                if md:
                    lines.append(md)
        elif tag == "tbl":
            for t in doc.tables:
                if t._element is block:
                    lines.append("")
                    lines.append(table_to_md(t))
                    lines.append("")
                    break

    return "\n".join(lines)


def main():
    converted = []
    for docx_name, dst_rel, doc_id, doc_type in FILES:
        src = SRC_DIR / docx_name
        dst = DST_ROOT / dst_rel

        if not src.exists():
            print(f"  ⚠️  소스 없음: {src}")
            continue

        dst.parent.mkdir(parents=True, exist_ok=True)

        # 제목 추출 (파일명에서)
        title = docx_name.replace(".docx", "").replace("_", " ")
        title = re.sub(r"^\d+_", "", title)

        print(f"  변환 중: {docx_name} → {dst_rel}")
        md_content = docx_to_md(src, doc_id, doc_type, title)
        dst.write_text(md_content, encoding="utf-8")
        converted.append(dst_rel)
        print(f"  ✅ 완료: {len(md_content)} chars")

    print(f"\n총 {len(converted)}개 변환 완료")
    for f in converted:
        print(f"  - {f}")


if __name__ == "__main__":
    main()
