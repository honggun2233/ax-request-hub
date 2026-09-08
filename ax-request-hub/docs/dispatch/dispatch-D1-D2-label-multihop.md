# [D-1/D-2] 라벨 통일 + DataAsset 멀티홉 영향도 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> PR 분리: D-1(1줄 수정)과 D-2(스키마+로직)는 별도 PR

---

## D-1. `/executive` 라벨 통일 (단일 PR, 1줄)

### 현황

`components/app-sidebar.tsx`에서 같은 `/executive` URL을 두 역할이 다른 이름으로 부름:

| 위치 | 역할 | 현재 라벨 | 수정 후 |
|---|---|---|---|
| 72번 줄 | EXECUTIVE/C_LEVEL | "경영 대시보드" | 그대로 유지 |
| 94번 줄 | AX_TEAM | "경영진 뷰" | **"경영 대시보드"로 통일** |

경영진이 보는 화면과 AX팀이 보는 화면이 같은 URL이므로, 같은 이름("경영 대시보드")으로 통일.

### 수정

```ts
// components/app-sidebar.tsx — 94번 줄
{ href: "/executive", label: "경영 대시보드", icon: BarChart3 },
// (기존: label: "경영진 뷰")
```

---

## D-2. DataAsset-to-DataAsset 멀티홉 영향도 (별도 PR)

### 배경

현재 `lib/impact-graph.ts`의 `getAffectedAgents`는 2-path 탐색:
- Path 1: DataAsset → AgentDataLink → AgentRegistry (직접 연결)
- Path 2: DataAsset → DataRequest → Project → AgentRegistry (프로젝트 경유)

DataAsset 간 관계(A 데이터가 B 데이터를 기반으로 생성되는 파생 관계 등)가 있으면
A를 회수할 때 B를 통해 연결된 에이전트도 영향 범위에 포함돼야 함.
지금은 이 3번째 경로가 없음.

### 1. 스키마 — DataAsset 자기 참조 관계 추가

```prisma
// prisma/schema.prisma — DataAsset 모델에 추가
model DataAsset {
  // 기존 필드들...

  // DataAsset-to-DataAsset 파생 관계 (멀티홉 영향도 지원)
  derivedFrom    DataAsset[]  @relation("DataAssetDerivation", references: [id], fields: [])
  derivedAssets  DataAsset[]  @relation("DataAssetDerivation")
}
```

Prisma 자기 참조 다대다 — 명시적 조인 테이블 없이 암시적 관계로 처리.

### 2. `lib/impact-graph.ts` — Path 3 추가

```ts
export async function getAffectedAgents(assetId: string): Promise<AffectedAgent[]> {
  // 기존 Path 1, Path 2는 그대로...

  // ── Path 3: DataAsset → derivedAssets → (Path 1 + Path 2 재귀) ──
  // 이 DataAsset을 기반으로 파생된 DataAsset들을 찾아서
  // 각각에 대해 Path 1, Path 2를 실행하고 합산
  const derivedAssets = await prisma.dataAsset.findMany({
    where: { derivedFrom: { some: { id: assetId } } },
    select: { id: true },
  })

  for (const derived of derivedAssets) {
    const derivedLinks = await prisma.agentDataLink.findMany({
      where: { dataAssetId: derived.id },
      include: { agent: { select: { id: true, agentName: true, lifecycleStage: true } } },
    })
    for (const link of derivedLinks) {
      const a = link.agent
      if (seen.has(a.id)) continue
      seen.set(a.id, {
        agentId:        a.id,
        agentName:      a.agentName,
        lifecycleStage: a.lifecycleStage ?? 'UNKNOWN',
        connectionType: 'VIA_DERIVED_ASSET',
        projectName:    null,
        riskLevel:      riskLevel(a.lifecycleStage ?? ''),
      })
    }
  }
}
```

`AffectedAgent.connectionType`에 `'VIA_DERIVED_ASSET'` 추가 필요:

```ts
export interface AffectedAgent {
  connectionType: 'DIRECT' | 'VIA_PROJECT' | 'VIA_DERIVED_ASSET'  // 추가
  ...
}
```

### 3. `/dp/catalog` UI — DataAsset 파생 관계 편집

데이터 자산 상세 화면에서 "이 데이터의 기반 데이터" 다중 선택 UI 추가:
- `GET /api/data/assets/[id]` 응답에 `derivedFrom` 목록 포함
- `PATCH /api/data/assets/[id]` 에서 `derivedFrom` 업데이트

---

## 완료 조건

### D-1
| # | 확인 항목 |
|---|---|
| 1 | AX팀 사이드바에서 `/executive` 항목이 "경영 대시보드"로 표시됨 |
| 2 | 경영진 사이드바도 "경영 대시보드"로 표시됨 (기존 유지) |

### D-2
| # | 확인 항목 |
|---|---|
| 1 | DataAsset 상세에서 "기반 데이터" 다중 선택 가능 |
| 2 | A 자산 회수 시 A를 기반으로 파생된 B 자산의 에이전트도 영향 목록에 포함됨 |
| 3 | `connectionType: 'VIA_DERIVED_ASSET'`으로 구분 표시 |
| 4 | 기존 Path 1, Path 2 동작 회귀 없음 |
