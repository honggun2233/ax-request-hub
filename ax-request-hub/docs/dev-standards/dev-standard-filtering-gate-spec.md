# 개발 표준 → 필터링 게이트 구축 — 트랙별 스펙

> 작성: Claude AI / 2026-09-05 (v5 갱신: 2026-09-07)
> 원칙: "공통화 안 되어 있으면 필터링" — 기존 GATE2 데이터 하드블록·Policy Gateway fail-closed와 동일한 설계 철학 적용
> 확인: GATE1→GATE2 전환 로직(`app/api/registry/route.ts`)에 `techStandardsPassed` 체크가 현재 전혀 없음 — 검증 함수는 있지만 아무것도 막지 않는 상태

---

## 넘기기 전 확인 사항 (CTO 디스패치 시 함께 전달)

| # | 항목 | 상태 |
|---|---|---|
| 1 | **B-0 긴급 배포 필요** | 운영 DB 조회 결과 `syncGap` **3건 확인**(전체 35개 중) — 위원회 정식 승인을 받고도 Policy Gateway에서 차단되어 **현재 사용자에게 열리지 않는 에이전트가 3개 존재**. 트랙 A 완료를 기다리지 말고 **B-0을 단독 PR로 즉시 착수** |
| 2 | **B-4 소급 방침 — 확정됨** | 옵션 B(시행일 기준). 옆문 통과 **0건** 확인으로 소급 재점검 과제 불필요. 상세는 아래 B-4 참조 |
| 3 | **B-0 → B-1b는 별도 PR, 순차 배포** | 같은 PR에 묶으면 배포 시점이 같아져 순서 보장이 안 됨. 아래 "PR 분리 원칙" 참조 |

---

## 트랙 A — 배선 (스키마 무관, 1~2일)

기존에 이미 만들어져 있는데 연결만 안 된 것들을 잇는 작업. 신규 로직 없음.

| # | 작업 | 대상 파일 |
|---|---|---|
| A-1 | `/projects/new`(실제 등록 경로)에 기술표준 6항목 입력 단계 추가 | `app/projects/new/page.tsx` — AI 신청서 합성 후, 제출 전 마지막 단계로 체크리스트 삽입 |
| A-2 | 미달 시 "제언" 화면 연결 | `ScoreCard.tsx`를 `/me/projects` 과제 상세 또는 카드에 실제로 import — 이미 미달 항목 표시 로직은 완성돼 있음, import만 하면 됨 |
| A-3 | AX팀 검토 화면 연결 | `gate2-checklist.tsx`를 `/registry/[id]` 상세 페이지에 실제로 import — PATCH API(`/api/projects/[id]/gate2`)는 이미 완성, UI만 연결 |
| A-4 | 문서-코드 항목 수 일치 | **개발 트랙 아님 — 거버넌스 문서 개정 사안.** `AI-STD-2026-006`은 결재선을 타야 하는 문서라 Jarvis에게 개발 지시로 넘길 항목이 아님. "코드가 이미 더 엄격하니 문서를 코드에 맞춘다"는 방향성 제안까지만 하고, 실제 개정은 인표님/AX팀 결재 절차로 별도 진행 |

**A-1이 제일 중요함** — 이게 없으면 A-2·A-3을 아무리 연결해도 애초에 입력될 값이 없어서 의미 없음.

---

## 트랙 B — 필터링 게이트화 (배선 성격, B-2만 별도)

검증 결과를 실제로 "차단"으로 작동하게 만드는 작업. 오늘 발견한 원칙 그대로: 기준 미달 시 원천 차단.

**뒷문(`/api/registry/[id]` lifecycleStage 우회) 재확인**: 지난주 이미 패치 완료됨(코드 91번 줄 주석으로 재확인) — 이번 트랙에 추가 작업 불필요. B-1 하드블록을 걸어도 이 경로로 우회될 위험은 없음.

**⚠ B-0을 B-1b보다 먼저 반드시 적용할 것** — 순서를 지키지 않으면 위원회 정상 승인 경로까지 함께 막혀 에이전트 활성화 자체가 안 되는 서비스 마비가 발생함 (아래 B-0 참조).

