# Task 3 Report: WS-C — Samsung Knox 알림 연동 추상화 레이어

## 상태
DONE_WITH_CONCERNS

## 커밋 해시
(커밋 후 기재)

## tsc 결과
에러 1건 — `app/api/admin/console-summary/route.ts(56,21): error TS2352` (pre-existing, Task 3 무관)
Task 3 관련 파일 오류 없음.

## 변환된 notify() 호출 위치

| 파일 | 변환 내용 |
|------|-----------|
| `app/api/council/agenda/[id]/decide/route.ts` | `notify(email, title, body, link)` → `notify(event: NotifyEvent { type: 'GATE_TRANSITION' }, [email])` |
| `app/api/projects/[id]/appeal/route.ts` | 변환 없음 (하위 호환 시그니처 유지 — appeal 결과 알림은 이벤트 타입 매핑 불명확) |

## 변경 파일 목록
- `lib/notify.ts` — 전면 재작성: TypeScript 오버로드 패턴, `NotifyEvent` 인터페이스, Knox fetch 및 인앱 DB 저장 분리
- `app/api/council/agenda/[id]/decide/route.ts` — `NotifyEvent` import 추가, notify 호출 이벤트 기반 변환
- `.env.example` — Knox 섹션은 이미 존재 (Task 2 또는 사전 작업에서 추가됨, 변경 없음)

## 우려 사항
1. **pre-existing tsc 에러**: `console-summary/route.ts`의 타입 캐스팅 오류가 이전부터 존재. Task 3와 무관하나 CI 빌드가 이미 실패 상태일 수 있음.
2. **Knox API endpoint path**: 브리프에는 `${endpoint}/notify/send`로 구성했으나, `.env.example`의 `KNOX_API_ENDPOINT=https://knox.internal.example.com/api/notify`는 이미 경로 포함. 실제 Knox API 스펙 확인 후 path 중복 여부 검토 필요.
3. **appeal route 미변환**: `app/api/projects/[id]/appeal/route.ts`의 `notify()` 호출은 이벤트 타입이 `DATA_REQUEST_UPDATE`에 가깝지만, appeal은 데이터 요청이 아닌 프로젝트 이의제기이므로 타입 매핑이 모호해 레거시 시그니처 유지.
4. **Knox fetch 에러 처리**: `sendKnoxNotification`의 fetch 실패는 console.error만 기록하고 throw하지 않으므로 메인 트랜잭션 차단 없음. 단, Knox 전송 실패 감지/재시도 메커니즘 부재.
