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
- Task 1: fix round 1/5 (2 addressed, 0 open; commits c2a04f7..39fd2d7)
- Task 1: complete (commits 9eddaf0..39fd2d7, 2 minor parked)

## Task 2: WS-B LLM Usage 배치 수집
- 커밋: 39fd2d7..076b041
- 리뷰: 스펙 ✅ / 품질 Critical 1건, Important 1건
  - [Critical] tokenUsed SET 오류 → increment 필요
  - [Important] toDayBounds() UTC 미고정
  - [Minor-park] OPENAI_API_KEY placeholder
  - [Minor-park] $disconnect() 에러 경로
- Task 2: fix round 1/5 (2 addressed, 0 open; commits 076b041..e19b250)
- Task 2: complete (commits 39fd2d7..e19b250, 2 minor parked)

## Task 3: WS-C Knox 알림 연동
- 커밋: e19b250..7cda8e6 (구현), 6d497a6 (fix)
- 리뷰: 스펙 ✅ (7/7) / 품질 Important 1건
  - [Important] .env.example KNOX_API_ENDPOINT 경로 중복 → 직접 수정 완료 (6d497a6)
  - [Minor-park] 레거시 시그니처 Knox 미적용 (브리프 범위 내)
  - [Minor-park] Knox 재시도 없음 (허용)
- Task 3: complete (commits e19b250..6d497a6, review clean after fix)

## Task 4: WS-D PostgreSQL 전환 + 온프레미스 배포
- 커밋: 6d497a6..4a29bab
- 리뷰: 스펙 ✅ (7/7) / 품질 Important 2건
  - [Important] standalone 빌드 후 static 파일 복사 누락 (deploy.sh + deployment.md)
  - [Important] PM2 첫 실행 fallback이 ecosystem.config.js 우회
  - [Minor-park] deploy.sh CRLF (.gitattributes 권고)
  - [Minor-park] Nginx SSL 인증서 경로 누락
- Task 4: fix round 1/5 (4 addressed, 0 open; commits 4a29bab..20e76e4)
- Task 4: complete (commits 6d497a6..20e76e4, review clean after fix)

## 최종 브랜치 리뷰
