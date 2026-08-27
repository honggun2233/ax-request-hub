"""
거버넌스 문서 파서 — .md 원문 → DocumentMetadata + ArticleChunk[] 로 변환
====================================================================
실제 문서 2가지 조문 표기 패턴을 모두 지원:
  패턴 A: "**제12조 (제목)**"        (규정/지침/가이드라인 계열)
  패턴 B: "## 제 8 조 (제 목)"       (위원회규정 계열, 공백 포함)
장(章) 표기: "## 제N장 제목" — 없는 문서도 있음 (지침·가이드라인 다수)
"""

import re
from pathlib import Path
from schema import DocumentMetadata, ArticleChunk, DocType, ApprovalStatus, RiskLevel

# ── 정규식 ────────────────────────────────────────────────────

RE_H1_TITLE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
RE_HEADER_ROW = re.compile(r"\|\s*(문서번호|버전|최종 개정일|적용범위|담당부서|근거)\s*\|\s*(.+?)\s*\|")
RE_CHAPTER = re.compile(r"^##\s*(제\s*\d+\s*장.+)$", re.MULTILINE)
# 패턴 A: **제12조의2 (제목)**  /  패턴 B: ## 제 8 조 (제 목)
RE_ARTICLE = re.compile(
    r"(?:\*\*|##\s*)\s*(제\s*\d+\s*조(?:의\s*\d+)?)\s*\(([^)]*)\)\s*(?:\*\*)?",
)
RE_XREF = re.compile(r"제\s*\d+\s*조(?:의\s*\d+)?")

# ── L3(가이드라인/운영기준) 전용: "조" 형식이 아닌 마크다운 헤더 구조 ──
# "## 3. 등급별 최소 통제 요건" 또는 "## §3 에이전트 위험등급 분류" 형식
RE_SECTION = re.compile(r"^##\s*(?:(\d+)\.|§(\d+))\s*(.+?)\s*$", re.MULTILINE)
# 섹션 내부의 "### 고위험" / "### 중위험" / "### 저위험" 서브헤더
RE_RISK_SUBHEAD = re.compile(r"^###\s*(고위험|중위험|저위험)\s*$", re.MULTILINE)


def _norm(s: str) -> str:
    """'제 8 조' → '제8조' 처럼 공백 제거해 chunk_id·상호참조를 통일된 키로 만든다."""
    return re.sub(r"\s+", "", s)


def parse_header(text: str, file_path: str) -> DocumentMetadata:
    # "문서 이력" 표도 컬럼명이 "버전|일자|변경내용"으로 겹쳐 오탐을 일으키므로,
    # 최상단 헤더 표(첫 "---" 구분선 이전)만 스캔 대상으로 제한한다.
    header_block = text.split("\n---", 1)[0]
    fields = {k: v for k, v in RE_HEADER_ROW.findall(header_block)}
    doc_id = fields.get("문서번호", "UNKNOWN")

    # doc_name은 "문서번호" 필드값(=doc_id)이 아니라 H1(# 제목)에서 별도 추출한다.
    # [버그 수정] fields.get("문서번호", ...)를 쓰면 doc_name이 doc_id의 단순 복사본이 됨.
    h1_match = RE_H1_TITLE.search(text)
    doc_name = h1_match.group(1).strip() if h1_match else doc_id

    # 문서 유형은 doc_id 접두어로 판별 (REG/COM=규정, POL=지침, STANDARD=SSOT, 나머지=가이드라인)
    if doc_id.startswith("AX-REGULATION") or doc_id.startswith("AX-COM"):
        dtype = DocType.REGULATION
    elif doc_id.startswith("AX-POLICY"):
        dtype = DocType.POLICY
    elif doc_id.startswith("AX-STANDARD"):
        dtype = DocType.STANDARD
    else:
        dtype = DocType.GUIDELINE

    # 시행일 조항에서 승인 여부 판단 ("결재일부터" = 미승인 초안)
    approval = ApprovalStatus.DRAFT if "결재일부터" in text else ApprovalStatus.APPROVED

    # "근거" 필드에서 상위 참조 문서 추출 (「」 안의 문서명)
    based_on = re.findall(r"「([^」]+)」", fields.get("근거", ""))

    # SSOT 동기화 대상 여부: 본문에 "AI 운영기준" 또는 "STANDARD" 언급 시 후보로 표시
    sync_target = "AX-STANDARD-2026-001" if ("운영기준" in text and dtype != DocType.STANDARD) else None

    return DocumentMetadata(
        doc_id=doc_id,
        doc_name=doc_name,
        doc_type=dtype,
        version=fields.get("버전", ""),
        is_latest=True,  # 배치 시 doc_id 그룹 내 최신 버전만 True로 재계산 필요 — recompute_is_latest() 참조
        effective_date_note=fields.get("최종 개정일", ""),
        approval_status=approval,
        scope=fields.get("적용범위"),
        owner_dept=fields.get("담당부서"),
        based_on=based_on,
        sync_target=sync_target,
        file_path=file_path,
    )