**공수 재산정**: B-2(인수신청)는 신규 API+UI+알림을 다 만드는 신규 기능이라 B-1·B-3(둘 다 배선 성격, 반나절~1일)과 묶어서 "2~3일"로 잡은 게 낙관적이었음. 분리함:

| 항목 | 성격 | 공수 |
|---|---|---|
| B-0 (prodStatus↔lifecycleStage 동기화) | 배선 — 버그 수정, B-1b 선행조건 | 반나절 |
| B-1 (GATE2 하드블록) | 배선 — 기존 로직에 조건 추가 | 반나절 |
| B-1b (ACTIVE 직행 옆문 차단) | 배선 — checkProdEligibility 재사용, B-0 이후에만 적용 | 반나절 |
| B-3 (재신청 흐름 안내 문구) | 배선 — UI 문구만 | 반나절 |
| B-2 (인수신청 신규개발) | 신규 기능 | **별도 2~3일** |

### B-0. 에이전트 활성화 로직 통합 (Critical, B-1b 선행조건)

**리뷰에서 발견된 구조적 문제(1차)**: Policy Gateway(`lib/gateway/policy.ts` 50번 줄)는 `lifecycleStage`만 참조하는데, 위원회 정식 승인 경로(`app/api/council/agenda/[id]/decide/route.ts`)는 승인 시 `phase`/`devStage`/`prodStatus`만 갱신하고 **`lifecycleStage`는 전혀 건드리지 않음**.

**2차 검증(Jarvis)에서 격상됨**: 단순히 `lifecycleStage` 필드만 맞추면 안 됨 — `PATCH /api/registry`의 ACTIVE 전환에는 필드 세팅 외에 **부수효과 3가지**가 딸려 있고, 위원회 경로는 이 중 1개만 자체적으로 함:

| 부수효과 | 옆문(`PATCH /api/registry`) | 위원회 경로(`council/agenda/decide`) |
|---|---|---|
| `lifecycleStage='ACTIVE'` | ✅ | ❌ |
| `gate2Passed=true`+타임스탬프 | ✅ | ❌ |
| `Project.status='production'` 동기화 | ✅ | ✅ (자체 구현) |
| `linkAgentToRegistry` (AgentRegistry↔실제 Agent 레코드 연결 — "진짜 배포"의 실체) | ✅ | ❌ |

필드 하나만 고치면 Policy Gateway는 풀리지만, 위원회로 승인된 에이전트는 `gate2Passed` 없고 실제 `Agent` 레코드와 연결도 안 된 **반쪽짜리 활성화 상태**로 남음. 사람이 두 경로를 계속 나란히 관리하다 보면 또 어긋날 것이므로, **필드 패치가 아니라 활성화 로직을 공용 함수로 합쳐서 구조적으로 막음**:

```ts
// src/lib/agent-activation.ts (신규)
export async function activateAgent(
  tx: PrismaTransaction,
  agentId: string,
  opts?: { operatorTrustScore?: number; operatorComment?: string; sam30dAccuracy?: number }
) {
  const now = new Date()
  const agent = await tx.agentRegistry.update({
    where: { id: agentId },
    data: {
      lifecycleStage: 'ACTIVE',
      gate2Passed: true,
      gate2PassedAt: now,
      ...(opts?.operatorTrustScore && {
        operatorTrustScore: opts.operatorTrustScore,
        operatorComment: opts.operatorComment,
        sam30dAccuracy: opts.sam30dAccuracy,
      }),
    },
  })
  if (agent.projectId) {
    await tx.project.update({ where: { id: agent.projectId }, data: { status: 'production' } })
    const linkedAgent = await tx.agent.findFirst({ where: { name: agent.agentName, agentRegistryId: null } })
    if (linkedAgent) await linkAgentToRegistry(tx, linkedAgent.id, agent.id)
  }
  return agent
}
```

