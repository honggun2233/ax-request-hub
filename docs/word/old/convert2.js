// ─────────────────────────────────────────────────────────────────────────────
// 삼성자산운용 AI 거버넌스 문서셋 → DOCX 변환 (v2, 스타일 개선)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const fs   = require('fs');
const path = require('path');
const ROOT = 'C:/Users/Samsung/AppData/Roaming/npm/node_modules/docx';
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, HeadingLevel, AlignmentType, BorderStyle, WidthType,
  ShadingType, LevelFormat, PageNumber, PageBreak, VerticalAlign,
} = require(ROOT);

const DOCS = 'C:/project/ax-team/docs';
const OUT  = 'C:/project/ax-team/docs/word';

// ── 삼성자산운용 컬러 팔레트 ──────────────────────────────────────────────────
const C = {
  navyDark : '1A3C6E',   // 주 타이틀, H1 배경
  navyMid  : '0066CC',   // H2, 강조
  navyLight: '0070C0',   // H3, 부제목
  fillHead : '1A3C6E',   // 테이블 헤더 배경 (white text)
  fillRow  : 'DCE6F1',   // 테이블 짝수행 (연파랑)
  fillAlt  : 'F5F8FC',   // 섹션 배경
  white    : 'FFFFFF',
  textDark : '1F1F1F',
  textGray : '595959',
  lineGray : 'CCCCCC',
  coverLine: '1A3C6E',
};

// A4 DXA (1440 = 1 inch)
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN_L = 1700, MARGIN_R = 1440, MARGIN_T = 1440, MARGIN_B = 1440;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;  // 8766 DXA

// ── 공통 스타일 정의 ───────────────────────────────────────────────────────────
function getStyles() {
  return {
    default: {
      document: { run: { font: 'Malgun Gothic', size: 22, color: C.textDark } }
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
        run: { size: 34, bold: true, font: 'Malgun Gothic', color: C.navyDark },
        paragraph: {
          spacing: { before: 400, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.navyDark, space: 4 } }
        }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
        run: { size: 26, bold: true, font: 'Malgun Gothic', color: C.navyMid },
        paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
        run: { size: 23, bold: true, font: 'Malgun Gothic', color: C.navyLight },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 }
      },
      {
        id: 'CoverTitle', name: 'Cover Title', basedOn: 'Normal',
        run: { size: 60, bold: true, font: 'Malgun Gothic', color: C.navyDark },
        paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 600, after: 200 } }
      },
    ]
  };
}

function getNumbering() {
  return {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: 'Symbol' } }
        }]
      },
      {
        reference: 'bullets2',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } }
        }]
      },
    ]
  };
}

// ── 헤더 / 푸터 ────────────────────────────────────────────────────────────────
function makeHeader(docTitle) {
  return new Header({
    children: [new Paragraph({
      children: [
        new TextRun({ text: '삼성자산운용 주식회사', font: 'Malgun Gothic', size: 18, bold: true, color: C.navyDark }),
        new TextRun({ text: '  |  ', font: 'Malgun Gothic', size: 18, color: C.lineGray }),
        new TextRun({ text: docTitle, font: 'Malgun Gothic', size: 18, color: C.textGray }),
        new TextRun({ text: '\t내부용', font: 'Malgun Gothic', size: 18, color: C.textGray }),
      ],
      tabStops: [{ type: 'right', position: CONTENT_W }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.navyDark, space: 2 } },
      spacing: { after: 80 },
    })]
  });
}

