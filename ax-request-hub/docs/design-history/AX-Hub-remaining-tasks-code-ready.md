# AX Hub — 잔여 작업 2건 즉시 반영용 (코드 포함)

**작성일**: 2026-08-21
**대상**: gap체크 결과 후속 — #1(Gate2/3 라우팅 업그레이드), #5(agentRegistryId 자동세팅)

---

## 1. #1 후속 — 새 설계 불필요, 기존 문서 그대로 적용

Gate2/Gate3가 지금 쓰는 "구형 단순 env 라우터"를 교체하는 작업은 **이미 설계가 끝나 있습니다.** 아래 두 문서를 그대로 적용하면 됩니다 — 추가 설계 작업 없음.

```
참조 문서:
  - AX-Hub-ai-routing-final-architecture.md  (Qwen=판단자, Bedrock=실행 구조)
  - AX-Hub-bedrock-connection-unblock.md     (BedrockAdapter, GEMINI_BACKEND 스위치)

적용 방법:
  Gate2 (코드리뷰) 호출부:
    const response = await gatewayCompleteRouted(req, { taskType: 'GATE2_REVIEW' })

  Gate3 (채점+근거생성) 호출부:
    const response = await gatewayCompleteRouted(req, { taskType: 'GATE3_RATIONALE' })
```

`confidentialityLevel` 파라미터는 최종 아키텍처에서 제거됐으므로 넘기지 않습니다(Bedrock이 AWS 경계 내 처리라 기밀등급 무관하게 처리 가능 — 최종 아키텍처 문서 §2 참조).

---

## 2. #5 — agentRegistryId 자동세팅 코드

### 2-1. 신규 헬퍼 함수

```ts
// src/lib/agent-registry-link.ts (신규 파일)
import { Prisma } from '@prisma/client'

/**
 * Agent와 AgentRegistry를 같은 트랜잭션 내에서 생성한 직후 호출.
 * Gate3 승인 → 배포 시점에 Agent + AgentRegistry가 함께 생성되는
 * 지점을 찾아 그 트랜잭션 안에 이 호출을 추가할 것.
 */
export async function linkAgentToRegistry(
  tx: Prisma.TransactionClient,
  agentId: string,
  agentRegistryId: string,
) {
  await tx.agent.update({
    where: { id: agentId },
    data: { agentRegistryId },
  })
}
```

**적용 위치 확인 필요**: Agent와 AgentRegistry가 실제로 같이 생성되는 지점(Gate3 승인 후 배포 라우트로 추정)에서, 두 레코드 생성 직후 같은 트랜잭션 안에 `linkAgentToRegistry(tx, agent.id, agentRegistry.id)`를 추가.

### 2-2. 기존 레코드 백필 스크립트

```ts
// scripts/backfill-agent-registry-link.ts
import { prisma } from '@/lib/prisma'

async function main() {
  const unlinked = await prisma.agent.findMany({
    where: { agentRegistryId: null },
  })

  const matches: { agentId: string; agentName: string; registryId: string; registryName: string }[] = []
  const unmatched: string[] = []

  for (const agent of unlinked) {
    // 이름 매칭 — 부정확할 수 있음, dry-run으로 먼저 확인
    const registry = await prisma.agentRegistry.findFirst({
      where: { name: agent.name },
    })
    if (registry) {
      matches.push({ agentId: agent.id, agentName: agent.name, registryId: registry.id, registryName: registry.name })
    } else {
      unmatched.push(agent.name)
    }
  }

  console.log(`매칭됨: ${matches.length}건`)
  console.table(matches)
  console.log(`매칭 안 됨: ${unmatched.length}건`)
  console.log(unmatched)

  // dry-run 기본값 — 실제 반영은 --apply 플래그로만
  if (process.argv.includes('--apply')) {
    for (const m of matches) {
      await prisma.agent.update({ where: { id: m.agentId }, data: { agentRegistryId: m.registryId } })
    }
    console.log('반영 완료')
  } else {
    console.log('dry-run 모드입니다. 실제 반영하려면 --apply 플래그를 추가하세요.')
  }
}

main()
```

**주의**: 이름 매칭은 부정확할 수 있습니다(동명이인 에이전트, 이름 변경 이력 등). `--apply` 없이 먼저 실행해서 매칭 결과표를 사람이 눈으로 확인한 뒤 반영하는 걸 권장합니다.

---

## 3. middleware.ts WIP 결과 검증 시 확인할 것 (에이전트 작업 완료 후)

이전 코드리뷰(`AX-Hub-P0인증-코드리뷰결과.md`)에서 발견했던 두 가지가 이번 WIP 결과에도 재발하지 않았는지 병합 전 반드시 확인:

1. **matcher 패턴 두 개가 겹쳐서 로그인 자체를 막지 않는지** (`/api/auth/*` 예외처리가 모든 matcher 항목에 일관되게 적용됐는지)
2. **서비스토큰 인증 시 401 JSON을 반환하는지, `/login` HTML 리다이렉트로 새지 않는지** (API 경로와 페이지 경로 분기 처리 여부)

---

## 4. 요약

| 항목 | 필요 작업 | 신규 설계 필요 여부 |
|---|---|---|
| Gate2/3 라우팅 업그레이드 | 기존 문서 2건 그대로 적용 | 불필요 |
| agentRegistryId 자동세팅 | 본 문서 §2-1 헬퍼 적용 | 불필요 (완성 코드 제공) |
| 기존 레코드 백필 | 본 문서 §2-2 스크립트, dry-run 먼저 | 불필요 (완성 코드 제공) |
| middleware.ts 검증 | 병합 전 §3 체크리스트 확인 | 불필요 (체크리스트 제공) |
