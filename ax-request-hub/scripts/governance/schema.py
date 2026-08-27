"""
AI 거버넌스 문서 메타데이터 스키마
================================
문서 체계: L1(규정) > L2(지침) > L3(가이드라인/운영기준)
청킹 단위: 조(條) 단위 — "1 chunk = 1 조문 + 문서 메타데이터"

설계 원칙
---------
1. 메타데이터(구조화 필드)와 벡터(임베딩)는 분리 저장, join key는 chunk_id
2. version은 항상 최신본만 벡터 검색에 노출 (구버전은 archive 플래그)
3. sync_target: SSOT(STANDARD) 참조 여부를 명시해 자동 동기화 체크 근거로 사용
4. 미승인 문서(approval_status=DRAFT)는 RAG 답변 시 "미승인 초안" 경고 문구 강제 첨부
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Optional


# ── 분류 체계 (제7조 유형, 제8조 위험등급과 매핑) ──────────────────

class DocType(str, Enum):
    REGULATION = "규정"        # L1 — AX-REGULATION, AX-COM
    POLICY = "지침"            # L2 — AX-POLICY
    GUIDELINE = "가이드라인"    # L3 — AX-OPS, AX-STD, AX-DEV
    STANDARD = "운영기준"       # L3 특수 — SSOT (수치·기한의 단일출처)


class ApprovalStatus(str, Enum):
    DRAFT = "미승인초안"        # 시행일="결재일부터" 표기 대상
    APPROVED = "승인시행"       # 시행일 확정, 결재일자 명시 가능


class RiskLevel(str, Enum):
    HIGH = "고위험"
    MEDIUM = "중위험"
    LOW = "저위험"
    NA = "해당없음"


# ── 문서 단위 메타데이터 (헤더 표에서 추출) ──────────────────────

@dataclass
class DocumentMetadata:
    doc_id: str                          # "AX-COM-2026-001"
    doc_name: str                        # "AI 위원회 규정"
    doc_type: DocType
    version: str                         # "v2.3"
    is_latest: bool                      # 이 버전이 최신인가 (검색 필터용)
    effective_date_note: str             # "결재일부터" or "2026-08-03" 등 원문 그대로
    approval_status: ApprovalStatus
    scope: Optional[str] = None          # 적용범위
    owner_dept: Optional[str] = None     # 담당부서
    based_on: list[str] = field(default_factory=list)   # 상위 근거 문서/조항 리스트
    sync_target: Optional[str] = None    # "AX-STANDARD-2026-001" — 이 문서가 따라야 할 SSOT
    file_path: str = ""


# ── 조문 단위 청크 (벡터화 대상의 최소 단위) ────────────────────

@dataclass
class ArticleChunk:
    chunk_id: str                # f"{doc_id}#[부칙-]{article_no}" — 부칙 여부로 네임스페이스 분리
    doc_id: str                  # 상위 문서 참조 (메타데이터 join key)
    chapter: Optional[str]       # "제5장 에이전트 통제" (없으면 None)
    article_no: str              # "제9조" / "제12조의2"
    article_title: str           # "(에이전트 통제 원칙)"
    text: str                    # 조문 본문 전체 (하위 항·호 포함)
    is_addendum: bool = False    # 부칙 조항 여부 — 본문과 번호가 겹치므로(제1조 등) 반드시 구분
    risk_level: RiskLevel = RiskLevel.NA
    references: list[str] = field(default_factory=list)  # 본문 내 "제N조" 상호참조 추출값
    # 벡터DB에는 embedding(text) 결과만 별도 저장, 여기엔 메타만 유지
    version: str = ""            # 소속 문서 버전 상속 (필터링용 중복 저장 — 조회 성능 트레이드오프)
    is_latest: bool = True


# ── 충돌탐지용 링크 (동일 사안을 다루는 조문 간 대응관계) ────────

@dataclass
class CrossRefLink:
    """
    같은 주제를 다루는 서로 다른 문서의 조문을 명시적으로 연결.
    예: ax-pol-2026-001#제12조의2 ↔ ax-std-2026-001#데이터신청트랙표
    → 값이 다르면 배치 스캔에서 CRITICAL 알림
    """
    topic: str                   # "G3 Track B 승인권자"
    chunk_ids: list[str]         # 관련 chunk_id 리스트 (2개 이상)
    ssot_chunk_id: Optional[str] = None   # 이 중 SSOT로 간주할 chunk (있으면)
