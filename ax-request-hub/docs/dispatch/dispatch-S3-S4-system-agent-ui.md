# [S-3/S-4] 공통 에이전트 UI 통합 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: 공통 에이전트 트랙 — UI 배선
> 선행 완료: S-1/S-2(PR #67 머지 + seed 실행 완료)
> PR 분리: S-3과 S-4는 건드리는 파일이 달라 **하나의 PR**로 묶어도 충돌 없음

---

## S-3: `/registry` 시스템/도메인 탭 구분

### 배경

S-1/S-2로 `isSystemAgent=true`인 공통 에이전트 5종이 레지스트리에 삽입됐는데,
현재 `/registry`에서 도메인 에이전트와 섞여서 나옴.
공통 에이전트는 **수정·삭제 불가** 원칙이라 시각적으로 구분하고 조작을 막아야 함.

### 작업

**`app/registry/page.tsx`**

1. 기존 "에이전트 뷰 / AI 활용 뷰" 탭 옆에 탭 하나 추가:

```tsx
// 기존
<button onClick={() => setViewMode('agent')} ...>에이전트 뷰</button>
<button onClick={() => setViewMode('project')} ...>AI 활용 뷰</button>

// 추가
<button onClick={() => setViewMode('system')} ...>공통 에이전트</button>
```

2. `viewMode === 'system'`일 때 `isSystemAgent=true` 에이전트만 필터링:

```ts
const filtered = viewMode === 'system'
  ? agentData.agents.filter((a: any) => a.isSystemAgent)
  : viewMode === 'agent'
    ? agentData.agents.filter((a: any) => !a.isSystemAgent)
    : agentData.agents  // 'project' 뷰는 기존 로직 유지
```

3. `viewMode === 'system'`에서 에이전트 카드에 **수정·삭제 버튼 비활성화**:

```tsx
// 에이전트 카드 내 수정/삭제/단계전환 버튼 렌더링 조건
{!agent.isSystemAgent && (
  // 기존 수정·삭제·단계전환 버튼들
)}
```

4. 공통 에이전트 카드에 **"시스템 에이전트" 배지** 표시:

```tsx
{agent.isSystemAgent && (
  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
    background: 'rgba(109,40,217,.1)', color: '#7C3AED',
    border: '1px solid rgba(109,40,217,.25)', fontWeight: 600 }}>
    시스템 에이전트
  </span>
)}
```

### API 변경 없음

`/api/registry` GET이 `include` 기반 full fetch라 `isSystemAgent` 필드가
이미 응답에 포함됨. 별도 API 수정 불필요.

---

## S-4: `/projects/new` 공통 에이전트 선택 체크박스

### 배경

신청자가 과제 신청 시 어떤 공통 에이전트를 활용할지 선택하게 함.
선택 이력만 기록(Phase 1) — 실행 파이프라인 연동은 이후 Phase 2.

### 작업

**`app/projects/new/page.tsx`**

A-1에서 추가한 기술표준 체크리스트 스텝 바로 앞에 "공통 에이전트 선택" 스텝 추가:

1. 페이지 마운트 시 공통 에이전트 목록 fetch:

```ts
const [systemAgents, setSystemAgents] = useState<any[]>([])
const [selectedAgentKeys, setSelectedAgentKeys] = useState<string[]>([])

useEffect(() => {
  fetch('/api/registry?systemOnly=1')
    .then(r => r.json())
    .then(d => setSystemAgents(d.agents?.filter((a: any) => a.isSystemAgent) ?? []))
}, [])
```

2. 체크박스 UI — 5종 카드형 선택:

```tsx
<div style={{ marginBottom: 24 }}>
  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
    공통 에이전트 선택 <span style={{ fontSize: 11, color: '#8898BB', fontWeight: 400 }}>(선택 사항)</span>
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {systemAgents.map(agent => (
      <label key={agent.agentKey} style={{ display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 8, border: '1px solid #E4E9F2',
        cursor: 'pointer', background: selectedAgentKeys.includes(agent.agentKey) ? 'rgba(109,40,217,.04)' : '#fff' }}>
        <input
          type="checkbox"
          checked={selectedAgentKeys.includes(agent.agentKey)}
          onChange={e => {
            if (e.target.checked) setSelectedAgentKeys(p => [...p, agent.agentKey])
            else setSelectedAgentKeys(p => p.filter(k => k !== agent.agentKey))
          }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{agent.agentName}</div>
          <div style={{ fontSize: 11, color: '#8898BB' }}>{agent.purpose}</div>
        </div>
      </label>
    ))}
  </div>
</div>
```

3. `handleSubmit` payload에 `selectedCommonAgents` 추가:

```ts
const payload = {
  ...기존 필드들,
  techHasApiSpec,
  // ...기타 techHas* 필드,
  selectedCommonAgents: selectedAgentKeys,  // 신규
}
```

4. **`/api/projects` POST에서 `selectedCommonAgents` 수신 후 저장**:

Project 모델에 `selectedCommonAgents String? // JSON 배열` 필드 추가:

```prisma
// prisma/schema.prisma — Project 모델에 추가
selectedCommonAgents String?  // 선택한 공통 에이전트 agentKey 목록 (JSON)
```

POST handler에서:
```ts
selectedCommonAgents: selectedCommonAgents
  ? JSON.stringify(selectedCommonAgents)
  : null,
```

5. `/api/registry`에 `?systemOnly=1` 쿼리 파라미터 지원 추가:

```ts
// app/api/registry/route.ts GET handler
const systemOnly = url.searchParams.get('systemOnly') === '1'
// where 조건에 추가
...(systemOnly && { isSystemAgent: true }),
```

---

## 완료 조건

### S-3
| # | 확인 항목 |
|---|---|
| 1 | `/registry`에 "공통 에이전트" 탭이 표시됨 |
| 2 | 탭 클릭 시 `isSystemAgent=true` 에이전트 5종만 나타남 |
| 3 | 공통 에이전트 카드에 "시스템 에이전트" 보라 배지 표시 |
| 4 | 공통 에이전트 카드에 수정·삭제·단계전환 버튼 미표시 |
| 5 | 기존 "에이전트 뷰"에서는 도메인 에이전트만 나타남 |

### S-4
| # | 확인 항목 |
|---|---|
| 1 | `/projects/new`에 공통 에이전트 선택 체크박스가 표시됨 |
| 2 | 체크 후 제출 시 `selectedCommonAgents` 필드가 DB에 저장됨 |
| 3 | 선택 없이 제출해도 신청 가능 (선택 사항) |
| 4 | `/api/registry?systemOnly=1`이 공통 에이전트 5종만 반환함 |

---

## 참고 파일

- `app/registry/page.tsx` — S-3 수정 대상
- `app/projects/new/page.tsx` — S-4 수정 대상
- `app/api/registry/route.ts` — `systemOnly` 파라미터 추가
- `app/api/projects/route.ts` — `selectedCommonAgents` 수신
- `prisma/schema.prisma` — `selectedCommonAgents` 필드 추가
- `docs/common-agent-definition.md` — 공통 에이전트 정의

---

## 다음 작업 (S-3/S-4 완료 후)

| 순서 | 트랙 | 내용 | 조건 |
|---|---|---|---|
| 다음 | B-1b | ACTIVE 직행 옆문 차단 | PR #65 운영 검증 완료 후 |
| 별도 | B-2 | 인수 신청 기능 신규 개발 | 독립적, 별도 일정 |
