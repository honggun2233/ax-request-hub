"""
월별 GatewayCallLog 파티션 사전 생성 스크립트
- 매월 1일 실행 권장 (Windows 작업스케줄러)
- 3개월 앞 파티션을 미리 생성 (누락 방지)
- 이미 존재하는 파티션은 건너뜀
"""
import os
import sys
import requests
from datetime import date
from dateutil.relativedelta import relativedelta
import psycopg2

TG_TOKEN  = os.getenv("TELEGRAM_BOT_TOKEN", "8652632453:AAEELqRsPYreNdmjqwFHtocYwA5GorbaJp0")
TG_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "49017551")


def tg_alert(msg: str):
    try:
        requests.post(
            f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
            json={"chat_id": TG_CHAT_ID, "text": msg},
            timeout=10,
        )
    except Exception:
        pass

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://ax_hub_user:ax_hub_pass@127.0.0.1:5433/ax_hub"
)

MONTHS_AHEAD = 3


def partition_name(year: int, month: int) -> str:
    return f"GatewayCallLog_{year}_{month:02d}"


def create_partition_if_not_exists(cur, year: int, month: int):
    name = partition_name(year, month)
    start = date(year, month, 1)
    end = start + relativedelta(months=1)

    cur.execute(
        """
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = %s AND n.nspname = 'public'
        """,
        (name,),
    )
    if cur.fetchone():
        print(f"[SKIP] {name} 이미 존재")
        return

    sql = f"""
        CREATE TABLE "{name}" PARTITION OF "GatewayCallLog"
            FOR VALUES FROM ('{start.isoformat()}') TO ('{end.isoformat()}');
    """
    cur.execute(sql)
    print(f"[OK]   {name} 생성 완료 ({start} ~ {end})")


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    today = date.today()
    for i in range(MONTHS_AHEAD + 1):
        target = today + relativedelta(months=i)
        create_partition_if_not_exists(cur, target.year, target.month)

    conn.commit()
    cur.close()
    conn.close()
    print("완료")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        tg_alert(f"[AX Hub] ALERT: GatewayCallLog partition creation failed - {e}")
        sys.exit(1)