def _strip_history_section(text: str) -> str:
    """
    [버그 수정] "## 문서 이력" 이하는 조문/섹션 파서에 들어가면 안 되는 노이즈다.
    지금까지는 parse_header()가 헤더 표만 분리했을 뿐, 이 뒷부분(문서 이력)이
    본문 파서에 그대로 흘러들어가 마지막 조/섹션 청크에 이력 텍스트가 섞였다.
    조문·섹션 파싱 직전에 반드시 이 함수를 거쳐 이력 섹션을 잘라낸다.
    """
    m = re.search(r"^##\s*문서\s*이력\s*$", text, re.MULTILINE)
    return text[:m.start()] if m else text


def parse_articles(text: str, doc_id: str, version: str) -> list[ArticleChunk]:
    """
    본문 조문과 부칙 조문은 번호 체계가 독립적으로 "제1조"부터 다시 시작하므로
    (예: 본문 제1조=목적, 부칙 제1조=시행일) 반드시 "## 부칙" 기준으로 먼저 분리한 뒤
    각각 파싱해야 chunk_id 충돌이 발생하지 않는다.
    """
    chunks: list[ArticleChunk] = []
    addendum_split = re.search(r"^##\s*부칙.*$", text, re.MULTILINE)
    main_text = text[:addendum_split.start()] if addendum_split else text
    addendum_text = text[addendum_split.start():] if addendum_split else ""

    chapters = [(m.start(), m.group(1).strip()) for m in RE_CHAPTER.finditer(main_text)]

    def _parse_block(block: str, is_addendum: bool):
        matches = list(RE_ARTICLE.finditer(block))
        for i, m in enumerate(matches):
            article_no = _norm(m.group(1))
            article_title = m.group(2).strip()
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(block)
            body = block[start:end].strip()

            chapter = None
            if not is_addendum:
                for pos, name in chapters:
                    if pos < m.start():
                        chapter = name
                    else:
                        break
            else:
                chapter = "부칙"

            refs = sorted({_norm(r) for r in RE_XREF.findall(body)})
            ns = "부칙-" if is_addendum else ""

            chunks.append(ArticleChunk(
                chunk_id=f"{doc_id}#{ns}{article_no}",
                doc_id=doc_id,
                chapter=chapter,
                article_no=article_no,
                article_title=article_title,
                text=body,
                is_addendum=is_addendum,
                references=refs,
                version=version,
            ))

    _parse_block(main_text, is_addendum=False)
    if addendum_text:
        _parse_block(addendum_text, is_addendum=True)
    return chunks


def parse_sections(text: str, doc_id: str, version: str) -> list[ArticleChunk]:
    """
    L3(가이드라인/운영기준) 전용 청커. "조" 형식이 없는 문서는 이 경로로 처리한다.
    섹션(## N. / ## §N) 단위로 자르되, 그 안에 "### 고위험/중위험/저위험" 서브헤더가
    있으면 위험등급별로 더 잘게 쪼갠다 — 3번(준수 체크)이 risk_level 정확 매칭을
    하려면 "등급별 최소 통제 요건" 같은 섹션이 등급 단위로 분리되어 있어야 한다.
    """
    chunks: list[ArticleChunk] = []
    matches = list(RE_SECTION.finditer(text))
    if not matches:
        return chunks  # 조 형식도 섹션 형식도 아니면 이번 스코프에서는 스킵 (후속 처리 필요 — 아래 안내 참조)

    risk_map = {"고위험": RiskLevel.HIGH, "중위험": RiskLevel.MEDIUM, "저위험": RiskLevel.LOW}

    for i, m in enumerate(matches):
        sec_no = m.group(1) or f"§{m.group(2)}"
        sec_title = m.group(3).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()

        risk_subs = list(RE_RISK_SUBHEAD.finditer(body))
        if not risk_subs:
            chunks.append(ArticleChunk(
                chunk_id=f"{doc_id}#섹션{sec_no}",
                doc_id=doc_id,
                chapter=None,
                article_no=f"섹션{sec_no}",
                article_title=sec_title,
                text=body,
                references=sorted({_norm(r) for r in RE_XREF.findall(body)}),
                version=version,
            ))
        else:
            # 위험등급 서브헤더 기준으로 추가 분리 — chunk_id에 등급명까지 포함해 고유성 보장
            for j, rm in enumerate(risk_subs):
                r_start = rm.end()
                r_end = risk_subs[j + 1].start() if j + 1 < len(risk_subs) else len(body)
                r_body = body[r_start:r_end].strip()
                r_label = rm.group(1)
                chunks.append(ArticleChunk(
                    chunk_id=f"{doc_id}#섹션{sec_no}-{r_label}",
                    doc_id=doc_id,
                    chapter=sec_title,
                    article_no=f"섹션{sec_no}",
                    article_title=f"{sec_title} - {r_label}",
                    text=r_body,
                    risk_level=risk_map[r_label],
                    references=sorted({_norm(r) for r in RE_XREF.findall(r_body)}),
                    version=version,
                ))
    return chunks


