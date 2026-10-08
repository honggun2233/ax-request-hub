"""
LabAccess 만료 처리 배치
- 매일 1회 실행 권장 (Windows 작업스케줄러)
- expiresAt <= now() 이고 status=ACTIVE 인 LabAccess → EXPIRED
- 연결된 LabAllocation.revokedAt 도 함께 처리 (cascade)
- 실패 시 Telegram 알림
"""
import os
import sys
import requests
from datetime import datetime, timezone
import psycopg2

TG_TOKEN   = os.getenv("TELEGRAM_BOT_TOKEN", "8652632453:AAEELqRsPYreNdmjqwFHtocYwA5GorbaJp0")
TG_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "49017551")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://ax_hub_user:ax_hub_pass@127.0.0.1:5433/ax_hub"
)


def tg_alert(msg: str):
    try:
        requests.post(
            f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
            json={"chat_id": TG_CHAT_ID, "text": msg},
            timeout=10,
        )
    except Exception:
        pass


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    now = datetime.now(timezone.utc)

    # 만료 대상 조회
    cur.execute(
        """
        SELECT id FROM "LabAccess"
        WHERE status = 'ACTIVE'
          AND "expiresAt" IS NOT NULL
          AND "expiresAt" <= %s
        """,
        (now,),
    )
    rows = cur.fetchall()
    expired_ids = [r[0] for r in rows]

    if not expired_ids:
        print(f"[OK] 만료 대상 없음 ({now.strftime('%Y-%m-%d %H:%M')} 기준)")
        conn.close()
        return

    # LabAllocation cascade: revokedAt 처리
    cur.execute(
        """
        UPDATE "LabAllocation"
        SET "revokedAt" = %s, "updatedAt" = %s
        WHERE "labAccessId" = ANY(%s)
          AND "revokedAt" IS NULL
        """,
        (now, now, expired_ids),
    )
    allocation_count = cur.rowcount

    # LabAccess 상태 EXPIRED 로 전환
    cur.execute(
        """
        UPDATE "LabAccess"
        SET status = 'EXPIRED', "revokedAt" = %s, "updatedAt" = %s
        WHERE id = ANY(%s)
        """,
        (now, now, expired_ids),
    )
    access_count = cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    print(
        f"[OK] LabAccess {access_count}건 EXPIRED, "
        f"LabAllocation {allocation_count}건 revokedAt 처리"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        tg_alert(f"[AX Hub] ALERT: expire_lab_access failed - {e}")
        sys.exit(1)
