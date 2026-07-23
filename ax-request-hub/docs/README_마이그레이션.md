# AX Hub v3 마이그레이션 절차

> architecture_v3_통합본.md §15·§20 로드맵 1단계 실행 가이드
> 원칙: **레거시 모델(Agent/AgentKpiRecord)은 데이터 이관·검증이 끝난 뒤에만 삭제한다** (2단계 마이그레이션).

## 파일 구성

| 파일 | 용도 | 배치 위치 |
|------|------|-----------|
| `prisma_v3_additions.prisma` | schema.prisma 병합용 추가분 (enum 7종 + 모델 7종) | 내용을 `prisma/schema.prisma`에 병합 |
| `migrate-agents-v3.ts` | 레거시 Agent → AgentRegistry 통합 이관 + 소급 승인 + 무결성 검증 | `scripts/` |
| `seed-data-assets.ts` | 데이터 카탈로그 샘플 시드 10건 | `scripts/` |

## 절차

### 0. 백업 (필수)

```powershell
Copy-Item prisma/dev.db prisma/dev.db.bak-v3-$(Get-Date -Format yyyyMMdd-HHmm)
```

### 1. 스키마 병합 — 마이그레이션 A

`prisma_v3_additions.prisma`의 내용을 `prisma/schema.prisma`에 병합한다.

- **Agent / AgentKpiRecord는 아직 삭제하지 않는다.**
- 기존 `AgentRegistry`는 정의를 교체하지 말고 **신규 필드만 추가** (phase, devStage, prodStatus, pilotKpiTarget, prodKpiTarget, retireFlag, lastUsedAt, productionAt, retiredAt + scores/councilItems 관계).
- `Project`에 `dataRequests DataRequest[]` 1줄 추가.
- `Employee.role`에 `DATA_PLATFORM` 값 추가.
- `AgentArtifact`·`AgentKnowledgeExtract`가 기존에 `Agent`를 참조했다면, 이관 단계에서는 그대로 두고 4단계에서 `AgentRegistry` 참조로 전환한다.

```powershell
npx prisma migrate dev --name v3_dual_lifecycle_data
```

### 2. 데이터 이관

먼저 스크립트 상단 `FIELD_MAP`을 실제 스키마 필드명에 맞춘다 (Gate 진행도 필드, 레거시 status 필드, KPI 목표 필드). 그다음 드라이런으로 검증:

```powershell
$env:DRY_RUN="1"; npx tsx scripts/migrate-agents-v3.ts
```

건수·스킵 목록이 예상과 맞으면 실제 실행:

```powershell
Remove-Item Env:DRY_RUN; npx tsx scripts/migrate-agents-v3.ts
```

스크립트가 수행하는 것:

1. 기존 AgentRegistry 전건 → `phase=DEVELOPMENT` + devStage 매핑 (GATE1 대기 7 / GATE2 통과 11 / GATE3 통과 1 → 그대로 이관)
2. 레거시 Agent 전건 → 이름 매칭으로 AgentRegistry 통합 (ACTIVE/SUSPENDED/DEPRECATED → phase=PRODUCTION, RETIRED → phase=CLOSED)
3. 상용 이관 건에 **제0차 소급 승인** CouncilMeeting/AgendaItem 생성 — 무결성 제약(상용 ⇒ 승인 의결 존재) 충족. ⚠️ 차기 정기 협의회에서 일괄 추인 안건으로 보고할 것.
4. AgentKpiRecord → AgentScore(phase=PRODUCTION) 이관
5. 무결성 3종 자동 검증 — **하나라도 0이 아니면 4단계 진행 금지**

### 3. 시드 및 화면 확인

```powershell
npx tsx scripts/seed-data-assets.ts
```

- `/registry` 개발중/상용 탭에서 이관 건수 확인
- `/data/catalog`에서 샘플 자산 10건 확인
- `/governance`에서 소급 승인 AuditLog 확인 (AuditLog 기록 로직 연결 후)

### 4. 레거시 모델 제거 — 마이그레이션 B

2단계 무결성 검증 통과 후에만:

1. `schema.prisma`에서 `Agent`, `AgentKpiRecord` 모델 삭제
2. `AgentArtifact`·`AgentKnowledgeExtract`의 참조를 `AgentRegistry`로 전환 (이관 시 저장한 `packageMeta.legacyAgentId` ↔ 신규 id 매핑 활용)
3. ```powershell
   npx prisma migrate dev --name v3_drop_legacy_agent
   ```

### 롤백

문제 발생 시 백업 복원 + 마이그레이션 폴더에서 v3 마이그레이션 2개 삭제:

```powershell
Copy-Item prisma/dev.db.bak-v3-* prisma/dev.db -Force
```

## 주의사항

- 이관 스크립트는 트랜잭션 단위(에이전트별)로 반영되므로 중간 실패 시 부분 반영 상태가 될 수 있다 — 재실행 안전(idempotent)하게 작성되어 있으므로 원인 수정 후 그대로 재실행하면 된다.
- `FIELD_MAP`·관계명(`kpiRecords`)은 실제 스키마 확인 전 가정값이다. 실행 전 반드시 대조할 것.
- 시드의 카탈로그 10건은 시연용 — 데이터플랫폼팀의 실자산 목록 확보 후 교체.
