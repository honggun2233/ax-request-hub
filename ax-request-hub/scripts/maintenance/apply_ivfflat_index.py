"""
governance_chunks IVFFlat 인덱스 적용 스크립트
- 포트 5438, ax_governance DB에 직접 실행
- 이미 존재하면 건너뜀
- lists=20 (203청크 기준 sqrt≈14, 향후 여유분 포함)
"""
import os
import sys
import psycopg2

PGVECTOR_URL = os.getenv(
    "GOVERNANCE_DB_URL",
    "postgresql://axadmin:axpassword@localhost:5438/ax_governance"
)


def main():
    conn = psycopg2.connect(PGVECTOR_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # 현재 청크 수 확인
    cur.execute("SELECT COUNT(*) FROM governance_chunks WHERE is_latest = TRUE;")
    count = cur.fetchone()[0]
    print(f"현재 governance_chunks (is_latest=true): {count}건")

    # 인덱스 존재 여부 확인
    cur.execute(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_gov_chunks_embedding';"
    )
    if cur.fetchone():
        print("[SKIP] idx_gov_chunks_embedding 이미 존재")
        cur.close()
        conn.close()
        return

    # IVFFlat 인덱스 생성 (ANALYZE 후 생성 권장)
    print(f"[INFO] IVFFlat 인덱스 생성 중... (lists=20)")
    cur.execute("ANALYZE governance_chunks;")
    cur.execute("""
        CREATE INDEX idx_gov_chunks_embedding
            ON governance_chunks USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 20);
    """)
    print("[OK]   idx_gov_chunks_embedding 생성 완료")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