- `PATCH /api/registry`의 ACTIVE 분기 → `activateAgent(tx, id, { operatorTrustScore, ... })` 호출로 교체
- `council/agenda/[id]/decide`의 `PROD_APPROVAL` + `APPROVED` 분기 → `activateAgent(tx, item.agentId)` 호출로 교체 (operator 관련 값은 없으므로 생략 — 위원회 승인은 트러스트스코어 개념이 없는 게 정상이라 null로 남는 게 정직함)
- 두 경로가 같은 함수를 호출하므로 앞으로 활성화 로직이 바뀌어도 한 곳만 고치면 됨 — 이번처럼 다시 갈라질 구조적 여지를 없앰

**순서**: B-0(공용 함수 통합) → (정상 경로 복구 확인) → B-1b. 역순으로 하면 안 됨.

### B-1. GATE1→GATE2 전환에 기술표준 하드블록 추가

```ts
// app/api/registry/route.ts — 기존 GATE1→GATE2 데이터 하드블록과 대칭 구조로 추가
if (lifecycleStage === 'GATE2') {
  const project = await prisma.project.findUnique({
    where: { id: current.projectId },
    select: { techStandardsPassed: true, techStandardsFailedItems: true },
  })
  if (!project?.techStandardsPassed) {
    return NextResponse.json(
      {
        error: '기술표준 미달로 GATE2 전환 불가',
        failedItems: project?.techStandardsFailedItems ? JSON.parse(project.techStandardsFailedItems) : [],
      },
      { status: 422 }
    )
  }
  // ... 기존 데이터 하드블록 체크는 그대로 유지 (병렬 조건, 둘 다 통과해야 함)
}
```

**판단**: 데이터 하드블록과 기술표준 하드블록은 **둘 다 GATE2 진입 조건**으로 병렬 적용 — 데이터도 있고 기술표준도 통과해야 GATE2. 하나라도 미달이면 422.

### B-1b. ACTIVE 직행 경로(옆문) 하드블록 — 리뷰에서 발견된 핵심 항목

**선행조건: B-0이 먼저 적용되어 있어야 함.** B-0 없이 이걸 먼저 넣으면 위원회 정상 승인 경로까지 함께 막히는 서비스 마비가 발생함.

현재 `app/api/registry/route.ts` 96번 줄: `lifecycleStage==='ACTIVE' && operatorTrustScore`이면 `checkProdEligibility`를 전혀 안 거치고 `gate2Passed=true`까지 자동 기록함 — 위원회 상정 경로에는 5요건 하드블록이 있는데 이 직행 경로에만 없음. 검증을 우회하면서 통과 기록까지 남기는 구조라 반드시 막아야 함.

```ts
// app/api/registry/route.ts — ACTIVE 전환 가드 추가
if (lifecycleStage === 'ACTIVE') {
  const { eligible, checks } = await checkProdEligibility(id)
  if (!eligible) {
    return NextResponse.json(
      { error: '상용전환 요건 미충족 — ACTIVE 전환 불가', checks },
      { status: 422 }
    )
  }
  if (operatorTrustScore) {
    updateData.gate2Passed = true   // 이제 요건 통과 후에만 기록됨
    ...
  }
}
```

위원회 상정 경로(`/api/council/agenda`)와 동일한 `checkProdEligibility`를 재사용 — 두 경로가 같은 기준으로 막히게 됨. 공수: 반나절 (B-1과 같은 파일, 같은 성격).

### B-2. "인수 신청" 기능 신규 개발

문서상 Phase1(PoC)→Phase2(AX팀 검토) 공식 트리거인데 코드에 전혀 없음. 신규 개발 필요:

- 신규 API `POST /api/projects/[id]/handover` — 4개 제출물(기능시연·입출력명세·버전관리저장소URL·기밀등급) 입력받아 `Project.status`를 다음 단계로 전환
- `/me/projects` 과제 상세에 "인수 신청" 버튼 — PoC 단계 완료 표시가 된 신청 건에만 노출
- 제출 즉시 AX팀에 알림(기존 `notify()` 재사용)

