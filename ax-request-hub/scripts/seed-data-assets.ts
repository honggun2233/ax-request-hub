/**
 * AX Hub v3 — 데이터 카탈로그 초기 시드
 * 실행: npx tsx scripts/seed-data-assets.ts
 * 재실행 안전 (name 기준 upsert 대용 — findFirst 후 skip)
 *
 * ⚠️ 아래는 개발·시연용 샘플이다. 실제 카탈로그는 데이터플랫폼팀 확인 후
 *    실자산 목록으로 교체할 것 (architecture v3 §21 — 기존 카탈로그 시스템
 *    존재 시 미러/연동 방식으로 전환).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ASSETS = [
  { name: "ETF 일별 기준가", description: "전 ETF 상품 일별 NAV·기준가·괴리율", ownerDept: "ETF운용본부", classification: "RESTRICTED", deliveryModes: "API,DB", updateCycle: "일배치" },
  { name: "펀드 상품 마스터", description: "공모·사모 펀드 상품 기본 정보 및 분류 체계", ownerDept: "상품전략팀", classification: "RESTRICTED", deliveryModes: "API,FILE", updateCycle: "일배치" },
  { name: "시장 지수 시계열", description: "국내외 주요 지수 일별 시계열 (10년)", ownerDept: "리서치센터", classification: "PUBLIC", deliveryModes: "API,FILE", updateCycle: "일배치" },
  { name: "고객 거래 집계 (익명화)", description: "채널별 거래 건수·금액 집계 — 개인 식별 불가 수준 익명화", ownerDept: "디지털혁신팀", classification: "RESTRICTED", deliveryModes: "FILE", updateCycle: "주배치" },
  { name: "운용 성과 원장", description: "펀드별 운용 성과·벤치마크 대비 실적", ownerDept: "성과평가팀", classification: "CONFIDENTIAL", deliveryModes: "DB", updateCycle: "일배치" },
  { name: "IT 예산 집행 내역", description: "IT 예산 항목별 편성·집행 현황", ownerDept: "IT업무개발팀", classification: "RESTRICTED", deliveryModes: "FILE", updateCycle: "월배치" },
  { name: "사내 규정·매뉴얼 코퍼스", description: "전사 규정·지침·매뉴얼 전문 (RAG 학습용)", ownerDept: "준법감시팀", classification: "RESTRICTED", deliveryModes: "FILE,API", updateCycle: "수시" },
  { name: "공시 문서 아카이브", description: "금감원·거래소 공시 문서 원문 및 메타", ownerDept: "리서치센터", classification: "PUBLIC", deliveryModes: "API", updateCycle: "실시간" },
  { name: "콜센터 상담 유형 통계", description: "상담 카테고리별 건수·처리시간 통계 (개인정보 제외)", ownerDept: "고객지원팀", classification: "RESTRICTED", deliveryModes: "FILE", updateCycle: "주배치" },
  { name: "리스크 지표 대시보드 원천", description: "VaR·듀레이션 등 리스크 지표 산출 원천 데이터", ownerDept: "리스크관리팀", classification: "CONFIDENTIAL", deliveryModes: "DB", updateCycle: "일배치" },
] as const;

async function main() {
  let created = 0, skipped = 0;
  for (const a of ASSETS) {
    const exists = await prisma.dataAsset.findFirst({ where: { name: a.name } });
    if (exists) { skipped++; continue; }
    await prisma.dataAsset.create({
      data: { ...a, classification: a.classification as any, isActive: true },
    });
    created++;
  }
  console.log(`✅ DataAsset 시드 완료 — 생성 ${created}건, 기존재 ${skipped}건`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