function makeFooter() {
  return new Footer({
    children: [new Paragraph({
      children: [
        new TextRun({ text: 'AX/PI센터 AX팀  |  2026-07-06  |  ', font: 'Malgun Gothic', size: 16, color: C.textGray }),
        new TextRun({ children: [PageNumber.CURRENT], font: 'Malgun Gothic', size: 16, color: C.textGray }),
        new TextRun({ text: ' / ', font: 'Malgun Gothic', size: 16, color: C.textGray }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Malgun Gothic', size: 16, color: C.textGray }),
      ],
      alignment: AlignmentType.RIGHT,
      border: { top: { style: BorderStyle.SINGLE, size: 3, color: C.navyDark, space: 2 } },
      spacing: { before: 80 },
    })]
  });
}

// ── 표지 페이지 ────────────────────────────────────────────────────────────────
function makeCoverPage(title, docNo, version, category) {
  const spacer = (n) => new Paragraph({ children: [new TextRun('')], spacing: { after: n } });
  return [
    spacer(1200),
    new Paragraph({
      children: [new TextRun({ text: '삼성자산운용 주식회사', font: 'Malgun Gothic', size: 26, bold: true, color: C.textGray })],
      spacing: { after: 40 }
    }),
    new Paragraph({
      children: [new TextRun({ text: 'AX/PI센터 AX팀', font: 'Malgun Gothic', size: 24, color: C.textGray })],
      spacing: { after: 240 }
    }),
    // 구분선
    new Paragraph({
      children: [new TextRun('')],
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.navyDark, space: 1 } },
      spacing: { after: 280 }
    }),
    // 문서 제목
    new Paragraph({
      children: [new TextRun({ text: title, font: 'Malgun Gothic', size: 60, bold: true, color: C.navyDark })],
      spacing: { after: 160 }
    }),
    spacer(80),
    // 메타 정보 테이블
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [2600, 6166],
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                 left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                 insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
      rows: [
        metaRow('문서번호', docNo),
        metaRow('버전', version),
        metaRow('최종 수정', '2026-07-06'),
        metaRow('문서 분류', category),
        metaRow('소관 부서', 'AX/PI센터 AX팀'),
      ]
    }),
    spacer(600),
    // 내부용 배지
    new Paragraph({
      children: [new TextRun({ text: '🔒 내부용 (Internal Use Only)', font: 'Malgun Gothic', size: 20, color: C.textGray })],
      spacing: { after: 80 }
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function metaRow(label, value) {
  const cell = (txt, bold) => new TableCell({
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
               left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    margins: { top: 60, bottom: 60, left: 0, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: txt, font: 'Malgun Gothic', size: 22, bold: !!bold, color: bold ? C.navyDark : C.textDark })] })]
  });
  return new TableRow({ children: [cell(label, true), cell(value, false)] });
}

// ── 테이블 생성 헬퍼 ─────────────────────────────────────────────────────────
function mkBorder(color) {
  return { style: BorderStyle.SINGLE, size: 2, color: color || C.lineGray };
}

function tblBorders(color) {
  const b = mkBorder(color);
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
}

function mkCell(text, { fill, textColor, bold, colSpan, width, align, size } = {}) {
  const b = mkBorder(fill && fill !== C.white ? fill : C.lineGray);
  return new TableCell({
    columnSpan: colSpan,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: { fill: fill || C.white, type: ShadingType.CLEAR },
    borders: { top: b, bottom: b, left: b, right: b },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align || AlignmentType.LEFT,
      children: inlineRuns(text, { color: textColor || (fill === C.fillHead ? C.white : C.textDark), bold: bold || fill === C.fillHead, size: size || 20 })
    })]
  });
}

function mkTable(rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    borders: tblBorders(C.lineGray),
    rows: rows.map((row, ri) => new TableRow({
      children: row.map((cell, ci) => {
        if (typeof cell === 'object' && cell._isCell) return cell;
        return mkCell(String(cell), {
          fill: ri === 0 ? C.fillHead : (ri % 2 === 0 ? C.fillRow : C.white),
          width: colWidths[ci],
        });
      })
    }))
  });
}

// ── 인라인 텍스트 파서 (볼드/코드) ─────────────────────────────────────────────
function inlineRuns(text, defaults = {}) {
  const runs = [];
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), font: 'Malgun Gothic', size: defaults.size || 22, color: defaults.color || C.textDark }));
    if (m[2]) runs.push(new TextRun({ text: m[2], bold: true, font: 'Malgun Gothic', size: defaults.size || 22, color: defaults.color || C.navyDark }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], font: 'Courier New', size: (defaults.size || 22) - 2, color: C.textDark }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), font: 'Malgun Gothic', size: defaults.size || 22, color: defaults.color || C.textDark, bold: defaults.bold || false }));
  return runs.length ? runs : [new TextRun({ text: '', font: 'Malgun Gothic', size: 22 })];
}

function p(text, { bold, color, size, indent, align, before, after } = {}) {
  return new Paragraph({
    alignment: align,
    indent: indent ? { left: indent } : undefined,
    spacing: { before: before || 60, after: after || 60 },
    children: inlineRuns(text || '', { bold, color, size })
  });
}

