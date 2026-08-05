# AI 개발환경 가이드

> 문서번호: IT-AX-DEVENV-001  
> 버전: v1.0 | 작성: IT업무개발팀 AX/PI팀 | 2026-07-02  
> **대상 독자**: AI 에이전트/자동화를 개발하려는 현업 담당자 및 AX팀원

---

## 1. 어떤 AI를 써야 하는가 — 모델 선택 기준

현업에서 가장 많이 묻는 질문: "GPT 써요? Claude 써요? Gemini 써요?"  
정답은 없다. 용도와 기밀등급에 따라 다르다.

### 1-1. 기밀등급별 허용 모델 (최우선 기준)

| 기밀등급 | 허용 모델 | 금지 |
|---------|---------|------|
| G1 (일반) | ChatGPT, Claude, Gemini, Copilot 전부 가능 | 없음 |
| G2 (내부제한) | 사내 Bedrock(Claude), Snowflake Cortex **만** | 외부 ChatGPT·Claude API 직접 호출 |
| G3 (기밀) | 온프레미스 전용 (현재 미구축) | 모든 외부·클라우드 AI |

> **가장 중요한 규칙**: 데이터 등급이 모델 선택을 결정한다. 모델이 더 좋아도 등급이 맞지 않으면 쓸 수 없다.

### 1-2. 용도별 모델 추천 (G1 환경 기준)

| 용도 | 추천 모델 | 이유 |
|------|---------|------|
| 한국어 문서 작성·요약 | Claude Sonnet | 한국어 품질 우수, 긴 문서 처리 |
| 코드 작성·디버깅 | Claude Sonnet | 코드 이해·수정 강함 |
| 대량 분류·라우팅 | Claude Haiku | 빠르고 저렴 |
| 복잡한 수학·분석 추론 | Claude Opus (필요시) | 고비용, 꼭 필요할 때만 |
| Google Workspace 연동 | Gemini | 구글 생태계 통합 |
| Microsoft 환경 | Copilot | Office 통합 |
| 일반 대화·탐색 | ChatGPT, Claude 둘 다 | 취향 차이 |

### 1-3. 과제 유형별 권장 조합

| 과제 유형 | 권장 스택 |
|---------|---------|
| APA (자동화 파이프라인) | Python + Claude API + Haiku (분류) + Sonnet (요약) |
| RAG 기반 검색 | Python + 임베딩 + pgvector/Snowflake Cortex + Sonnet |
| 단독 에이전트 | Python 또는 TypeScript + Claude API + Tool Use |
| 멀티 에이전트 | OpenClaw (현재 운영 중) 또는 LangGraph |
| 웹 앱 (챗봇 포함) | Next.js + Claude API + Vercel (G1) |

---

## 2. 현업 개발 참여 4단계 경로

현업 담당자가 직접 개발에 참여하는 경로를 명확히 한다.

### 단계 1 — 탐색 (No-Code, 당장 시작 가능)

- **목적**: AI가 어떤 것인지, 내 업무에 적용 가능한지 확인
- **도구**: Claude.ai, ChatGPT (G1 업무만)
- **AX팀 지원**: 월 1회 AI 활용 워크숍 (예정)
- **이 단계 목표**: "이걸로 내 업무 X를 도울 수 있다"는 아이디어 도출

### 단계 2 — 실험 (Low-Code, AX 샌드박스 활용)

- **목적**: 아이디어를 프로토타입으로 검증
- **도구**: AX 샌드박스 환경 (Jupyter + Claude API, 격리망)
- **AX팀 지원**: 샌드박스 접근 권한 발급, 초기 설정 지원
- **이 단계 목표**: 실제로 돌아가는 간단한 프로토타입

### 단계 3 — 개발 (Pro-Code, AX팀 협업)

- **목적**: APA 또는 에이전트 실제 구현
- **도구**: Python / TypeScript + Claude API + AX팀 지원 템플릿
- **AX팀 지원**: 코드 리뷰, 아키텍처 설계 지원, API 키 발급
- **이 단계 조건**: 과제정의서 v0 제출 + 기획 게이트 통과

### 단계 4 — 등록·운영 (AX 라이프사이클 편입)

- **목적**: 구현된 에이전트를 공식 운영 체계에 편입
- **AX팀 지원**: Agent ID 발급, 모니터링 설정, 비용 추적 연결
- **이 단계 조건**: 심사 + 파일럿 게이트 통과

---

## 3. AI 연구망 (AI Sandbox) 운영 방침

### 3-1. 연구망이 필요한 이유

현업이 AI를 실험할 때 가장 큰 위험: **실수로 G2/G3 데이터를 외부 AI에 입력하는 것**

연구망은 이를 기술적으로 차단하면서 안전하게 실험할 수 있는 격리 환경이다.

