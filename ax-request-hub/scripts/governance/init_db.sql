-- 거버넌스 벡터 DB 초기화 스크립트
-- 실행: psql $DATABASE_URL -f scripts/governance/init_db.sql
--       또는 python scripts/governance/init_db.py

-- pgvector 익스텐션 활성화 (superuser 권한 필요)
CREATE EXTENSION IF NOT EXISTS vector;

-- governance_chunks 테이블
-- embedding 차원: 768 (paraphrase-multilingual-mpnet-base-v2)
CREATE TABLE IF NOT EXISTS governance_chunks (
    chunk_id      TEXT        PRIMARY KEY,
    doc_id        TEXT        NOT NULL,
    chapter       TEXT,
    article_no    TEXT        NOT NULL,
    article_title TEXT        NOT NULL,
    text          TEXT        NOT NULL,
    is_addendum   BOOLEAN     NOT NULL DEFAULT FALSE,
    risk_level    TEXT        NOT NULL DEFAULT '해당없음',
    xrefs         TEXT        NOT NULL DEFAULT '[]',  -- JSON 배열 문자열 (references는 예약어)
    version       TEXT        NOT NULL,
    is_latest     BOOLEAN     NOT NULL DEFAULT TRUE,
    embedding     vector(768),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 검색 필터 인덱스
CREATE INDEX IF NOT EXISTS idx_gov_chunks_doc_latest
    ON governance_chunks (doc_id, is_latest);

-- 벡터 근사 검색 인덱스 (IVFFlat — 적재 후 생성 권장)
-- 청크 수가 1,000개를 넘으면 아래 주석 해제 후 실행
-- CREATE INDEX IF NOT EXISTS idx_gov_chunks_embedding
--     ON governance_chunks USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 50);
