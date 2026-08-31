"""
거버넌스 Q&A 검색 서버 — FastAPI, 포트 8700
=============================================
sentence-transformers 로 query 임베딩 후 pgvector cosine 검색.
Next.js /api/governance/search 가 이 서버에 HTTP 프록시.

실행:
  uvicorn scripts.governance.search_server:app --port 8700 --reload
  또는
  python scripts/governance/search_server.py

환경변수 (선택):
  DATABASE_URL  PostgreSQL DSN
                기본값: postgresql://axadmin:axpassword@localhost:5438/ax_governance
  PORT          서버 포트 (기본값: 8700)
"""

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

DEFAULT_DB_URL = "postgresql://axadmin:axpassword@localhost:5438/ax_governance"
EMBED_MODEL = "paraphrase-multilingual-mpnet-base-v2"
PORT = int(os.environ.get("PORT", 8700))

# ── 전역 상태 ────────────────────────────────────────────────────────

_model: Optional[SentenceTransformer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    print(f"[search_server] 모델 로드: {EMBED_MODEL}")
    _model = SentenceTransformer(EMBED_MODEL)
    print("[search_server] 준비 완료")
    yield
    _model = None


app = FastAPI(title="Governance Search API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3005"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── 스키마 ───────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=50)
    is_latest: bool = True


class ChunkResult(BaseModel):
    chunk_id: str
    doc_id: str
    article_no: str
    article_title: str
    text: str
    risk_level: str
    similarity: float


class SearchResponse(BaseModel):
    chunks: list[ChunkResult]


# ── 검색 로직 ────────────────────────────────────────────────────────

_SEARCH_SQL = """
SELECT
    chunk_id,
    doc_id,
    article_no,
    article_title,
    text,
    risk_level,
    1 - (embedding <=> %s::vector) AS similarity
FROM governance_chunks
WHERE is_latest = %s
  AND embedding IS NOT NULL
ORDER BY embedding <=> %s::vector
LIMIT %s
"""


def _vec_str(vec: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in vec) + "]"


def search_chunks(query: str, top_k: int, is_latest: bool) -> list[ChunkResult]:
    db_url = os.environ.get("DATABASE_URL", DEFAULT_DB_URL)

    vec = _model.encode(query, normalize_embeddings=True).tolist()
    vec_s = _vec_str(vec)

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_SEARCH_SQL, (vec_s, is_latest, vec_s, top_k))
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        ChunkResult(
            chunk_id=r["chunk_id"],
            doc_id=r["doc_id"],
            article_no=r["article_no"],
            article_title=r["article_title"],
            text=r["text"],
            risk_level=r["risk_level"],
            similarity=float(r["similarity"]),
        )
        for r in rows
    ]


# ── 엔드포인트 ───────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": EMBED_MODEL}


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    if _model is None:
        raise HTTPException(status_code=503, detail="모델 초기화 중")
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query가 비어 있음")

    chunks = search_chunks(req.query, req.top_k, req.is_latest)
    return SearchResponse(chunks=chunks)


# ── 직접 실행 ────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("search_server:app", host="0.0.0.0", port=PORT, reload=False)