def parse_file(path: Path) -> tuple[DocumentMetadata, list[ArticleChunk]]:
    text = path.read_text(encoding="utf-8")
    meta = parse_header(text, str(path))
    body_text = _strip_history_section(text)  # [버그 수정] 이력 섹션 제외 후 본문 파서에 전달
    chunks = parse_articles(body_text, meta.doc_id, meta.version)
    if not chunks:
        # L1/L2(조 형식) 문서가 아니면 L3(섹션 형식) 파서로 폴백
        chunks = parse_sections(body_text, meta.doc_id, meta.version)
    return meta, chunks


def recompute_is_latest(all_meta: list[DocumentMetadata], all_chunks: list[ArticleChunk]) -> None:
    """
    [구조 이슈 반영] is_latest 재계산 스텝을 파이프라인에 명시적으로 위치시킨다.
    지금 스캔 대상(/mnt/project)은 doc_id당 파일이 1개뿐이라 이 스텝이 사실상 no-op이지만,
    운영 환경에서는 archive/prior-versions/ 같은 과거 버전 파일까지 함께 인덱싱하거나
    재임베딩 배치가 신·구 버전을 동시에 들고 있는 상황이 생길 수 있으므로,
    "적재 직전 마지막 단계"로 반드시 이 함수를 거치도록 고정한다.
    CI 훅(§3단계)의 재임베딩 스크립트 마지막 줄에서 호출.
    """
    def _version_key(v: str) -> tuple[int, ...]:
        nums = re.findall(r"\d+", v)
        return tuple(int(n) for n in nums) if nums else (0,)

    latest_version_by_doc: dict[str, str] = {}
    for m in all_meta:
        cur = latest_version_by_doc.get(m.doc_id)
        if cur is None or _version_key(m.version) > _version_key(cur):
            latest_version_by_doc[m.doc_id] = m.version

    for m in all_meta:
        m.is_latest = (m.version == latest_version_by_doc.get(m.doc_id))
    for c in all_chunks:
        c.is_latest = (c.version == latest_version_by_doc.get(c.doc_id))


if __name__ == "__main__":
    import json, dataclasses, sys

    project_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "/mnt/project")
    all_meta, all_chunks = [], []

    for f in sorted(project_dir.glob("*.md")):
        try:
            meta, chunks = parse_file(f)
        except Exception as e:
            print(f"[SKIP] {f.name}: {e}")
            continue

        if meta.doc_id == "UNKNOWN":
            # [버그 수정] 문서번호 필드가 없는 파일(작업용 diff·메모)은
            # 거버넌스 문서가 아니므로 적재 대상에서 제외한다.
            print(f"[EXCLUDE] {f.name}: doc_id=UNKNOWN — 거버넌스 문서 아님, 벡터DB 미적재")
            continue

        all_meta.append(meta)
        all_chunks.extend(chunks)
        print(f"[OK] {f.name} → doc_id={meta.doc_id}, doc_name={meta.doc_name}, "
              f"version={meta.version}, articles={len(chunks)}, approval={meta.approval_status.value}")

    # [구조 이슈 반영] 적재 직전 마지막 단계로 is_latest 재계산 고정
    recompute_is_latest(all_meta, all_chunks)

    out = {
        "documents": [dataclasses.asdict(m) for m in all_meta],
        "chunks": [dataclasses.asdict(c) for c in all_chunks],
    }
    Path("/home/claude/parsed_output.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    print(f"\n총 문서 {len(all_meta)}개 / 조문 청크 {len(all_chunks)}개 → parsed_output.json 저장")