### B-3. 필터링 결과 재신청 흐름

문서에 "미충족 시 보류(거부 아님), 컨설팅 후 재신청 가능"이라고 명시돼 있으므로, B-1의 422 응답이 **최종 거부가 아니라 보류**임을 UI에서 명확히 표시.

**검증됨**: `/api/projects/[id]/gate2` PATCH는 호출마다 `checkTechStandards()`를 재실행해서 `techStandardsPassed`를 갱신함(코드 42번 줄 확인) — 항목 값을 고쳐서 재제출하면 자동 재평가되는 것 실제로 맞음. 별도 재평가 로직 개발 불필요.

### B-4. 소급 처리 방침 — **확정됨 (2026-09-07)**

**결정: 옵션 B(시행일 기준) 확정. 소급 재점검 과제 별도 편성 불필요.**

운영 DB 실조회 결과 — 전체 에이전트 **35개** 기준:

| 항목 | 건수 | 비율 |
|---|---|---|
| `syncGap` (위원회 승인됐으나 `lifecycleStage` 미동기화로 Policy Gateway 차단) | **3건** | 8.6% |
| 옆문 통과 의심 (`lifecycleStage='ACTIVE'` && `techStandardsPassed=false`) | **0건** | 0% |

**판단 근거**:
- 옆문 통과 **0건** → 검증 없이 상용 운영 중인 에이전트가 실제로 존재하지 않음. 소급 리스크 없으므로 옵션 B로 단순 진행, 사후 재점검 과제 불필요
- 이 결과는 **B-1b의 성격도 바꿈** — "이미 뚫린 구멍 막기"가 아니라 "예방적 조치". 우선순위 ★★★ → ★★로 조정
- 반면 `syncGap` **3건은 실제 운영 장애** — 정식 절차(위원회 심의)를 모두 통과한 에이전트가 현재 사용자에게 열리지 않고 있음. **B-0 긴급 배포의 직접 근거**

**부수 확인**: 이전 분석에서 "옆문이 사실상 유일하게 작동하는 활성화 경로였을 것"으로 추정했으나, 옆문 통과가 0건이므로 **실제로는 아무도 우회하지 않았음**이 확인됨. 우회 관행이 자리잡기 전 단계에서 발견한 것으로, 표준화 관점에서 유리한 시점.

<details>
<summary>참고: 조회에 사용한 쿼리 (읽기 전용)</summary>

```ts
const agents = await prisma.agentRegistry.findMany({
  select: { id: true, agentName: true, projectId: true, lifecycleStage: true, prodStatus: true, gate2Passed: true },
})
const rows = await Promise.all(agents.map(async a => {
  const p = a.projectId ? await prisma.project.findUnique({
    where: { id: a.projectId }, select: { techStandardsPassed: true },
  }) : null
  return {
    agent: a.agentName,
    lifecycleStage: a.lifecycleStage,
    prodStatus: a.prodStatus,
    gate2Passed: a.gate2Passed,
    techStandardsPassed: p?.techStandardsPassed ?? null,
    syncGap: a.prodStatus === 'ACTIVE' && a.lifecycleStage !== 'ACTIVE',
  }
}))
console.table(rows)
```
</details>

---

## 순서 제안

**트랙 A 먼저, 트랙 B 나중** — 단, **B-0은 예외로 최우선 즉시 착수**. B-1(하드블록)을 A-1(입력 UI) 없이 먼저 넣으면 모든 신청이 막혀 서비스가 마비되므로 A→B 순서가 원칙이지만, B-0은 차단이 아니라 **이미 발생 중인 장애(syncGap 3건)를 푸는 복구 작업**이라 트랙 A와 무관하게 병행 가능함.

