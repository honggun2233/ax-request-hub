"""
거버넌스 문서 DB 메타데이터 시드 스크립트
- 기존 GovernanceDoc 전체 삭제 후 재삽입
- fileName = docs/ 기준 상대경로 (governance/full/... 형태)
"""
import sqlite3, os, sys
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'prisma', 'dev.db')

def cuid_like(n):
    import random, string
    chars = string.ascii_lowercase + string.digits
    return 'c' + ''.join(random.choices(chars, k=24))

NOW = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
APPROVED = '2026-01-01 00:00:00'

DOCS = [
    # (docId, fileName, type, level, title, version, securityLevel, status, description)
    # ── L1 규정 ──────────────────────────────────────────────────
    ('AX-REG-2026-001',
     'governance/full/AX-REGULATION-2026-001_AI운영규정_v4.0.md',
     '규정', 'L1',
     'AI 운영 규정 v4.0',
     'v4.0', 'G2', 'active',
     'AX Hub 전체 AI 운영의 최상위 규정. 거버넌스 원칙·범위·책임체계 정의'),
    ('AX-COM-2026-001',
     'governance/full/AX-COMMITTEE-2026-001_AI운영위원회규정_v1.2.md',
     '규정', 'L1',
     'AI 운영위원회 규정 v1.2',
     'v1.2', 'G2', 'active',
     'AI 운영위원회 구성·권한·의사결정 절차 정의'),
    # ── L2 지침·운영방안 ─────────────────────────────────────────
    ('AX-POL-2026-001',
     'governance/full/AX-POLICY-2026-001_AI운영지침_v6.5.md',
     '지침', 'L2',
     'AI 운영 지침 v6.5',
     'v6.5', 'G2', 'active',
     'AI 운영 정책의 세부 지침. 에이전트 운영·데이터 거버넌스·보안 기준 포함'),
    ('AX-STD-2026-001',
     'governance/full/AX-STANDARD-2026-001_AI운영기준_v1.1.md',
     '운영방안', 'L2',
     'AI 운영 기준 v1.1',
     'v1.1', 'G2', 'active',
     'AI 시스템 운영 표준·KPI·SLA 기준 정의'),
    # ── L3 가이드·매뉴얼 ─────────────────────────────────────────
    ('AX-MAN-2026-001',
     'governance/full/AX-MANUAL-2026-001_사용가이드라인.md',
     '매뉴얼', 'L3',
     'AI 활용 사용자 가이드라인',
     'v1.0', 'G1', 'active',
     '임직원 대상 AI 도구 사용 가이드라인'),
    ('AX-OPS-2026-001',
     'governance/operations/AI에이전트등록_운영가이드.md',
     '가이드라인', 'L3',
     'AI 에이전트 등록 운영가이드',
     'v1.0', 'G2', 'active',
     'AX Hub 에이전트 등록·라이프사이클 관리 절차'),
    ('AX-OPS-2026-002',
     'governance/operations/AX_AI도구계정_관리운영가이드.md',
     '가이드라인', 'L3',
     'AI 도구 계정 관리 운영가이드',
     'v1.0', 'G2', 'active',
     'AI 도구 계정 발급·권한관리·폐기 절차'),
    ('AX-OPS-2026-003',
     'governance/operations/생성형AI모델배분_운영가이드.md',
     '가이드라인', 'L3',
     '생성형 AI 모델 배분 운영가이드',
     'v1.0', 'G2', 'active',
     '생성형 AI 모델 선택·토큰 배분·비용 관리 절차'),
    ('AX-STD-2026-002',
     'governance/operations/AX_AI리터러시레벨_운영기준.md',
     '운영방안', 'L3',
     'AI 리터러시 레벨 운영기준',
     'v1.0', 'G2', 'active',
     '임직원 AI 역량 레벨 체계·평가 기준 정의'),
    ('AX-STD-2026-003',
     'governance/operations/AX_스킬라이브러리_운영기준.md',
     '운영방안', 'L3',
     'AX 스킬 라이브러리 운영기준',
     'v1.0', 'G2', 'active',
     'AI 스킬 등록·버전관리·배포 운영 기준'),
    ('AX-STD-2026-004',
     'governance/operations/AX_토큰정책_운영기준.md',
     '운영방안', 'L3',
     'AX 토큰 정책 운영기준',
     'v1.0', 'G2', 'active',
     'LLM 토큰 사용 한도·비용 배분·모니터링 정책'),
    ('AX-DEV-2026-001',
     'governance/operations/AX_AI개발플로우_추가조항.md',
     '개발표준', 'L3',
     'AI 개발 플로우 추가 조항',
     'v1.0', 'G2', 'active',
     'AI 과제 개발 절차의 추가 조항·예외처리 기준'),
    ('AX-DEV-2026-002',
     'governance/operations/AX_개발표준_전사AI과제용.md',
     '개발표준', 'L3',
     '전사 AI 과제 개발 표준',
     'v1.0', 'G2', 'active',
     '전사 AI 과제에 적용되는 개발 코드·문서·테스트 표준'),
]

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# 기존 레코드 전체 삭제
cur.execute('DELETE FROM GovernanceDoc')
print(f'기존 레코드 삭제 완료')

# 새 레코드 삽입
inserted = 0
for (doc_id, file_name, dtype, level, title, version, sec_level, status, desc) in DOCS:
    record_id = cuid_like(0)
    cur.execute('''
        INSERT INTO GovernanceDoc (
            id, docId, fileName, type, level, title, version,
            author, approvedBy, approvedAt, securityLevel, status,
            description, relatedDocs, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        record_id, doc_id, file_name, dtype, level, title, version,
        'AX팀', 'AX 운영위원회', APPROVED, sec_level, status,
        desc, '[]', NOW, NOW
    ))
    print(f'  [{doc_id}] {title}')
    inserted += 1

conn.commit()
conn.close()
print(f'\n총 {inserted}개 문서 메타데이터 등록 완료')
