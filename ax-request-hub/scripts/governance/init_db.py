"""
governance_chunks 테이블 초기화 헬퍼
=====================================
init_db.sql 을 읽어 PostgreSQL에 실행한다.

실행:
  python scripts/governance/init_db.py
  DATABASE_URL=postgresql://... python scripts/governance/init_db.py
"""

import os
import sys
from pathlib import Path

import psycopg2

DEFAULT_DB_URL = "postgresql://axadmin:axpassword@localhost:5438/ax_governance"
SQL_FILE = Path(__file__).parent / "init_db.sql"


def main() -> None:
    db_url = os.environ.get("DATABASE_URL", DEFAULT_DB_URL)
    print(f"[init_db] DB: {db_url}")
    print(f"[init_db] SQL: {SQL_FILE}\n")

    sql = SQL_FILE.read_text(encoding="utf-8")

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print("[init_db] 완료: governance_chunks 테이블 준비됨")
    except Exception as e:
        conn.rollback()
        print(f"[init_db] 오류: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
