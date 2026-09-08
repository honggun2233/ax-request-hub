# [B-2] 인수 신청 기능 신규 개발 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: dev-standard 트랙 B — 신규 기능 (별도 일정, 2~3일)
> 선행 조건: 없음 (독립 기능)

---

## 배경

AI-STD-2026-006 문서에 명시된 공식 절차:

```
Phase 1 (PoC 완료)
  → 신청자가 "인수 신청" 제출 (4개 제출물 포함)
    → AX팀 알림 수신
      → Phase 2 (AX팀 정식 검토) 시작
```

현재 코드에 이 전환 트리거가 없음 — `pilot` 상태에서 AX팀에게
"PoC 완료, 검토 요청"을 공식으로 전달하는 버튼·API가 없어서,
비공식 대화로만 이루어지고 있음.

---

## Project.status 전이 구조 (현행)

```
submitted → evaluated → pilot → production
           (자동평가)    (AX팀     (운영전환)
                         승인)
```

인수 신청은 **`pilot` 단계에서** 발생:
- 신청자가 PoC를 마치고 AX팀에게 정식 검토를 요청하는 시점
- `pilot → handover_requested` 같은 별도 status를 만들 필요 없음
  — Project에 `handoverRequestedAt` 타임스탬프만 추가하면 충분

---

## 작업 범위

### 1. 스키마 — `Project` 모델에 인수 신청 필드 추가

```prisma
// prisma/schema.prisma — Project 모델에 추가
handoverRequestedAt    DateTime?   // 인수 신청 시각
handoverNote           String?     // 인수 신청 메모
handoverArtifacts      String?     // 4개 제출물 URL/설명 (JSON)
```

4개 제출물(AI-STD-2026-006 Phase1 완료 기준):
```ts
// handoverArtifacts JSON 구조
{
  demoUrl: string           // 기능 시연 링크 또는 설명
  inputOutputSpec: string   // 입출력 명세 문서 링크
  repoUrl: string           // 버전 관리 저장소 URL
  dataClassification: string // 기밀등급 명시 문서 링크
}
```

### 2. API — `POST /api/projects/[id]/handover`

```ts
// app/api/projects/[id]/handover/route.ts (신규)
// 권한: 해당 project의 owner(신청자 본인)만
// 전제조건: project.status === 'pilot'

import { notify } from '@/lib/notify'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const { note, artifacts } = await req.json()

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, status: true, ownerEmail: true },
  })

  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })
  if (project.status !== 'pilot')
    return NextResponse.json({ error: '파일럿 승인 단계에서만 인수 신청 가능합니다.' }, { status: 422 })
  if (project.ownerEmail !== session?.user?.email)
    return NextResponse.json({ error: '신청자 본인만 인수 신청할 수 있습니다.' }, { status: 403 })
  if (project.handoverRequestedAt)
    return NextResponse.json({ error: '이미 인수 신청이 완료됐습니다.' }, { status: 409 })

  // 인수 신청 저장
  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      handoverRequestedAt: new Date(),
      handoverNote: note ?? null,
      handoverArtifacts: artifacts ? JSON.stringify(artifacts) : null,
    },
  })

  // AX팀 전체 알림
  const axTeamEmails = await prisma.employee.findMany({
    where: { role: 'AX_TEAM' },
    select: { email: true },
  }).then(r => r.map(e => e.email))

  await notify(
    {
      type: 'TASK_ESCALATED',
      title: `인수 신청 — ${project.title}`,
      body: `${session.user?.name ?? project.ownerEmail}님이 PoC를 완료하고 AX팀 검토를 요청했습니다.`,
      link: `/admin?handover=${params.id}`,
      metadata: { projectId: params.id },
    },
    axTeamEmails
  )

  // AuditLog 기록
  await prisma.auditLog.create({
    data: {
      entityType: 'Project',
      entityId: params.id,
      action: 'HANDOVER_REQUESTED',
      actorEmail: session.user?.email ?? '',
      detail: JSON.stringify({ note, artifactsProvided: !!artifacts }),
    },
  })

  return NextResponse.json(updated)
}
```

### 3. UI — `/me/projects`에 "인수 신청" 버튼 추가

`app/me/projects/page.tsx` — 기존 `PocRequestRow` 패턴과 동일하게,
`pilot` 상태이고 `handoverRequestedAt`이 없을 때만 버튼 표시:

```tsx
{p.status === 'pilot' && !p.handoverRequestedAt && (
  <HandoverRequestRow projectId={p.id} projectTitle={p.title} />
)}
{p.handoverRequestedAt && (
  <div style={{ fontSize: 11, color: '#059669', marginTop: 8 }}>
    ✓ 인수 신청 완료 ({new Date(p.handoverRequestedAt).toLocaleDateString('ko-KR')})
  </div>
)}
```

**`HandoverRequestRow` 컴포넌트** (같은 파일 또는 별도 파일):
- "인수 신청" 버튼 클릭 → Dialog 열림
- Dialog 내 입력: 신청 메모(textarea), 4개 제출물 URL/설명 입력
- "신청하기" 버튼 → `POST /api/projects/[id]/handover` 호출
- 성공 시 완료 메시지 표시, 버튼 사라짐

### 4. `/api/projects` GET — 응답에 `handoverRequestedAt` 포함

```ts
// app/api/projects/route.ts — select/include에 추가
handoverRequestedAt: true,
handoverNote: true,
```

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | `pilot` 상태 과제 카드에 "인수 신청" 버튼이 표시됨 |
| 2 | Dialog에서 메모 + 4개 제출물 입력 후 신청 가능 |
| 3 | 신청 후 버튼이 "인수 신청 완료 (날짜)"로 교체됨 (재신청 불가) |
| 4 | 신청 즉시 AX팀 전체에 Knox 알림 발송됨 |
| 5 | AuditLog에 `HANDOVER_REQUESTED` 이력이 기록됨 |
| 6 | `pilot`이 아닌 상태에서 API 직접 호출 시 422 반환 |
| 7 | 본인이 아닌 계정에서 호출 시 403 반환 |
| 8 | 이미 신청한 과제에 재신청 시 409 반환 |

---

## 참고 파일

- `app/api/projects/[id]/appeal/route.ts` — 유사한 신청 API 패턴 참고
- `app/me/projects/page.tsx` — `PocRequestRow` 패턴 참고
- `lib/notify.ts` — 알림 함수 (Knox + DB)
- `docs/dev-standard-phase0-1-planning.md` — B-2 기획 배경
- `docs/dev-standard-filtering-gate-spec.md` — B-2 스펙
