"""
거버넌스 벡터화 파이프라인 — Step 2
=====================================
docs/governance/**/*.md → OpenAI text-embedding-3-small → pgvector upsert

환경변수:
  OPENAI_API_KEY   OpenAI API 키
  DATABASE_URL     PostgreSQL DSN (pgvector 익스텐션 활성화 필요)

실행:
  python scripts/governance/embed_pipeline.py
"""

import json
import os
import sys
from pathlib import Path

# 로컬 governance 패키지 임포트
sys.path.insert(0, str(Path(__file__).parent))

from parser import parse_file, recompute_is_latest  # noqa: E402

import openai
import psycopg2
from psycopg2.extras import execute_values

EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536
BATCH_SIZE = 256  # OpenAI 단일 호출 최대 텍스트 수

REPO_ROOT = Path(__file__).parent.parent.parent
DOCS_DIR = REPO_ROOT / "docs" / "governance"


# ── 임베딩 ──────────────────────────────────────────────────────────

def embed_batch(client: openai.OpenAI, texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    resp.data.sort(key=lambda d: d.index)
    return [d.embedding for d in resp.data]


# ── DB upsert ───────────────────────────────────────────────────────

_UPSERT_SQL = """
INSERT INTO governance_chunks (
    chunk_id, doc_id, chapter, article_no, article_title,
    text, is_addendum, risk_level, references, version,
    is_latest, embedding
) VALUES %s
ON CONFLICT (chunk_id) DO UPDATE SET
    doc_id        = EXCLUDED.doc_id,
    chapter       = EXCLUDED.chapter,
    article_no    = EXCLUDED.article_no,
    article_title = EXCLUDED.article_title,
    text          = EXCLUDED.text,
    is_addendum   = EXCLUDED.is_addendum,
    risk_level    = EXCLUDED.risk_level,
    references    = EXCLUDED.references,
    version       = EXCLUDED.version,
    is_latest     = EXCLUDED.is_latest,
    embedding     = EXCLUDED.embedding
"""

_ROW_TEMPLATE = "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector)"


def upsert_chunks(conn, rows: list[dict]) -> None:
    records = [
        (
            r["chunk_id"],
            r["doc_id"],
            r["chapter"],
            r["article_no"],
            r["article_title"],
            r["text"],
            r["is_addendum"],
            r["risk_level"],
            json.dumps(r["references"], ensure_ascii=False),
            r["version"],
            r["is_latest"],
            # pgvector: '[0.1,0.2,...]' 문자열로 전달 후 ::vector 캐스트
            "[" + ",".join(str(v) for v in r["embedding"]) + "]",
        )
        for r in rows
    ]
    with conn.cursor() as cur:
        execute_values(cur, _UPSERT_SQL, records, template=_ROW_TEMPLATE)
    conn.commit()


# ── 파싱 ────────────────────────────────────────────────────────────

def collect_chunks(docs_dir: Path):
    """docs_dir/**/*.md 파싱 → (all_meta, all_chunks) 반환. UNKNOWN doc_id 제외."""
    all_meta, all_chunks = [], []

    for f in sorted(docs_dir.rglob("*.md")):
        try:
            meta, chunks = parse_file(f)
        except Exception as e:
            print(f"[SKIP] {f.relative_to(docs_dir)}: {e}", file=sys.stderr)
            continue

        if meta.doc_id == "UNKNOWN":
            print(f"[EXCLUDE] {f.relative_to(docs_dir)}: doc_id=UNKNOWN")
            continue

        all_meta.append(meta)
        all_chunks.extend(chunks)
        print(f"[PARSED] {meta.doc_id}  {meta.version}  ({len(chunks)} chunks)  {f.name}")

    return all_meta, all_chunks


# ── 메인 ────────────────────────────────────────────────────────────

def main() -> None:
    api_key = os.environ["OPENAI_API_KEY"]
    db_url = os.environ["DATABASE_URL"]

    print(f"=== 거버넌스 벡터화 파이프라인 ===")
    print(f"docs_dir : {DOCS_DIR}")
    print(f"model    : {EMBED_MODEL}")

    # 1. 파싱
    all_meta, all_chunks = collect_chunks(DOCS_DIR)
    print(f"\n파싱 완료 — 문서 {len(all_meta)}개 / 청크 {len(all_chunks)}개")

    if not all_chunks:
        print("적재할 청크가 없습니다. 종료.")
        return

    # 2. is_latest 재계산 (버전 그룹 내 최신본 플래그)
    recompute_is_latest(all_meta, all_chunks)

    # 3. 임베딩 (배치)
    client = openai.OpenAI(api_key=api_key)
    texts = [c.text for c in all_chunks]
    embeddings: list[list[float]] = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        vecs = embed_batch(client, batch)
        embeddings.extend(vecs)
        print(f"[EMBED] {min(i + BATCH_SIZE, len(texts))}/{len(texts)} 청크 완료")

    # 4. pgvector upsert
    rows = [
        {
            "chunk_id": c.chunk_id,
            "doc_id": c.doc_id,
            "chapter": c.chapter,
            "article_no": c.article_no,
            "article_title": c.article_title,
            "text": c.text,
            "is_addendum": c.is_addendum,
            "risk_level": c.risk_level.value if hasattr(c.risk_level, "value") else c.risk_level,
            "references": c.references,
            "version": c.version,
            "is_latest": c.is_latest,
            "embedding": emb,
        }
        for c, emb in zip(all_chunks, embeddings)
    ]

    conn = psycopg2.connect(db_url)
    try:
        upsert_chunks(conn, rows)
    finally:
        conn.close()

    print(f"\n완료: {len(rows)}개 청크 → governance_chunks upsert")


if __name__ == "__main__":
    main()
