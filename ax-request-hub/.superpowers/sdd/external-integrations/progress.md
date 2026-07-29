# SDD ledger — plan: .superpowers/sdd/external-integrations/plan.md

브랜치: feat/external-integrations
워크트리: /c/project/_cto/ax-hub/ax-request-hub/
시작: 2026-07-29

## Task 1: WS-A Snowflake 카탈로그 연동
- 커밋: 9eddaf0..c2a04f7
- 리뷰: 스펙 ✅ / 품질 Important 2건
  - [Important] lib/snowflake.ts conn.destroy() 미호출 — 리소스 누수
  - [Important] 첫 번째 마이그레이션에 타 테이블 DDL 혼입
  - [Minor-park] response에 ok 필드 없음 (syncedAt 추가는 유용, 허용)
  - [Minor-park] 순차 upsert (수동 동기화 용도상 허용)
- Task 1: fix round 1/5 진입

