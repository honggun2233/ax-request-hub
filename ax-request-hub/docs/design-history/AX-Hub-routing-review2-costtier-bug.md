# AX Hub 모델 라우팅 2차 수정 — 코드 리뷰

**대상**: 배포 블로커 5개 반영본
**검토일**: 2026-08-21

---

## 결론

4개 수정 방향은 모두 맞지만, 그중 하나(`costTier` 정렬)에서 **주석과 실제 동작이 정반대로 나는 버그**를 발견했습니다. 이 기능 전체의 존재 이유(비용 절감)를 뒤집는 버그라 최우선으로 고쳐야 합니다.

---

## 🔴 Critical — `costTier` 알파벳 정렬로 "비용 우선"이 실제로는 반대로 작동

```ts
orderBy: { costTier: 'asc' },  // LOW 먼저 (비용 우선)  ← 주석
```

`costTier`는 `'HIGH' | 'MID' | 'LOW' | 'FREE'` 문자열입니다. 알파벳 오름차순 정렬 결과:

```
FREE, HIGH, LOW, MID   ← 실제 정렬 순서
```

"LOW 먼저"가 아니라 **HIGH가 LOW보다 먼저** 옵니다(H < L 알파벳 순). 지금 시드 데이터엔 FREE가 없으므로, `eligible[0]`은 **가장 비싼 프로바이더**를 고르게 됩니다. G2 작업이 온프렘 대신 HIGH 등급 클라우드로 우선 라우팅되는, 기능의 목적을 정확히 뒤집는 버그입니다.

**수정**: `costRank: Int`(FREE=1/LOW=2/MID=3/HIGH=4) 같은 숫자 필드를 추가해 그걸로 정렬. 문자열 순서에 의미론적 순위를 맡기면 안 됩니다.

---

## 🔴 Critical — `eligible` 빈 배열 시 하드코딩 fallback이 DB 기반 설계 취지를 무력화

```ts
return (eligible[0]?.providerKey ?? 'onprem') as ProviderKey
```

`eligible`이 비는 경우(예: 관리자가 온프렘을 `isActive: false`로 바꿨는데 G3 요청이 들어온 경우), 조용히 하드코딩된 `'onprem'`으로 넘어갑니다. 이건 "카탈로그 설정을 바꾸면 코드 수정 없이 라우팅이 바뀐다"는 수정3의 핵심 취지를 무너뜨립니다 — 카탈로그가 뭐라 하든 최후엔 하드코딩값으로 갑니다.

더 위험한 지점: 이 상황은 설정 오류 신호인데, 조용히 넘어가면 AX팀이 이 오류를 영영 모릅니다.

**수정**: `eligible`이 비면 조용히 fallback하지 말고 에러를 던지거나 알림을 발생시켜야 합니다. 특히 G3 요청인데 적격 프로바이더가 없다는 건 즉시 인지해야 하는 사고입니다.

---

## 🟠 High — `costKrw: Float` 재발

이 시리즈 초반(이슈K)에 정확히 이 이유로 `costKrw`를 `Decimal`로 바꿨습니다 — 금액에 `Float`을 쓰면 부동소수점 오차가 생깁니다. 이번에 신설된 `GatewayCallLog`에서 다시 `Float`으로 되돌아갔습니다.

**수정**: `costKrw Decimal` (SQLite이므로 `@db.Decimal` 어노테이션은 빼고 타입만 `Decimal`로 — 기존 결정 그대로 재적용).

---

## 🟡 Minor — `GATE3_RATIONALE`의 클라우드 선택도 같은 정렬 버그의 연쇄 효과

```ts
const cloud = eligible.find(p => p.hostType === 'CLOUD')
```

여러 클라우드 프로바이더가 다 적격이면 "가장 저렴한 클라우드"가 아니라 "정렬 순서상 먼저 걸리는 클라우드"를 고르게 됩니다. `costTier` 정렬을 고치면 이것도 같이 해결됩니다.

---

## 확인됨 — G3 강제 규칙 자체는 결과적으로 정상 작동

우회 분석 결과: G3 요청이면 `eligible`엔 온프렘만 남고(다른 프로바이더는 `maxConfidentiality='G2'`라 필터링됨), `GATE3_RATIONALE`이어도 `cloud` 조건에 해당하는 게 없어 `eligible[0]`(=onprem)으로 떨어집니다. **의도한 대로 G3는 항상 온프렘으로 갑니다.**

다만 이는 위 fallback 버그 덕에 "우연히 맞는" 경로입니다 — `eligible`이 정말 비는 예외 상황(관리자 설정 실수 등)엔 안전망이 없습니다.

---

## 다음 액션

| 항목 | 우선순위 |
|---|---|
| `costTier` → `costRank`(숫자) 정렬 기준 변경 | ★★★ 배포 블로커, 최우선 |
| `eligible` 빈 배열 시 에러/알림 처리로 변경 | ★★★ 배포 블로커 |
| `GatewayCallLog.costKrw` Float → Decimal | ★★ |
| 위 수정 후 G3 강제 규칙 재검증 (우연한 정상동작이 아닌 명시적 보장인지 확인) | ★★ |