function spacer(px = 120) {
  return new Paragraph({ children: [new TextRun('')], spacing: { after: px } });
}

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: inlineRuns(text), spacing: { before: 400, after: 160 } }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: inlineRuns(text), spacing: { before: 280, after: 100 } }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(text), spacing: { before: 200, after: 80 } }); }

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: level === 0 ? 'bullets' : 'bullets2', level: 0 },
    children: inlineRuns(text),
    spacing: { before: 40, after: 40 },
  });
}

// ── 마크다운 파서 (일반 문서용) ──────────────────────────────────────────────
function parseMd(md) {
  const elems = [];
  const lines = md.split('\n');
  let i = 0, tblBuf = [], codeBuf = [], inCode = false;

  function flushTable() {
    if (!tblBuf.length) return;
    const dataRows = tblBuf.filter(r => !/^[\s|:\-]+$/.test(r.replace(/\|/g, '').trim()));
    if (!dataRows.length) { tblBuf = []; return; }
    const parsed = dataRows.map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    const cols = Math.max(...parsed.map(r => r.length));
    const colW = Math.floor(CONTENT_W / cols);
    const colWidths = Array(cols).fill(colW);
    colWidths[cols - 1] += CONTENT_W - colW * cols;
    elems.push(spacer(60));
    elems.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: colWidths,
      borders: tblBorders(C.lineGray),
      rows: parsed.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => new TableCell({
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: { fill: ri === 0 ? C.fillHead : (ri % 2 === 0 ? C.fillRow : C.white), type: ShadingType.CLEAR },
          borders: tblBorders(C.lineGray),
          margins: { top: 100, bottom: 100, left: 160, right: 160 },
          children: [new Paragraph({ children: inlineRuns(cell, { color: ri === 0 ? C.white : C.textDark, bold: ri === 0, size: 20 }) })]
        }))
      }))
    }));
    elems.push(spacer(80));
    tblBuf = [];
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (inCode) {
        const codeText = codeBuf.join('\n');
        elems.push(new Paragraph({
          children: [new TextRun({ text: codeText, font: 'Courier New', size: 18, color: C.textDark })],
          shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
          spacing: { before: 80, after: 80 },
          indent: { left: 360 },
        }));
        codeBuf = []; inCode = false;
      } else { flushTable(); inCode = true; }
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }
    if (line.trim().startsWith('|')) { tblBuf.push(line.trim()); i++; continue; }
    else flushTable();

    const h1m = line.match(/^# (.+)$/);
    const h2m = line.match(/^## (.+)$/);
    const h3m = line.match(/^### (.+)$/);
    if (h1m) { elems.push(h1(h1m[1])); i++; continue; }
    if (h2m) { elems.push(h2(h2m[1])); i++; continue; }
    if (h3m) { elems.push(h3(h3m[1])); i++; continue; }
    if (line.trim().startsWith('>')) {
      const t = line.replace(/^>\s?/, '').trim();
      if (t) elems.push(p(t, { color: C.textGray, size: 20, indent: 720 }));
      i++; continue;
    }
    if (line.match(/^- /)) { elems.push(bullet(line.replace(/^- /, ''))); i++; continue; }
    if (line.match(/^\s{2,}- /)) { elems.push(bullet(line.replace(/^\s+- /, ''), 1)); i++; continue; }
    if (line.match(/^\d+\. /)) { elems.push(p(line, { indent: 720 })); i++; continue; }
    if (line.trim() === '---') { i++; continue; }
    if (line.trim() === '') { elems.push(spacer(80)); i++; continue; }
    elems.push(p(line.trim()));
    i++;
  }
  flushTable();
  return elems;
}

// ── 구조도 전용 빌더 (Word 네이티브) ─────────────────────────────────────────
function buildDiagramDoc() {
  const elems = [];

  // ── 1. 문서 계층 및 독자 ──────────────────────────────────────────────────
  elems.push(h1('1. 문서 계층 및 독자'));
  elems.push(p('5개 문서는 계층적으로 연결되며, 각각 다른 독자층과 목적을 가진다.'));
  elems.push(spacer());

  // 의사결정 레이어 박스
  const layerHeaderCell = (label) => new TableCell({
    columnSpan: 4,
    shading: { fill: C.navyDark, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 200, right: 200 },
    children: [new Paragraph({ children: [new TextRun({ text: label, font: 'Malgun Gothic', size: 22, bold: true, color: C.white })] })]
  });

  function docRow(fill, docName, ver, desc, audience) {
    return new TableRow({ children: [
      new TableCell({ width: { size: 2800, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: [new Paragraph({ children: [new TextRun({ text: docName, font: 'Malgun Gothic', size: 22, bold: true, color: fill === C.fillHead ? C.white : C.navyDark })] })] }),
      new TableCell({ width: { size: 700,  type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 120, right: 120 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ver, font: 'Malgun Gothic', size: 20, color: fill === C.fillHead ? C.white : C.textGray })] })] }),
      new TableCell({ width: { size: 4500, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: [new Paragraph({ children: [new TextRun({ text: desc, font: 'Malgun Gothic', size: 20, color: fill === C.fillHead ? C.white : C.textDark })] })] }),
      new TableCell({ width: { size: 1766, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: audience, font: 'Malgun Gothic', size: 20, color: fill === C.fillHead ? C.white : C.textGray })] })] }),
    ]});
  }

  const bord = mkBorder(C.lineGray);
  elems.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [2800, 700, 4500, 1766],
    borders: { top: bord, bottom: bord, left: bord, right: bord, insideH: bord, insideV: bord },
    rows: [
      new TableRow({ children: [layerHeaderCell('▲ 의사결정 레이어')] }),
      docRow(C.fillRow, '운영방안_AX위원회.md', 'v2.1', '규정 개정 심의·의결 / 고위험 AI 최종 승인 / 반기 보고 수령 / 정책 방향 결정', '경영진·임원'),
      new TableRow({ children: [new TableCell({ columnSpan: 4, shading: { fill: 'E8F0FB', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 200, right: 200 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '▼ 보고 / 상정', font: 'Malgun Gothic', size: 20, bold: true, color: C.navyMid })] })] })] }),
      new TableRow({ children: [layerHeaderCell('▼ 거버넌스 문서 레이어')] }),
      new TableRow({ children: [
        mkCell('규정_AI_거버넌스.md', { fill: C.fillHead, width: 2800 }),
        mkCell('v6.3', { fill: C.fillHead, width: 700, align: AlignmentType.CENTER }),
        mkCell('WHY & WHAT — AI Native 원칙 · 금지사항 · 위험 분류 · 에이전트 유형 · 기밀등급', { fill: C.fillHead, width: 4500 }),
        mkCell('전 임직원', { fill: C.fillHead, width: 1766 }),
      ]}),
      new TableRow({ children: [new TableCell({ columnSpan: 4, shading: { fill: 'E8F0FB', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 200, right: 200 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '↓ 참조', font: 'Malgun Gothic', size: 20, bold: true, color: C.navyMid })] })] })] }),
      docRow(C.white, '지침_AI_거버넌스.md', 'v7.7', 'HOW — Phase 0~6 과제 게이트 · Agent 라이프사이클 · R&R 매트릭스 · 비용/토큰 관리 · CREW 이관 기준 · 우수 에이전트 보상 · 암묵지 성숙도 평가', 'AX팀 · AI CREW · 현업 부서장'),
      new TableRow({ children: [new TableCell({ columnSpan: 4, shading: { fill: 'E8F0FB', type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 200, right: 200 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '↓ 참조', font: 'Malgun Gothic', size: 20, bold: true, color: C.navyMid })] })] })] }),
      docRow(C.fillRow, '가이드라인_AI_거버넌스.md', 'v5.1', '실무 적용 — 솔루션 유형 선택 · Kill Switch 구현 · 감사 로그 · 개발 환경 · 보안 체크리스트', 'AI CREW · 현업 개발 참여자'),
    ]
  }));
  elems.push(spacer(160));

  // ── 2. 핵심 플로우 — 과제 → 에이전트 → 보상 ───────────────────────────────
  elems.push(h1('2. 핵심 플로우 — 과제 → 에이전트 → 보상'));
  elems.push(spacer());

  const flowData = [
    ['단계', '현업 (AI CREW)', 'AX팀', '데이터플랫폼팀', 'AX 위원회'],
    ['Phase 0~2\n탐색·실험', '과제 아이디어 발굴\nG1 자율 운용', '과제 신청 접수\n스코어카드 평가·결과 통보', '—', '—'],
    ['Phase 3\nMVP 개발', '합성 데이터 검증 협조', 'AX 엔지니어 개발 주도\n(이관 완성도 5항목 체크)', '샘플 데이터 제공', '—'],
    ['Phase 4\n심사', '이해관계자 확인\n현업 승인', '심사 보고서 작성\n위험 평가', '—', '—'],
    ['Phase 5\n파일럿', 'UAT 수행\nKPI 측정·피드백', '임시 ID (AX-DEV-) 발급\n파일럿 운영 지원', 'G1/G2 실데이터 제공\nSLA 보장', '—'],
    ['Phase 6\n운영 (일반)', '현업 활용\n이상 신고', '정식 ID (AX-YYYY-AGT-) 발급\n모니터링·개선·폐기 판단', '전체 접근권한 갱신', '—'],
    ['Phase 6\n운영 (고위험)', '현업 활용', '정식 ID 발급\n위원회 안건 상정', '—', '투자·운용·공시·컴플라이언스\n해당 과제 최종 승인'],
    ['분기 보상\n심사', '—', '우수 에이전트 5기준 심사\n(KPI·ROI·지속활용·문서화·혁신)', '—', '—'],
    ['반기 보고', '—', '과제 현황·KPI·비용\n암묵지 성숙도 평가 보고', '—', '보고 수령\n개선 지시'],
  ];
  const fw = [1400, 1800, 2200, 1600, 1766];
  elems.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: fw,
    borders: tblBorders(C.lineGray),
    rows: flowData.map((row, ri) => new TableRow({
      children: row.map((cell, ci) => new TableCell({
        width: { size: fw[ci], type: WidthType.DXA },
        shading: { fill: ri === 0 ? C.fillHead : (ri % 2 === 0 ? C.fillRow : C.white), type: ShadingType.CLEAR },
        borders: tblBorders(C.lineGray),
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        verticalAlign: VerticalAlign.CENTER,
        children: cell.split('\n').map(line => new Paragraph({ children: [new TextRun({ text: line, font: 'Malgun Gothic', size: 19, color: ri === 0 ? C.white : C.textDark, bold: ri === 0 })] }))
      }))
    }))
  }));
  elems.push(spacer(160));

  // ── 3. Agent ID · 라이프사이클 매핑 ─────────────────────────────────────────
  elems.push(h1('3. Agent ID · 라이프사이클 매핑'));
  elems.push(h2('3-1. Agent ID 발급 체계'));

  const idData = [
    ['상황', 'ID 유형', '발급 주체', '데이터 접근'],
    ['G1 개인 실험 (Phase 0~2)', '없음', '—', 'G1만 (샌드박스 권장)'],
    ['G1 팀 공유 PoC (Phase 3~4)', '없음', 'AX팀 인식·등록만', 'G1, 샘플 데이터'],
    ['Phase 5 파일럿', 'AX-DEV-YYYY-XXX (임시)', 'AX팀', 'G1/G2, 제한 실데이터'],
    ['Phase 6 운영', 'AX-YYYY-AGT-XXX (정식)', 'AX팀', '설계 기준 전체 접근'],
    ['멀티 에이전트 서브', 'AX-YYYY-MAS-XXX-SUB-A', 'AX팀', '오케스트레이터 범위 이하'],
  ];
  elems.push(mkTable(idData, [2400, 2800, 1400, 2166]));
  elems.push(spacer());

  elems.push(h2('3-2. 생성 라이프사이클 (Phase Gate)'));
  const lcData = [
    ['Phase', '명칭', 'ID 상태', '에이전트 상태', 'AX팀 역할'],
    ['0', '발굴', '없음', '—', '존재 인식'],
    ['1', '기획', '없음', '—', '과제 등록·스코어카드 평가'],
    ['2', '설계', '없음', '—', '기술 검토·설계 지원'],
    ['3', 'MVP', '없음', '개발 중', 'AX 엔지니어 주도 개발'],
    ['4', '심사', '없음', '심사 중', '심사 보고서 작성'],
    ['5', '파일럿', 'AX-DEV- (임시)', '🟡 등록신청', '임시 ID 발급·파일럿 운영'],
    ['6', '운영', 'AX-YYYY-AGT- (정식)', '🟢 Active', '정식 ID 발급·KPI 모니터링'],
  ];
  elems.push(mkTable(lcData, [600, 1000, 2200, 1400, 3566]));
  elems.push(spacer());

  elems.push(h2('3-3. 관리 라이프사이클 (상태 머신)'));
  const smData = [
    ['상태 전환', '조건', 'AX팀 역할', '데이터플랫폼팀 역할'],
    ['→ 🟡 등록신청', 'Phase 5 파일럿 진입 승인', '임시 ID 발급, 인벤토리 신규 등록', '제한 실데이터 접근 권한 부여'],
    ['🟡 → 🟢 Active', 'Phase 6 운영 승격', '정식 ID 교체, KPI 모니터링 활성화', '전체 접근권한 갱신'],
    ['🟢 → 🔵 Suspended', '사고·점검·업무 변화', '원인 분석, 접근권한 일시 차단', '데이터 접근 일시 차단'],
    ['🔵 → 🟢 Active', '원인 해소 후 복구 승인', '복구 검토, 재활성화', '접근권한 복구'],
    ['* → 🔴 Retired', '폐기 기준 충족', 'ID 비활성화, 인벤토리 폐기 등록', '접근권한 전체 회수'],
  ];
  elems.push(mkTable(smData, [1800, 1900, 2300, 2766]));
  elems.push(spacer(160));

  // ── 4. 암묵지 데이터화 성숙도 평가 ─────────────────────────────────────────
  elems.push(h1('4. 암묵지 데이터화 성숙도 평가 (3차원)'));
  elems.push(p('AI Native 조직의 핵심 지표는 "얼마나 썼는가"가 아니라 쓴 만큼 조직 지식이 축적됐는가이다.'));
  elems.push(spacer());

  const matData3 = [
    ['차원 1 — 지식 포착\n[분기 / 정량]', '차원 2 — 활용·재사용\n[반기 / 정량]', '차원 3 — 조직 역량\n[반기 / 정성]'],
    ['지표\n· 과제 정의서 완료율 ≥ 80%\n· 프롬프트 문서화율 100%\n· 감사로그 충족율 ≥ 90%\n· 실패 리뷰 분기 1건 이상', '지표\n· Prompt Caching 적용률 ≥ 50%\n· 이관 후 재작업률 ≤ 30%\n· 과거 사례 참조 반기 3건 이상', '지표\n· 신규 CREW 온보딩 기간 단축\n· 핵심인력 이탈 후 업무 연속성\n· 에이전트 자립도 심사'],
    ['미달 시\nAX팀이 보완 요청.\n과제 정의서 미작성 시 다음 Phase 진행 불가.', '미달 시\n재작업률 30% 초과 → CREW 이관 전 완성도 기준 재교육 대상.', '미달 시\nContext 외재화 작업을 다음 분기 필수 과제로 등록.'],
    ['목표 2개 미달 부서', '→ 다음 반기 과제 등록 상한 1건으로 제한', '반기 AX 위원회 보고 (차원 1·2 집계 + 차원 3 정성)'],
  ];
  const cw3 = [2922, 2922, 2922];
  elems.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: cw3,
    borders: tblBorders(C.lineGray),
    rows: matData3.map((row, ri) => new TableRow({
      children: row.map((cell, ci) => new TableCell({
        width: { size: cw3[ci], type: WidthType.DXA },
        shading: { fill: ri === 0 ? C.fillHead : (ri === 3 ? C.fillRow : C.white), type: ShadingType.CLEAR },
        borders: tblBorders(C.lineGray),
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: cell.split('\n').map((line, li) => new Paragraph({
          children: [new TextRun({ text: line, font: 'Malgun Gothic', size: 20, color: ri === 0 ? C.white : C.textDark, bold: ri === 0 || li === 0 })]
        }))
      }))
    }))
  }));
  elems.push(spacer(160));

  // ── 5. 문서 간 조항 연결 매핑 ─────────────────────────────────────────────
  elems.push(h1('5. 문서 간 조항 연결 매핑'));
  elems.push(p('각 문서의 조항이 다른 문서의 어느 부분과 연결되는지를 보여준다.'));
  elems.push(spacer());

  elems.push(h2('규정 → 지침'));
  const r2g = [
    ['규정 조항', '지침 참조 위치', '연결 내용'],
    ['제3조 AI Native 원칙', '제8장 암묵지 3차원 평가', '"토큰 소비 ≠ AI 투자" 원칙 → 측정 지표 구체화'],
    ['제4조 솔루션 유형 0~4', '제2장 Phase Gate, 제6장 위험통제', '유형별 적용 Phase·통제 요건 결정'],
    ['제5조 데이터 기밀등급', '제8장 API키 관리, 제11장 배포 환경', 'G1 셀프발급 허용 / G3 온프레미스 전용 기준'],
    ['제6조 위험 업무 분류', '제6장 위험등급별 통제 요건, 제2장 Phase Gate', '위험등급 결정 → 통제 요건 적용'],
    ['제7조 에이전트 원칙', '제7장 라이프사이클, 제10장 제22조', 'Kill Switch / 감사 추적 / 최소 권한 구현 의무'],
    ['제8조 절대 금지사항', '제10장 제22조 4번 (최소 권한)', 'G3 외부 전송 금지 / Agent ID 없는 운영 금지'],
    ['제9조 AX 위원회', '제3장 AX 위원회 상정 절차, 제13장 R&R', '고위험 과제 상정 → 위원회 운영방안 연계'],
  ];
  elems.push(mkTable(r2g, [2200, 2600, 3966]));
  elems.push(spacer());

  elems.push(h2('지침 → 가이드라인'));
  const g2guide = [
    ['지침 조항', '가이드라인 참조 위치', '연결 내용'],
    ['제6장 감사 로그 필드 정의', '감사 로그 구현 패턴', '필드 스키마(7개) → 코드 구현 예시'],
    ['제7장 Kill Switch 구현 의무', 'Kill Switch 구현 예시', 'Circuit Breaker 패턴 → 실무 코드'],
    ['제10장 제21조 (기획자 역할)', 'AX 기획자 실무 가이드', '과제 정의서 작성 지원 → 체크리스트'],
    ['제10장 제22조 (엔지니어 기준)', 'AX 엔지니어 실무 가이드', '개발 기준 7항목 → 보안 체크리스트'],
    ['제11장 배포 환경 결정', '배포 환경 선택 체크리스트', '결정 트리(GPT/AWS/온프레미스) → 체크리스트'],
  ];
  elems.push(mkTable(g2guide, [2200, 2600, 3966]));
  elems.push(spacer());

  elems.push(h2('지침 → 운영방안_AX위원회'));
  const g2gov = [
    ['지침 조항', '운영방안 참조 위치', '연결 내용'],
    ['제3장 AX 위원회 상정 절차', '제3조 임무 ②, 제4조 회의 운영', '고위험 과제 → 임시/정기 회의 안건 상정'],
    ['제6장 운영 승격 기준 (고위험)', '제3조 임무 ② 대상 목록', '투자·운용·공시·컴플 → 위원회 의결 필수'],
    ['제8장 암묵지 3차원 평가', '제3조 임무 ③ 반기 보고', '차원 1·2 집계 + 차원 3 정성 결과 보고'],
    ['제13장 에스컬레이션 기준', '제4조 임시회의 소집 조건', 'G3 포함 / 보안 사고 → 임시회의 트리거'],
  ];
  elems.push(mkTable(g2gov, [2200, 2600, 3966]));
  elems.push(spacer(160));

  // ── 6. 핵심 개념 정의 위치 인덱스 ─────────────────────────────────────────
  elems.push(h1('6. 핵심 개념 정의 위치 인덱스'));
  elems.push(p('검색어를 모를 때 이 인덱스에서 개념 → 문서 위치를 찾는다.'));
  elems.push(spacer());

  const idxData = [
    ['개념', '정의 위치', '상세 기준 위치', '실무 구현 위치'],
    ['AI Native 원칙', '규정 제3조', '지침 제8장 암묵지 평가', '—'],
    ['솔루션 유형 0~4', '규정 제4조', '지침 제2장·제6장', '가이드라인 유형 선택'],
    ['데이터 기밀등급 G1/G2/G3', '규정 제5조', '지침 제8장(API키), 제11장(배포)', '가이드라인 보안 체크'],
    ['위험등급 고/중/저', '규정 제6조', '지침 제6장 통제 요건', '가이드라인 위험 결정 트리'],
    ['AX 위원회', '규정 제9조', '운영방안_AX위원회.md', '지침 제3장 상정 절차'],
    ['Phase Gate 0~6', '지침 제2장', '지침 제3·6·10장', '가이드라인 플로우'],
    ['Agent ID 체계', '지침 제7-2장', '지침 제7-3/7-4장 라이프사이클', '가이드라인 예시'],
    ['AI CREW 등급 (Lv.1/2/3)', '지침 제1장', '지침 제10장·제8장', '가이드라인 등급별 가이드'],
    ['CREW 이관 완성도 5항목', '지침 제19조', '—', '가이드라인 체크리스트'],
    ['암묵지 3차원 평가', '지침 제8장', '—', '운영방안 반기 보고'],
    ['우수 에이전트 보상 (5기준)', '지침 제14장', '—', '—'],
    ['Kill Switch', '규정 제7조', '지침 제7-1/7-4장', '가이드라인 구현 예시'],
    ['감사 로그', '규정 제7조', '지침 제6장 필드 정의', '가이드라인 구현 패턴'],
    ['스코어카드 6차원 (100점)', '지침 제5장', '—', '—'],
  ];
  elems.push(mkTable(idxData, [2400, 2000, 2600, 1766]));
  elems.push(spacer(160));

  // ── 7. 버전 현황 ────────────────────────────────────────────────────────────
  elems.push(h1('7. 문서 버전 현황'));
  const verData = [
    ['문서', '문서번호', '버전', '핵심 최근 변경 (2026-07-06)'],
    ['규정_AI_거버넌스.md', 'IT-AX-REG-001', 'v6.3', 'AI Native 원칙 신설, AX 위원회 명칭 변경'],
    ['지침_AI_거버넌스.md', 'IT-AX-OPS-002', 'v7.7', '이관 완성도 5기준(v7.5), 암묵지 평가 3차원(v7.7), 제13·14장 신설'],
    ['가이드라인_AI_거버넌스.md', 'IT-AX-GUIDE-003', 'v5.1', 'AX 위원회 명칭 반영'],
    ['운영방안_AX위원회.md', 'IT-AX-GOV-001', 'v2.1', 'AI→AX 위원회 명칭 변경, 위원장 외 구성원 미설정'],
    ['AI_거버넌스_문서_구조도.md', '(참고)', 'v1.1', '문서 간 조항 연결 매핑, 핵심 개념 인덱스 신설'],
  ];
  elems.push(mkTable(verData, [2800, 1700, 900, 3366]));

  return elems;
}