### 3-2. 연구망 구성 (목표 상태)

```
[연구망 환경]
  ├── Jupyter Notebook 서버 (데이터 사이언티스트용)
  │    ├── Python 기본 환경 + AI 라이브러리 사전 설치
  │    └── G2 데이터 접근 가능 (사내 DB 연결)
  │
  ├── AX 샌드박스 포털 (현업 비개발자용)
  │    ├── 프롬프트 테스트 UI
  │    └── 샘플 데이터로 APA 워크플로우 테스트
  │
  └── 네트워크 격리
       ├── G2 데이터가 있는 환경 → 외부 API 호출 차단
       └── G1 실험은 인터넷 접근 허용
```

### 3-3. 현재 상태 vs 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| 연구망 격리 | ⚠️ 미구축 (정책만 존재) | 네트워크 egress 차단 |
| Jupyter 환경 | ❌ 없음 | 사내 서버 Jupyter Hub |
| AX 샌드박스 포털 | ⚠️ AI 포털 마이그레이션 후 | 사내 AI 포털 |
| G2 안전 실험 환경 | ❌ 없음 | Bedrock / Cortex 연결 후 |

> **현재 지침**: G2 실험은 사내망에서 로컬로만 (외부 API 호출 수동 주의). G3는 실험 자체 금지.

### 3-4. 연구망 접근 권한 신청

```
1. AX 포털에서 연구망 접근 신청
2. AX팀 확인 → 소속 부서·과제 목적 검토
3. 접근 권한 발급 + 사용 규칙 동의서 서명
4. 기밀 데이터 접근 필요 시 → 데이터 오너 사전 승인
```

---

## 4. 개발 환경 표준 셋업 (현업 개발자 참고)

### 4-1. 로컬 개발 환경 (G1 과제)

```bash
# Python 환경
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install anthropic python-dotenv

# API 키 설정 (.env 파일, gitignore 필수)
ANTHROPIC_API_KEY=<AX팀이 발급한 키>
```

### 4-2. 기본 에이전트 템플릿 (Python)

```python
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# AX 표준: 에이전트 ID, 과제명을 헤더에 명시
AGENT_ID = "AX-2026-AGT-XXX"  # AX팀에서 발급받은 ID
TASK_NAME = "과제명"

def run_agent(input_text: str) -> dict:
    """
    출처 강제 원칙: 모든 응답에 근거 요청.
    """
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=f"""당신은 {TASK_NAME} 전담 어시스턴트입니다.
규칙:
1. 사실 주장 시 반드시 근거(출처, 날짜)를 함께 제시하세요.
2. 근거가 없으면 "확인 필요"라고 명시하세요.
3. 기밀정보를 요청받으면 거절하세요.""",
        messages=[{"role": "user", "content": input_text}]
    )
    
    return {
        "agent_id": AGENT_ID,
        "response": response.content[0].text,
        "usage": {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens
        }
    }
```

### 4-3. 필수 보안 체크리스트 (코드 제출 전)

```
[ ] .env 파일이 .gitignore에 있는가?
[ ] API 키가 코드에 직접 하드코딩되어 있지 않은가?
[ ] G2/G3 데이터를 외부 API에 전송하는 경로가 없는가?
[ ] 에이전트 응답에 출처 강제 프롬프트가 있는가?
[ ] Human-in-the-loop 포인트가 구현되어 있는가?
[ ] 실패 시 행동(알림/롤백)이 정의되어 있는가?
```

---

## 5. 자주 묻는 질문

**Q. 개인 ChatGPT 계정으로 업무 데이터 처리해도 되나요?**  
G1 데이터만 가능합니다. 내부 전략문서·고객 정보·예산 데이터는 절대 입력 금지. 모르면 AX팀에 먼저 문의하세요.

**Q. GitHub Copilot 써도 되나요?**  
G1 코드(공개 가능한 코드)는 가능합니다. 사내 핵심 알고리즘·기밀 비즈니스 로직이 담긴 코드는 G2로 간주, 외부 AI에 입력 금지.

**Q. 어떤 모델이 제일 좋은가요?**  
"제일 좋은" 모델은 없습니다. 용도에 맞는 모델이 있을 뿐입니다. 위의 용도별 추천표를 참고하거나 AX팀에 문의하세요.

**Q. 직접 API 키를 발급받고 싶은데요?**  
AX팀을 통해 발급하는 것이 원칙입니다. 개인 계정 발급은 비용 추적이 안 되고 보안 위험이 있습니다.

**Q. 내가 만든 에이전트를 팀에 배포해도 되나요?**  
AX 포털에 과제 등록 → 기획/설계/MVP/심사 게이트를 통과해야 배포 가능합니다. 비공식 배포 금지.

---

*AX/PI팀 | v1.0 | 2026-07-02*