| 순서 | 트랙 | 이유 |
|---|---|---|
| **0** | **B-0 (활성화 경로 통합) — 긴급** | **syncGap 3건 실사용 장애 진행 중. A와 무관하게 즉시 착수** |
| 1 | A-1 (입력 UI) | 값을 넣을 수 있어야 함 |
| 2 | A-2, A-3 (제언·검토 화면) | 미달 시 뭐가 문제인지 보여야 함 |
| 3 | (병행) A-4 결재 상신 | 개발 트랙과 무관하게 별도 진행 |
| 4 | B-1b (ACTIVE 직행 옆문 차단) | B-0 배포·검증 확인 후. 악용 0건 확인되어 예방적 조치 성격 |
| 5 | B-1 (GATE2 하드블록) | 트랙 A 완료가 전제 |
| 6 | B-2 (인수신청) | 별도 기능, 순서 독립적이라 아무 때나 가능 |

### PR 분리 원칙 (배포 순서 보장)

**B-0과 B-1b를 같은 PR에 묶지 말 것.** 한 PR로 머지하면 코드상 순서는 지켜져도 배포 시점에는 동시에 반영되므로, B-0의 정상 경로 복구가 실제 환경에서 작동하는지 확인하기 전에 B-1b의 차단이 함께 켜짐 — 문제 발생 시 원인 분리도 안 되고 롤백 단위도 커짐.

| PR | 내용 | 머지 조건 |
|---|---|---|
| **PR ① (긴급)** | B-0 (`activateAgent()` 공용 함수 통합) | 배포 후 **syncGap 3건이 실제로 해소되어 `lifecycleStage='ACTIVE'`가 되고 Policy Gateway에서 풀리는지 운영 환경에서 확인** |
| PR ② | B-1b (ACTIVE 직행 옆문 차단) | PR ① 검증 완료가 전제. B-4 소급 방침은 옵션 B로 이미 확정됨 |
| PR ③ | B-1 (GATE2 기술표준 하드블록) | 트랙 A(A-1~A-3) 배포 완료 후 |

B-1은 트랙 A 완료가 전제이므로 B-0/B-1b와도 별도 PR로 분리하는 게 안전함.

---

## 완료 조건

- `/projects/new`에서 기술표준 6항목 실제 입력 가능
- **완료 확정 책임소재 명시**: 신청자 자가입력은 저장만 됨. `techStandardsPassed`가 실제로 true가 되는 건 AX팀이 `/registry/[id]`에서 gate2 체크리스트를 검토·확정(PATCH)해야만 — 신청자가 6항목 다 입력했는데 GATE2가 안 열리는 게 정상 동작임을 UI 문구로 안내
- 미달 시 신청자가 `/me/projects`에서 어떤 항목이 왜 미달인지 확인 가능
- AX팀이 `/registry/[id]`에서 체크리스트 직접 검토·수정 가능
- **B-0 적용 후 위원회 승인 건이 실제로 Policy Gateway에서 풀리는지(lifecycleStage=ACTIVE 확인) 회귀 테스트**
- GATE1→GATE2 전환 시 기술표준+데이터 둘 다 하드블록 (병렬 조건)
- ACTIVE 전환(위원회 경로·직행 경로 모두)에 `checkProdEligibility` 적용 — **위원회 경로는 안건 상정 시점(`/api/council/agenda` POST)에 이미 검증됨. 결정 시점(`decide`)에 재검사 코드를 추가하는 게 아니라, 상정 자체가 그 게이트 역할을 한다는 뜻으로 정정.** 직행 경로(B-1b)만 신규로 동일 기준 적용
- 문서(AI-STD-2026-006)와 코드 항목 수 6개로 일치 (결재 별도 진행)
- "인수 신청" 기능으로 Phase1→Phase2 공식 전환 가능

---

## 리뷰 반영 이력