// ── 문서 빌더 ─────────────────────────────────────────────────────────────────
const COVERS = {
  '규정_AI_거버넌스.md':       ['AI 거버넌스 규정', 'IT-AX-REG-001', 'v6.3', '사규 (전사 적용)'],
  '지침_AI_거버넌스.md':       ['AI 거버넌스 지침', 'IT-AX-OPS-002', 'v7.7', '운영 지침 (AX팀·CREW·부서장)'],
  '가이드라인_AI_거버넌스.md': ['AI 거버넌스 가이드라인', 'IT-AX-GUIDE-003', 'v5.1', '실무 가이드 (AI CREW·개발 참여자)'],
  '운영방안_AX위원회.md':      ['AX 위원회 운영방안', 'IT-AX-GOV-001', 'v2.1', '위원회 운영 규정 (위원회·AX팀)'],
  'AI_거버넌스_문서_구조도.md':['AI 거버넌스 문서 구조도', '(참고)', 'v1.1', '참고 자료 (전 이해관계자)'],
};

async function buildDoc(filename, isMap) {
  const [title, docNo, version, category] = COVERS[filename];
  const cover = makeCoverPage(title, docNo, version, category);
  const body  = isMap ? buildDiagramDoc()
                      : parseMd(fs.readFileSync(path.join(DOCS, filename), 'utf8'));
  return new Document({
    numbering: getNumbering(),
    styles: getStyles(),
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN_T, right: MARGIN_R, bottom: MARGIN_B, left: MARGIN_L } } },
      headers:  { default: makeHeader(title) },
      footers:  { default: makeFooter() },
      children: [...cover, ...body],
    }]
  });
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
const FILES = Object.keys(COVERS);
(async () => {
  for (const f of FILES) {
    const outName = f.replace('.md', '.docx');
    const outPath = path.join(OUT, outName);
    console.log(`Converting ${f} ...`);
    try {
      const doc = await buildDoc(f, f === 'AI_거버넌스_문서_구조도.md');
      const buf = await Packer.toBuffer(doc);
      fs.writeFileSync(outPath, buf);
      console.log(`  -> ${outPath} (${Math.round(buf.length / 1024)} KB)`);
    } catch (e) {
      console.error(`  ERROR in ${f}: ${e.message}`);
      console.error(e.stack);
    }
  }
  console.log('Done.');
})();