| 라운드 | 지적/발견 | 반영 |
|---|---|---|
| v1 | 초안 — 트랙 A(배선)/B(필터링) 분리, "A 먼저 열고 B로 잠근다" 순서 원칙 수립 | — |
| v2 (Jarvis) | 뒷문(`/api/registry/[id]`) 차단 누락 지적 | 검증 결과 지난주 이미 패치됨 확인 — 신규 작업 불필요, gap-analysis 문서 정정 |
| v2 (Jarvis) | 소급 처리 방침 없음 | B-4 신설, 옵션 A/B 제시 + 실데이터 조회 쿼리 첨부 |
| v2 (Jarvis) | B트랙 공수(2~3일 일괄)가 낙관적 | B-2(신규개발)만 별도 분리, 나머지는 반나절 단위로 세분화 |
| v2 (Jarvis) | 미검증 가정 2개(자동재평가·우회경로) | 코드로 확인 — 자동재평가 사실 확인, 우회경로는 이미 닫힘 확인 |
| v2 (Jarvis) | A-4 문서개정을 개발 트랙에 포함 | 결재 필요 사안으로 별도 분리, 개발 트랙에서 제외 |
| v3 (Jarvis) | `checkProdEligibility`가 "죽어있다"는 v2 정정 결론이 틀림 — 위원회 상정 경로엔 실제로 하드블록 살아있음 | gap-analysis "아무도 확인 안 했다" 결론 취소, 정정 |
| v3 (Jarvis) | **진짜 구멍 발견**: `PATCH /api/registry`의 `lifecycleStage==='ACTIVE' && operatorTrustScore` 직행 경로는 `checkProdEligibility` 미경유 (옆문) | B-1b 신설 — 위원회 경로와 동일한 `checkProdEligibility` 재사용 |
| v4 (Claude, B-1b 리스크 검토 중 발견) | **B-1b를 그대로 적용하면 위원회 정상 승인 경로까지 막힐 위험** — 위원회 승인(`council/agenda/decide`)은 `prodStatus`만 세팅하고 `lifecycleStage`는 안 건드림. Policy Gateway는 `lifecycleStage`만 참조. 전체 코드베이스에서 `lifecycleStage='ACTIVE'`를 세팅하는 곳은 seed 제외 시 그 "옆문" 단 한 곳뿐 — 즉 옆문이 사실상 유일하게 작동하는 활성화 경로였을 가능성 | **B-0 신설**(prodStatus↔lifecycleStage 동기화)을 B-1b보다 선행 조건으로 추가, 순서표·완료조건·B-4 쿼리(syncGap 체크 포함) 전부 갱신 |
| v5 (Jarvis, B-0 코드 검증) | B-0을 필드 하나(`lifecycleStage`) 추가로만 처리하면 부족 — 옆문은 `gate2Passed`+타임스탬프, `Agent` 레코드 연결(`linkAgentToRegistry`)까지 3가지 부수효과를 갖는데 위원회 경로는 `Project.status` 동기화 1개만 자체 구현. 필드 패치가 아니라 "두 경로 통합"으로 격상 필요. 완료조건의 "위원회 경로에도 checkProdEligibility 동일 적용" 문구도 코드와 안 맞음(안건 상정 시점에 이미 검증되는 것이지 decide 시점에 재검사 코드 추가가 아님) | B-0을 `activateAgent()` 공용 함수로 격상 — 두 경로가 같은 함수 호출하도록 리팩터링. 완료조건 문구 정정 |
| v6 (Jarvis, 디스패치 전 최종) | 스펙 자체는 실행 가능. 단 ①B-4 소급방침이 미결인 채로 넘어가면 안 됨 ②B-0/B-1b를 같은 PR에 묶으면 배포 순서 보장이 안 됨 | 문서 상단에 "넘기기 전 확인 사항" 표 추가, "PR 분리 원칙" 섹션 신설(PR ①②③ 분리 + 각 머지 조건 명시) |
| v7 (DB 조회 결과 반영, 2026-09-07) | 운영 DB 실조회: 전체 35개 중 syncGap 3건(8.6%), 옆문 통과 의심 0건 | **B-4 옵션 B 확정**(사후 재점검 불필요), **B-0을 긴급 최우선으로 격상**(실사용 장애 3건 진행 중, 트랙 A와 무관하게 즉시 착수), **B-1b 우선순위 ★★★→★★ 하향**(악용 0건으로 예방적 조치 성격). 상단 확인사항표·순서표·PR표 전부 갱신 |
