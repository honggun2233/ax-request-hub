// ─────────────────────────────────────────────────────────────────────────────
// 삼성자산운용 AI 거버넌스 — DOCX 변환 v3 (삼성 내규 문서 스타일)
// 삼성 문서 스타일: 바탕체 15pt, 제목 볼드, 왼쪽 맞춤,
//   들여쓰기 왼쪽 0.35cm / 둘째줄이하 0.35cm (hanging), 줄간격 배수 1.3
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const fs   = require('fs');
const path = require('path');
const DROOT = 'C:/Users/Samsung/AppData/Roaming/npm/node_modules/docx';
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, HeadingLevel, AlignmentType, BorderStyle, WidthType,
  ShadingType, LevelFormat, PageNumber, PageBreak, VerticalAlign, ImageRun,
  DocumentGridType, createDocumentGrid,
} = require(DROOT);

const DOCS = 'C:/project/ax-team/docs';
const OUT  = 'C:/project/ax-team/docs/word';
const DIAG = 'C:/project/ax-team/docs/word/diagrams';

// ── 삼성자산운용 컬러 팔레트 (색 최소화 버전) ────────────────────────────────
const C = {
  navyDark : '1A3C6E',   // 조 제목·표지 제목 텍스트 색
  navyMid  : '2E6DB4',   // (레거시, 헤더 등)
  navyLight: '4A90D9',
  fillH1   : '1A3C6E',
  fillH2   : 'EAF2FF',
  fillHead : 'E7E6E6',   // 테이블 헤더: 연회색 (인표님 스타일)
  fillEven : 'FFFFFF',   // 짝수행: 흰색 (색 없음)
  fillCover: 'F7F9FF',
  white    : 'FFFFFF',
  textDark : '1C1C1C',   // 기본 텍스트 검정
  textGray : '5A5A5A',
  lineLight: 'D0D9E8',
  lineMid  : 'AAAAAA',   // 테두리 선: 회색 (기존 파란계열 → 중립)
  codeBack : 'F4F6F8',
};

const PAGE_W = 11906, PAGE_H = 16838;
const ML = 1700, MR = 1440, MT = 1400, MB = 1440;
const CW = PAGE_W - ML - MR;   // 8766 DXA

// ── 삼성 내규 문서 스타일 상수 ────────────────────────────────────────────────
const SS = {
  font   : 'Batang',   // 바탕체
  size   : 30,         // 15pt (half-points: pt * 2)
  sizeH  : 30,         // 제목도 15pt, bold로만 구분
  sizeHd : 18,         // 헤더/푸터 9pt
  line   : 312,        // 줄간격 배수 1.3 (240 * 1.3 = 312)
  indL   : 198,        // 들여쓰기 왼쪽 0.35cm (567 * 0.35 = 198 DXA)
  indH   : 198,        // 둘째줄이하(hanging) 0.35cm
  indR   : 0,          // 들여쓰기 오른쪽 0
  before : 0,          // 단락 앞 간격 0
  after  : 0,          // 단락 뒤 간격 0
  sizeT  : 24,         // 테이블 글자 크기 12pt (24 half-points)
  align  : AlignmentType.LEFT,
};

// ── 인라인 텍스트 파서 (**bold** / *italic* / `code` / 나머지 *~_ 제거) ──────
function runs(raw, opt = {}) {
  if (!raw) return [new TextRun({ text: '', font: SS.font, size: SS.size })];
  const def = { font: opt.font || SS.font, size: opt.size || SS.size,
                color: opt.color || C.textDark, bold: opt.bold || false };
  const list = [];
  const re = /\*\*(.+?)\*\*|\*([^*\n]+?)\*|`([^`]+?)`/g;
  let last = 0, m;
  while ((m = re.exec(raw)) !== null) {
    const before = raw.slice(last, m.index);
    if (before) list.push(new TextRun({ ...def, text: before }));
    if (m[1]) list.push(new TextRun({ ...def, text: m[1], bold: true, color: opt.boldColor || C.textDark }));
    else if (m[2]) list.push(new TextRun({ ...def, text: m[2], italics: true, color: opt.color || C.textDark }));
    else if (m[3]) list.push(new TextRun({ text: m[3], font: 'Courier New', size: (opt.size || 22) - 2, color: '444444' }));
    last = m.index + m[0].length;
  }
  const tail = raw.slice(last);
  if (tail) list.push(new TextRun({ ...def, text: tail }));
  return list.length ? list : [new TextRun({ ...def, text: '' })];
}

// ── 단락 헬퍼 ─────────────────────────────────────────────────────────────────
const sp = (n = 100) => new Paragraph({ children: [new TextRun('')], spacing: { after: n } });

function para(text, opt = {}) {
  // noIndent: 표지·헤더 등 들여쓰기 불필요한 단락
  const indentOpt = opt.noIndent ? { right: SS.indR }
    : opt.indent ? { left: opt.indent, right: SS.indR }
    : { left: SS.indL, hanging: SS.indH, right: SS.indR };
  return new Paragraph({
    alignment: opt.align || SS.align,
    indent: indentOpt,
    shading: opt.fill ? { fill: opt.fill, type: ShadingType.CLEAR } : undefined,
    spacing: {
      before: opt.before !== undefined ? opt.before : SS.before,
      after:  opt.after  !== undefined ? opt.after  : SS.after,
      line: SS.line, lineRule: 'auto',
    },
    border: opt.border,
    children: runs(text || '', opt),
  });
}

// H1: 문서 제목(# 제목) — 네이비 하단 굵은 선, 볼드
function h1(text) {
  return new Paragraph({
    spacing: { before: SS.before, after: SS.after, line: SS.line, lineRule: 'auto' },
    alignment: SS.align,
    indent: { right: SS.indR },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: C.lineMid, space: 4 } },
    children: runs(text, { size: SS.sizeH, color: C.textDark, bold: true, boldColor: C.textDark }),
  });
}
// H2: 장 제목 (## 제N장) — 왼쪽 두꺼운 선 + 하단 얇은 선, 볼드
function h2(text) {
  return new Paragraph({
    spacing: { before: SS.before, after: SS.after, line: SS.line, lineRule: 'auto' },
    alignment: SS.align,
    indent: { left: 0, right: SS.indR },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.lineMid, space: 8 },
              bottom: { style: BorderStyle.SINGLE, size: 3, color: C.lineMid, space: 2 } },
    children: runs(text, { size: SS.sizeH, color: C.textDark, bold: true, boldColor: C.textDark }),
  });
}
// H3: 조 제목 (### 제N조) — 하단 얇은 선, 볼드 / before=조간 한 줄, after=0(항이 바로 붙음)
function h3(text) {
  return new Paragraph({
    spacing: { before: SS.line, after: 0, line: SS.line, lineRule: 'auto' },
    alignment: SS.align,
    indent: { left: SS.indL, right: SS.indR },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.lineMid, space: 2 } },
    children: runs(text, { size: SS.sizeH, color: C.textDark, bold: true, boldColor: C.textDark }),
  });
}
function bul(text, level = 0) {
  return new Paragraph({
    numbering: { reference: level ? 'b2' : 'b1', level: 0 },
    spacing: { before: 40, after: 40 },
    children: runs(text, { size: 21 }),
  });
}

// ── 테이블 헬퍼 ──────────────────────────────────────────────────────────────
const brd = (c) => ({ style: BorderStyle.SINGLE, size: 2, color: c || C.lineLight });
const allBrd = (c) => { const b = brd(c); return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b }; };

function cell(text, { fill, color, bold, w, align, span, vAlign, size, lines } = {}) {
  const isHead = fill === C.fillHead;
  // 헤더도 텍스트는 검정 (색 최소화)
  const textColor = color || C.textDark;
  const cellSize = size || SS.sizeT;  // 테이블 기본 12pt
  const content = lines
    ? lines.map(l => new Paragraph({ alignment: align || AlignmentType.LEFT,
        children: runs(l, { size: cellSize, color: textColor, bold: bold || isHead, boldColor: textColor }) }))
    : [new Paragraph({ alignment: align || AlignmentType.LEFT,
        children: runs(String(text ?? ''), { size: cellSize, color: textColor, bold: bold || isHead, boldColor: textColor }) })];
  return new TableCell({
    columnSpan: span,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: { fill: fill || C.white, type: ShadingType.CLEAR },
    borders: allBrd(C.lineMid),
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: vAlign || VerticalAlign.CENTER,
    children: content,
  });
}

function tbl(rows, cols) {
  const total = cols.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: cols,
    borders: allBrd(C.lineLight),
    rows: rows.map((row, ri) => new TableRow({
      children: row.map((c, ci) => {
        if (c && c._isCell) return c;          // pre-built cell
        const isH = ri === 0;
        return cell(c, {
          fill: isH ? C.fillHead : C.white,
          w: cols[ci],
          bold: isH,
        });
      })
    }))
  });
}

// ── 헤더 / 푸터 ───────────────────────────────────────────────────────────────
function mkHeader(title) {
  return new Header({ children: [new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.lineMid, space: 3 } },
    spacing: { after: 60 },
    children: [
      new TextRun({ text: '삼성자산운용 주식회사  ', font: SS.font, size: SS.sizeHd, bold: true, color: C.textDark }),
      new TextRun({ text: title, font: SS.font, size: SS.sizeHd, color: C.textDark }),
      new TextRun({ text: '\t내부용', font: SS.font, size: SS.sizeHd, color: C.textDark }),
    ],
    tabStops: [{ type: 'right', position: CW }],
  })] });
}
function mkFooter() {
  return new Footer({ children: [new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 3, color: C.lineMid, space: 3 } },
    spacing: { before: 60 },
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({ text: 'AX/PI센터 AX팀  |  2026-07-06  |  ', font: SS.font, size: SS.sizeHd, color: C.textDark }),
      new TextRun({ children: [PageNumber.CURRENT], font: SS.font, size: SS.sizeHd, color: C.textDark }),
      new TextRun({ text: ' / ', font: SS.font, size: SS.sizeHd, color: C.textDark }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: SS.font, size: SS.sizeHd, color: C.textDark }),
    ],
  })] });
}

// ── 표지 제목 크기 자동 조정 (긴 제목도 한 줄에 표시) ──────────────────────────
function coverTitleSize(text) {
  // 공백=반폭(0.5), 나머지=전폭(1.0) 기준으로 글자 수 계산
  const charW = [...text].reduce((a, c) => a + (/\s/.test(c) ? 0.5 : 1), 0);
  // CW(8766 DXA) / (글자수 * 10 DXA/half-point) = 최대 half-points
  const maxHp = Math.floor(CW / (charW * 10));
  const hp = Math.max(28, Math.min(64, maxHp % 2 === 0 ? maxHp : maxHp - 1));
  return hp;
}

// ── 표지 ──────────────────────────────────────────────────────────────────────
function cover(title, docNo, ver, category) {
  const infoW  = 4400;                     // 우측 하단 표 전체 너비
  const keyW   = 1300;
  const valW   = infoW - keyW;
  const infoRows = [
    ['문서번호', docNo],
    ['버전', ver],
    ['최종 수정', '2026-07-06'],
    ['문서 분류', category],
    ['소관 부서', 'AX/PI센터 AX팀'],
  ];
  const infoTable = new Table({
    width: { size: infoW, type: WidthType.DXA },
    alignment: AlignmentType.RIGHT,
    columnWidths: [keyW, valW],
    borders: allBrd(C.lineMid),
    rows: infoRows.map(([k, v]) => new TableRow({ children: [
      new TableCell({ width: { size: keyW, type: WidthType.DXA },
        shading: { fill: C.fillHead, type: ShadingType.CLEAR }, borders: allBrd(C.lineMid),
        margins: { top: 60, bottom: 60, left: 100, right: 100 }, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: k, font: SS.font, size: 20, bold: true, color: C.textDark })] })] }),
      new TableCell({ width: { size: valW, type: WidthType.DXA },
        shading: { fill: C.white, type: ShadingType.CLEAR }, borders: allBrd(C.lineMid),
        margins: { top: 60, bottom: 60, left: 100, right: 100 }, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text: v, font: SS.font, size: 20, color: C.textDark })] })] }),
    ]}))
  });

  return [
    sp(2800),
    para('삼성자산운용 주식회사', { size: 24, bold: true, color: C.textDark, before: 0, after: 40, noIndent: true }),
    para('AX/PI센터 AX팀', { size: 20, color: C.textDark, before: 0, after: 160, noIndent: true }),
    new Paragraph({ children: [new TextRun('')],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.lineMid } }, spacing: { after: 240 } }),
    para(title, { size: coverTitleSize(title), bold: true, color: C.textDark, boldColor: C.textDark, before: 0, after: 0, noIndent: true }),
    sp(3200),                              // 제목 → 하단 표 사이 큰 여백
    infoTable,
    sp(160),
    para('내부용 (Internal Use Only)', { size: 18, color: C.textDark, before: 0, after: 0, align: AlignmentType.RIGHT, noIndent: true }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 목차 빌더 ─────────────────────────────────────────────────────────────────
function buildToc(md) {
  const items = [];
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (/^## (.+)/.test(t))  items.push({ level: 2, text: t.replace(/^## /, '') });
    if (/^### (.+)/.test(t)) items.push({ level: 3, text: t.replace(/^### /, '') });
  }
  if (!items.length) return [];

  const elems = [
    new Paragraph({
      spacing: { before: 0, after: 160, line: SS.line, lineRule: 'auto' },
      alignment: SS.align,
      border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: C.lineMid, space: 4 } },
      children: runs('목차', { size: SS.sizeH + 4, color: C.textDark, bold: true }),
    }),
  ];

  for (const item of items) {
    const isChapter = item.level === 2;
    elems.push(new Paragraph({
      spacing: {
        before: isChapter ? 220 : 0,   // 장 앞에 한 줄 간격, 조는 촘촘하게
        after: 0,
        line: SS.line, lineRule: 'auto',
      },
      alignment: SS.align,
      indent: {
        left: isChapter ? 0 : 400,     // 장은 왼쪽 정렬, 조는 들여쓰기
        right: SS.indR,
      },
      children: runs(item.text, {
        size: isChapter ? SS.sizeH : SS.sizeH - 2,  // 장 15pt, 조 14pt
        bold: isChapter,
        color: C.textDark,
      }),
    }));
  }

  elems.push(new Paragraph({ children: [new PageBreak()] }));
  return elems;
}

// ── 마크다운 파서 ─────────────────────────────────────────────────────────────
function parseMd(md) {
  const elems = [];
  const lines = md.split('\n');
  let i = 0, tBuf = [], cBuf = [], inCode = false;
  let lastWasItem = false;  // ①②③ 또는 번호목록 직후 빈 줄 무시용

  function flushTbl() {
    if (!tBuf.length) return;
    // 구분선 행 제거: |:---:|---|---| 패턴
    const data = tBuf.filter(r => !/^[\s|:\-]+$/.test(r.replace(/\|/g, '').trim()));
    if (!data.length) { tBuf = []; return; }
    const parsed = data.map(r =>
      r.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
    );
    const nCol = Math.max(...parsed.map(r => r.length));
    // 내용 기반 열 너비 배분: 각 열의 최대 텍스트 길이 비율로 배분
    const colMaxLen = Array(nCol).fill(0);
    for (const row of parsed) {
      row.forEach((c, ci) => {
        if (ci < nCol) {
          const maxLine = c.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
          colMaxLen[ci] = Math.max(colMaxLen[ci], maxLine);
        }
      });
    }
    const totalLen = colMaxLen.reduce((a, b) => a + b, 0) || nCol;
    const minColW = 600;                        // 최소 열 너비 600 DXA
    const availW  = CW - minColW * nCol;
    const cols = colMaxLen.map(len => minColW + Math.round(availW * len / totalLen));
    // 마지막 열 보정 (합산이 CW와 같도록)
    cols[nCol - 1] = CW - cols.slice(0, -1).reduce((a, b) => a + b, 0);
    elems.push(sp(80));
    elems.push(new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: cols,
      borders: allBrd(C.lineLight),
      rows: parsed.map((row, ri) => new TableRow({
        children: row.map((c, ci) => new TableCell({
          width: { size: cols[ci], type: WidthType.DXA },
          shading: { fill: ri === 0 ? C.fillHead : C.white, type: ShadingType.CLEAR },
          borders: allBrd(C.lineMid),
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: runs(c, { size: SS.sizeT, color: C.textDark, bold: ri === 0, boldColor: C.textDark }) })]
        }))
      }))
    }));
    elems.push(sp(80));
    tBuf = [];
  }

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    // 코드 블록
    if (t.startsWith('```')) {
      if (inCode) {
        const code = cBuf.join('\n');
        elems.push(new Paragraph({
          shading: { fill: C.codeBack, type: ShadingType.CLEAR },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: C.navyMid, space: 6 } },
          spacing: { before: 80, after: 80 }, indent: { left: 360, right: 360 },
          children: [new TextRun({ text: code, font: 'Courier New', size: 18, color: '444444' })]
        }));
        cBuf = []; inCode = false;
      } else { flushTbl(); inCode = true; }
      i++; continue;
    }
    if (inCode) { cBuf.push(line); i++; continue; }

    // 테이블
    if (t.startsWith('|')) { tBuf.push(t); i++; continue; }
    else flushTbl();

    // 헤딩 (trimmed 버전으로 체크)
    if (/^### (.+)/.test(t)) { lastWasItem = false; elems.push(h3(t.replace(/^### /, ''))); i++; continue; }
    if (/^## (.+)/.test(t))  { lastWasItem = false; elems.push(h2(t.replace(/^## /, ''))); i++; continue; }
    if (/^# (.+)/.test(t))   { lastWasItem = false; elems.push(h1(t.replace(/^# /, ''))); i++; continue; }

    // 블록쿼트 (> 문서 메타 정보) → 본문에서 제외, buildMeta()로 맨 뒤에 배치
    if (t.startsWith('>')) { i++; continue; }

    // 불릿
    if (/^- /.test(t))      { lastWasItem = false; elems.push(bul(t.replace(/^- /, ''))); i++; continue; }
    if (/^\s{2,}- /.test(line)) { lastWasItem = false; elems.push(bul(t.replace(/^- /, ''), 1)); i++; continue; }

    // 번호 목록 (1. 2. 3.)
    if (/^\d+\. /.test(t)) {
      elems.push(new Paragraph({
        alignment: SS.align,
        indent: { left: SS.indL + 360, hanging: 360, right: SS.indR },
        spacing: { before: SS.before, after: SS.after, line: SS.line, lineRule: 'auto' },
        children: runs(t, { size: SS.size }),
      }));
      lastWasItem = true; i++; continue;
    }

    // 내규 항 체계: ①②③④⑤
    if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(t)) {
      elems.push(new Paragraph({
        alignment: SS.align,
        indent: { left: SS.indL + 280, hanging: 280, right: SS.indR },
        spacing: { before: SS.before, after: SS.after, line: SS.line, lineRule: 'auto' },
        children: runs(t, { size: SS.size }),
      }));
      lastWasItem = true; i++; continue;
    }

    // 구분선 → 무시
    if (t === '---' || t === '***') { i++; continue; }

    // 빈 줄: ①②③/번호목록 직후면 무시 (항 사이 엔터 제거)
    if (!t) {
      if (!lastWasItem) elems.push(sp(40));
      i++; continue;
    }

    // 이탤릭 footer 줄 (*text*) → 회색 소형 텍스트
    if (/^\*.+\*$/.test(t)) {
      elems.push(para(t.replace(/^\*|\*$/g, ''), { size: 18, color: C.textGray, before: 40, after: 40 }));
      i++; continue;
    }

    // 일반 텍스트
    lastWasItem = false;
    elems.push(para(t, { before: 0, after: 0 }));
    i++;
  }
  flushTbl();
  return elems;
}

// ── 구조도 전용 빌더 ──────────────────────────────────────────────────────────
function buildDiagram() {
  const e = [];

  function imgPara(fname, w, h) {
    const imgData = fs.readFileSync(path.join(DIAG, fname));
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 140 },
      children: [new ImageRun({ data: imgData, transformation: { width: w, height: h } })]
    });
  }

  // ── 1. 문서 계층 ─────────────────────────────────────────────────────────
  e.push(h1('1. 문서 계층 및 독자'));
  e.push(imgPara('diag1_doc_hierarchy.png', 570, 440));
  e.push(para('5개 문서는 계층적으로 연결됩니다. WHY/WHAT → HOW → 실무 적용 순으로 참조합니다.', { size: 21, before: 80, after: 80 }));

  const brd2 = { style: BorderStyle.SINGLE, size: 2, color: C.lineLight };
  const allB = { top: brd2, bottom: brd2, left: brd2, right: brd2 };

  function docBox(fill, name, ver, desc, audience, arrow) {
    const rows = [new TableRow({ children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, rowSpan: 1,
        shading: { fill, type: ShadingType.CLEAR }, borders: allBrd(C.lineMid),
        margins: { top: 140, bottom: 140, left: 200, right: 160 },
        children: [
          new Paragraph({ children: [new TextRun({ text: name, font: SS.font, size: 22, bold: true, color: fill === C.fillH1 ? C.white : C.textDark })] }),
          new Paragraph({ children: [new TextRun({ text: ver,  font: SS.font, size: 19, color: fill === C.fillH1 ? 'DDDDDD' : C.textDark })] }),
        ] }),
      new TableCell({ width: { size: 4966, type: WidthType.DXA },
        shading: { fill: fill === C.fillH1 ? '2E5C9A' : C.fillEven, type: ShadingType.CLEAR }, borders: allBrd(C.lineMid),
        margins: { top: 140, bottom: 140, left: 200, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: desc, font: SS.font, size: 20, color: fill === C.fillH1 ? C.white : C.textDark })] })] }),
      new TableCell({ width: { size: 2000, type: WidthType.DXA },
        shading: { fill: fill === C.fillH1 ? '1A3C6E' : C.white, type: ShadingType.CLEAR }, borders: allBrd(C.lineMid),
        margins: { top: 140, bottom: 140, left: 160, right: 160 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: audience, font: SS.font, size: 19, color: fill === C.fillH1 ? C.white : C.textGray })] })] }),
    ]})];
    return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [2600, 4966, 2000], borders: allBrd(C.lineMid), rows });
  }

  function arrowRow(text) {
    return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW],
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      rows: [new TableRow({ children: [new TableCell({
        shading: { fill: 'EAF2FF', type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 200, right: 200 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, font: SS.font, size: 20, bold: true, color: C.textDark })] })]
      })] })] });
  }

  // 헤더행
  e.push(new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [2600, 4966, 2000], borders: allBrd(C.navyMid),
    rows: [new TableRow({ children: [
      cell('문서명 / 버전', { fill: C.fillHead, w: 2600, size: 20 }),
      cell('주요 내용', { fill: C.fillHead, w: 4966, size: 20 }),
      cell('주요 독자', { fill: C.fillHead, w: 2000, size: 20, align: AlignmentType.CENTER }),
    ]})] }));

  e.push(sp(4));
  e.push(arrowRow('▲ 의사결정 레이어'));
  e.push(sp(4));
  e.push(docBox(C.fillH2, '운영방안_AX위원회.md', 'v2.1',
    '규정 개정 심의·의결 / 고위험 AI 최종 승인 / 반기 운영 현황 보고 수령 / 거버넌스 정책 방향 결정', '경영진·임원'));
  e.push(arrowRow('▼ 거버넌스 문서 레이어'));
  e.push(docBox(C.fillH1, '규정_AI_거버넌스.md', 'v6.3  [IT-AX-REG-001]',
    'WHY & WHAT — AI Native 원칙 · 절대 금지사항 · 위험 분류 · 에이전트 유형 · 데이터 기밀등급', '전 임직원'));
  e.push(arrowRow('↓ 참조'));
  e.push(docBox(C.white, '지침_AI_거버넌스.md', 'v7.7  [IT-AX-OPS-002]',
    'HOW — Phase 0~6 과제 게이트 · Agent 라이프사이클 · R&R 매트릭스 · 비용·토큰 관리 · CREW 이관 기준 · 우수 에이전트 보상 · 암묵지 성숙도 평가', 'AX팀 · AI CREW · 부서장'));
  e.push(arrowRow('↓ 참조'));
  e.push(docBox(C.fillEven, '가이드라인_AI_거버넌스.md', 'v5.1  [IT-AX-GUIDE-003]',
    '실무 적용 — 솔루션 유형 선택 · Kill Switch 구현 · 감사 로그 패턴 · 개발 환경 · 보안 체크리스트', 'AI CREW · 개발 참여자'));

  e.push(sp(180));

  // ── 2. 핵심 플로우 ───────────────────────────────────────────────────────
  e.push(h1('2. 핵심 플로우 — 과제 → 에이전트 → 보상'));
  e.push(imgPara('diag2_phase_flow.png', 620, 184));
  e.push(sp(60));
  const fw = [1200, 2000, 2200, 1666, 1700];
  e.push(tbl([
    ['단계', '현업 (AI CREW)', 'AX팀', '데이터플랫폼팀', 'AX 위원회'],
    ['Phase 0~2\n탐색·실험', '과제 아이디어 발굴\nG1 자율 운용', '과제 신청 접수\n스코어카드 평가·결과 통보', '—', '—'],
    ['Phase 3\nMVP 개발', '합성 데이터 검증 협조', 'AX 엔지니어 주도 개발\n(이관 완성도 5항목 체크)', '샘플 데이터 제공', '—'],
    ['Phase 4\n심사', '이해관계자 확인', '심사 보고서\n위험 평가서 작성', '—', '—'],
    ['Phase 5\n파일럿', 'UAT 수행\nKPI 측정', '임시 ID (AX-DEV-) 발급\n파일럿 운영 지원', 'G1/G2 실데이터\nSLA 보장', '—'],
    ['Phase 6\n운영 (일반)', '현업 활용\n이상 신고', '정식 ID (AX-YYYY-AGT-) 발급\n모니터링·개선·폐기 판단', '전체 접근권한 갱신', '—'],
    ['Phase 6\n운영 (고위험)', '현업 활용', '정식 ID 발급\n위원회 안건 상정', '—', '투자·운용·공시·컴플\n해당 과제 최종 승인'],
    ['분기 보상 심사', '—', '우수 에이전트 5기준 심사', '—', '—'],
    ['반기 보고', '—', '과제·KPI·비용·\n암묵지 성숙도 평가 보고', '—', '보고 수령\n개선 지시'],
  ].map((row, ri) => row.map((c, ci) => cell(c, {
    fill: ri === 0 ? C.fillHead : (ri % 2 === 0 ? C.fillEven : C.white),
    w: fw[ci], size: 19,
    lines: c.split('\n'),
  }))), fw));

  e.push(sp(180));

  // ── 3. Agent ID · 라이프사이클 ──────────────────────────────────────────
  e.push(h1('3. Agent ID · 라이프사이클 매핑'));
  e.push(imgPara('diag3_agent_lifecycle.png', 540, 382));
  e.push(h2('3-1. Agent ID 발급 체계'));
  e.push(tbl([
    ['상황', 'ID 유형', '발급 주체', '데이터 접근'],
    ['G1 개인 실험 (Phase 0~2)', '없음', '—', 'G1만 (샌드박스 권장)'],
    ['G1 팀 공유 PoC (Phase 3~4)', '없음', 'AX팀 인식·등록만', 'G1, 샘플 데이터'],
    ['Phase 5 파일럿', 'AX-DEV-YYYY-XXX (임시)', 'AX팀', 'G1/G2, 제한 실데이터'],
    ['Phase 6 운영', 'AX-YYYY-AGT-XXX (정식)', 'AX팀', '설계 기준 전체 접근'],
    ['멀티 에이전트 서브', 'AX-YYYY-MAS-XXX-SUB-A', 'AX팀', '오케스트레이터 범위 이하'],
  ], [2400, 2600, 1400, 2366]));

  e.push(h2('3-2. 생성 라이프사이클 (Phase Gate 0→6)'));
  e.push(tbl([
    ['Phase', '명칭', 'ID 상태', '에이전트 상태', 'AX팀 역할'],
    ['0', '발굴', '없음', '—', '존재 인식'],
    ['1', '기획', '없음', '—', '과제 등록·스코어카드 평가'],
    ['2', '설계', '없음', '—', '기술 검토·설계 지원'],
    ['3', 'MVP', '없음', '개발 중', 'AX 엔지니어 주도 개발'],
    ['4', '심사', '없음', '심사 중', '심사 보고서 작성'],
    ['5', '파일럿', 'AX-DEV- (임시)', '🟡 등록신청', '임시 ID 발급·파일럿 운영'],
    ['6', '운영', 'AX-YYYY-AGT- (정식)', '🟢 Active', '정식 ID 발급·KPI 모니터링'],
  ], [600, 900, 2200, 1400, 3666]));

  e.push(h2('3-3. 관리 라이프사이클 (상태 머신)'));
  e.push(tbl([
    ['상태 전환', '조건', 'AX팀 역할', '데이터플랫폼팀 역할'],
    ['→ 🟡 등록신청', 'Phase 5 파일럿 진입 승인', '임시 ID 발급, 인벤토리 신규 등록', '제한 실데이터 접근 권한 부여'],
    ['🟡 → 🟢 Active', 'Phase 6 운영 승격', '정식 ID 교체, KPI 모니터링 활성화', '전체 접근권한 갱신'],
    ['🟢 → 🔵 Suspended', '사고·점검·업무 변화', '원인 분석, 접근권한 일시 차단', '데이터 접근 일시 차단'],
    ['🔵 → 🟢 Active', '원인 해소 후 복구 승인', '복구 검토, 재활성화', '접근권한 복구'],
    ['* → 🔴 Retired', '폐기 기준 충족', 'ID 비활성화, 인벤토리 폐기 등록', '접근권한 전체 회수'],
  ], [1800, 1900, 2300, 2766]));

  e.push(sp(180));

  // ── 4. 암묵지 성숙도 평가 ────────────────────────────────────────────────
  e.push(h1('4. 암묵지 데이터화 성숙도 평가 (3차원)'));
  e.push(para('AI Native 조직의 핵심 지표: 쓴 만큼 조직 지식이 축적됐는가.', { size: 21, before: 80, after: 80 }));
  const cw3 = [2922, 2922, 2922];
  const dim = [
    ['차원 1 — 지식 포착', '차원 2 — 활용·재사용', '차원 3 — 조직 역량'],
    ['분기 / 정량', '반기 / 정량', '반기 / 정성'],
    ['· 과제 정의서 완료율 ≥ 80%\n· 프롬프트 문서화율 100%\n· 감사로그 충족율 ≥ 90%\n· 실패 리뷰 분기 1건 이상',
     '· Prompt Caching 적용률 ≥ 50%\n· 이관 후 재작업률 ≤ 30%\n· 과거 사례 참조 반기 3건 이상',
     '· 신규 CREW 온보딩 기간 단축\n· 핵심인력 이탈 후 업무 연속성\n· 에이전트 자립도 심사'],
    ['미달 시: AX팀 보완 요청\n과제 정의서 미작성 → 다음 Phase 진행 불가',
     '미달 시: 재작업률 30% 초과\n→ CREW 이관 완성도 기준 재교육',
     '미달 시: Context 외재화 작업\n→ 다음 분기 필수 과제 등록'],
  ];
  e.push(new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: cw3, borders: allBrd(C.lineMid),
    rows: dim.map((row, ri) => new TableRow({ children: row.map((c, ci) => new TableCell({
      width: { size: cw3[ci], type: WidthType.DXA },
      shading: { fill: ri === 0 ? C.fillHead : ri === 1 ? C.fillH2 : (ri % 2 === 0 ? C.fillEven : C.white), type: ShadingType.CLEAR },
      borders: allBrd(C.lineMid),
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: c.split('\n').map((l, li) => new Paragraph({ children: [new TextRun({
        text: l, font: SS.font, size: 20,
        color: ri === 0 ? C.white : C.textDark,
        bold: ri <= 1 || li === 0,
      })] }))
    })) })) }));
  e.push(para('목표 2개 미달 부서 → 다음 반기 과제 등록 상한 1건으로 제한  |  반기 AX 위원회 보고', { size: 20, color: C.textDark, bold: true, before: 100, after: 60, fill: C.fillH2 }));

  e.push(sp(180));

  // ── 5. 문서 간 조항 연결 매핑 ────────────────────────────────────────────
  e.push(h1('5. 문서 간 조항 연결 매핑'));
  e.push(h2('규정 → 지침'));
  e.push(tbl([
    ['규정 조항', '지침 참조 위치', '연결 내용'],
    ['제3조 AI Native 원칙', '지침 제8장 암묵지 3차원 평가', '"토큰 소비 ≠ AI 투자" 원칙 → 측정 지표 구체화'],
    ['제4조 솔루션 유형 0~4', '지침 제2장 Phase Gate, 제6장 위험통제', '유형별 적용 Phase·통제 요건 결정'],
    ['제5조 데이터 기밀등급', '지침 제8장 API키 관리, 제11장 배포 환경', 'G1 셀프발급 허용 / G3 온프레미스 전용 기준'],
    ['제6조 위험 업무 분류', '지침 제6장 위험등급별 통제 요건', '위험등급 결정 → 통제 요건 적용'],
    ['제7조 에이전트 원칙', '지침 제7장 라이프사이클, 제10장 제22조', 'Kill Switch / 감사 추적 / 최소 권한 구현 의무'],
    ['제9조 AX 위원회', '지침 제3장 상정 절차, 제13장 R&R', '고위험 과제 상정 → 위원회 운영방안 연계'],
  ], [2200, 2500, 4066]));
  e.push(h2('지침 → 가이드라인'));
  e.push(tbl([
    ['지침 조항', '가이드라인 참조 위치', '연결 내용'],
    ['제6장 감사 로그 필드 정의', '감사 로그 구현 패턴', '필드 스키마(7개) → 코드 구현 예시'],
    ['제7장 Kill Switch 구현 의무', 'Kill Switch 구현 예시', 'Circuit Breaker 패턴 → 실무 코드'],
    ['제10장 제21조 (기획자 역할)', 'AX 기획자 실무 가이드', '과제 정의서 작성 지원 → 체크리스트'],
    ['제10장 제22조 (엔지니어 기준)', 'AX 엔지니어 실무 가이드', '개발 기준 7항목 → 보안 체크리스트'],
    ['제11장 배포 환경 결정', '배포 환경 선택 체크리스트', '결정 트리(GPT/AWS/온프레미스) → 체크리스트'],
  ], [2200, 2500, 4066]));
  e.push(h2('지침 → 운영방안_AX위원회'));
  e.push(tbl([
    ['지침 조항', '운영방안 참조 위치', '연결 내용'],
    ['제3장 AX 위원회 상정 절차', '제3조 임무 ②, 제4조 회의 운영', '고위험 과제 → 임시/정기 회의 안건 상정'],
    ['제6장 운영 승격 기준 (고위험)', '제3조 임무 ② 대상 목록', '투자·운용·공시·컴플 → 위원회 의결 필수'],
    ['제8장 암묵지 3차원 평가', '제3조 임무 ③ 반기 보고', '차원 1·2 집계 + 차원 3 정성 결과 보고'],
    ['제13장 에스컬레이션 기준', '제4조 임시회의 소집 조건', 'G3 포함 / 보안 사고 → 임시회의 트리거'],
  ], [2200, 2500, 4066]));

  e.push(sp(180));

  // ── 6. 핵심 개념 인덱스 ──────────────────────────────────────────────────
  e.push(h1('6. 핵심 개념 정의 위치 인덱스'));
  e.push(tbl([
    ['개념', '정의 위치', '상세 기준 위치', '실무 구현 위치'],
    ['AI Native 원칙', '규정 제3조', '지침 제8장 암묵지 평가', '—'],
    ['솔루션 유형 0~4', '규정 제4조', '지침 제2장·제6장', '가이드라인 유형 선택'],
    ['데이터 기밀등급 G1/G2/G3', '규정 제5조', '지침 제8장(API키), 제11장(배포)', '가이드라인 보안 체크'],
    ['위험등급 고/중/저', '규정 제6조', '지침 제6장 통제 요건', '가이드라인 위험 결정 트리'],
    ['AX 위원회', '규정 제9조', '운영방안_AX위원회.md', '지침 제3장 상정 절차'],
    ['Phase Gate 0~6', '지침 제2장', '지침 제3·6·10장', '가이드라인 플로우'],
    ['Agent ID 체계', '지침 제7-2장', '지침 제7-3/7-4장 라이프사이클', '가이드라인 예시'],
    ['AI CREW 등급 Lv.1/2/3', '지침 제1장', '지침 제10장·제8장', '가이드라인 등급별 가이드'],
    ['CREW 이관 완성도 5항목', '지침 제19조', '—', '가이드라인 체크리스트'],
    ['암묵지 3차원 평가', '지침 제8장', '—', '운영방안 반기 보고'],
    ['우수 에이전트 보상 5기준', '지침 제14장', '—', '—'],
    ['Kill Switch', '규정 제7조', '지침 제7-1/7-4장', '가이드라인 구현 예시'],
    ['감사 로그', '규정 제7조', '지침 제6장 필드 정의', '가이드라인 구현 패턴'],
    ['스코어카드 6차원 (100점)', '지침 제5장', '—', '—'],
  ], [2400, 1900, 2700, 1766]));

  e.push(sp(180));

  // ── 7. 버전 현황 ─────────────────────────────────────────────────────────
  e.push(h1('7. 문서 버전 현황'));
  e.push(tbl([
    ['문서', '문서번호', '버전', '핵심 최근 변경 (2026-07-06)'],
    ['규정_AI_거버넌스.md', 'IT-AX-REG-001', 'v6.3', 'AI Native 원칙 신설, AX 위원회 명칭 변경'],
    ['지침_AI_거버넌스.md', 'IT-AX-OPS-002', 'v7.7', '이관 완성도 5기준 · 암묵지 평가 3차원 · 제13·14장 신설'],
    ['가이드라인_AI_거버넌스.md', 'IT-AX-GUIDE-003', 'v5.1', 'AX 위원회 명칭 반영'],
    ['운영방안_AX위원회.md', 'IT-AX-GOV-001', 'v2.1', 'AI→AX 위원회 명칭 변경, 위원장 외 구성원 미설정'],
    ['AI_거버넌스_문서_구조도.md', '(참고)', 'v1.1', '문서 간 조항 연결 매핑, 핵심 개념 인덱스 신설'],
  ], [2800, 1700, 800, 3466]));

  return e;
}

// ── 문서 정보 (맨 뒤 페이지) ──────────────────────────────────────────────────
function buildMeta(md) {
  // > 블록쿼트 줄 수집
  const lines = md.split('\n');
  const rows = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('>')) continue;
    const content = t.replace(/^>\s?/, '').trim();
    if (!content) continue;
    // "키: 값 | 키: 값" 형식 파싱
    const parts = content.split('|').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      const idx = part.indexOf(':');
      if (idx > 0) {
        rows.push([part.slice(0, idx).trim(), part.slice(idx + 1).trim()]);
      } else {
        rows.push(['', part]);  // 키 없는 경우 값만
      }
    }
  }
  if (!rows.length) return [];

  const kW = 1400, vW = CW - kW;
  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      spacing: { before: 0, after: 160, line: SS.line, lineRule: 'auto' },
      alignment: SS.align,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.lineMid, space: 4 } },
      children: runs('문서 정보', { size: SS.sizeH, color: C.textDark, bold: true }),
    }),
    sp(80),
    new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [kW, vW],
      borders: allBrd(C.lineMid),
      rows: rows.map(([k, v]) => new TableRow({ children: [
        new TableCell({ width: { size: kW, type: WidthType.DXA },
          shading: { fill: k ? C.fillHead : C.white, type: ShadingType.CLEAR }, borders: allBrd(C.lineMid),
          margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: k, font: SS.font, size: SS.sizeT, bold: true, color: C.textDark })] })] }),
        new TableCell({ width: { size: vW, type: WidthType.DXA },
          shading: { fill: C.white, type: ShadingType.CLEAR }, borders: allBrd(C.lineMid),
          margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: v, font: SS.font, size: SS.sizeT, color: C.textDark })] })] }),
      ]}))
    }),
  ];
}

// ── 문서 메타 ─────────────────────────────────────────────────────────────────
const META = {
  '규정_AI_거버넌스.md':              ['AI 거버넌스 규정', 'IT-AX-REG-001', 'v6.3', '사규 (전사 적용)'],
  '지침_AI_과제심사운영.md':          ['AI 과제 심사·운영 지침', 'IT-AX-OPS-002', 'v1.0', '운영 지침 (AX팀·AI CREW·부서장)'],
  '지침_AI_에이전트등록통제.md':      ['AI 에이전트 등록·통제 지침', 'IT-AX-OPS-003', 'v1.0', '운영 지침 (AX팀·AI CREW·부서장)'],
  '지침_AI_개발배포기준.md':          ['AI 개발·배포 기준에 관한 지침', 'IT-AX-OPS-004', 'v1.0', '운영 지침 (AX팀·AI CREW Lv.3)'],
  '지침_AI_조직역할성과관리.md':      ['AI 조직 역할 및 성과관리 지침', 'IT-AX-OPS-005', 'v1.0', '운영 지침 (AX팀·AI CREW·부서장)'],
  '가이드라인_AI_거버넌스.md':        ['AI 거버넌스 가이드라인', 'IT-AX-GUIDE-003', 'v5.1', '실무 가이드 (AI CREW·개발 참여자)'],
  '운영방안_AX위원회.md':             ['AX 위원회 운영방안', 'IT-AX-GOV-001', 'v2.1', '위원회 운영 규정'],
  'AI_거버넌스_문서_구조도.md':       ['AI 거버넌스 문서 구조도', '참고 자료', 'v1.1', '전 이해관계자 참고'],
};

function getNumbering() {
  return { config: [
    { reference: 'b1', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: 'Symbol' } } }] },
    { reference: 'b2', levels: [{ level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] },
  ] };
}

async function buildDoc(fname) {
  const [title, docNo, ver, cat] = META[fname];
  const isDiagram = fname === 'AI_거버넌스_문서_구조도.md';
  const mdContent = isDiagram ? null : fs.readFileSync(path.join(DOCS, fname), 'utf8');
  const body = isDiagram ? buildDiagram() : parseMd(mdContent);
  const toc  = isDiagram ? [] : buildToc(mdContent);
  const meta = isDiagram ? [] : buildMeta(mdContent);

  return new Document({
    numbering: getNumbering(),
    styles: {
      default: { document: { run: { font: SS.font, size: SS.size, color: C.textDark } } },
      paragraphStyles: [
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
          run: { size: SS.sizeH, bold: true, font: SS.font, color: C.textDark },
          paragraph: { spacing: { before: 280, after: 100, line: SS.line, lineRule: 'auto' }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
          run: { size: SS.sizeH, bold: true, font: SS.font, color: C.textDark },
          paragraph: { spacing: { before: 200, after: 80, line: SS.line, lineRule: 'auto' }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MT, right: MR, bottom: MB, left: ML } },
        docGrid: createDocumentGrid({ type: DocumentGridType.SNAP_TO_CHARS, linePitch: SS.line }),
      },
      headers: { default: mkHeader(title) },
      footers: { default: mkFooter() },
      children: [...cover(title, docNo, ver, cat), ...toc, ...body, ...meta],
    }]
  });
}

// ── 보고서 빌드 (표지·목차 없이 본문만, 삼성 내규 보고서 레이아웃) ──────────
const REPORT_META = {
  '보고_AI거버넌스체계_20260706.md': ['AI 거버넌스 체계 및 운영 방안', 'IT-AX-RPT-001', '2026. 7. 6.'],
};

async function buildReport(fname) {
  const [title, docNo, date] = REPORT_META[fname];
  const mdContent = fs.readFileSync(path.join(DOCS, fname), 'utf8');
  const lines = mdContent.split('\n');

  // blockquote에서 to(보고처) 파싱
  let toLine = 'AX/PI센터장';
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('>')) continue;
    const content = t.replace(/^>\s?/, '');
    for (const part of content.split('|').map(p => p.trim())) {
      const idx = part.indexOf(':');
      if (idx > 0 && part.slice(0, idx).trim().toLowerCase() === 'to') {
        toLine = part.slice(idx + 1).trim();
      }
    }
  }

  // h1·blockquote 제거한 순수 본문 md
  const bodyMd = lines.filter(l => !/^# [^#]/.test(l.trim()) && !/^>/.test(l.trim())).join('\n');
  const body = parseMd(bodyMd);

  // 보고서 전용 헤더 단락
  const reportHeader = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 60, line: SS.line, lineRule: 'auto' },
      children: [new TextRun({ text: `보고: ${toLine}`, font: SS.font, size: SS.size - 2, color: C.textDark })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 200, line: SS.line, lineRule: 'auto' },
      children: [new TextRun({ text: `문서번호: ${docNo}  |  ${date}`, font: SS.font, size: SS.size - 2, color: C.textDark })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0, line: SS.line, lineRule: 'auto' },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.textDark, space: 6 } },
      children: runs(title, { size: SS.sizeH + 4, bold: true, color: C.textDark }),
    }),
    sp(200),
  ];

  return new Document({
    numbering: getNumbering(),
    styles: {
      default: { document: { run: { font: SS.font, size: SS.size, color: C.textDark } } },
      paragraphStyles: [
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
          run: { size: SS.sizeH, bold: true, font: SS.font, color: C.textDark },
          paragraph: { spacing: { before: 240, after: 80, line: SS.line, lineRule: 'auto' }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
          run: { size: SS.sizeH, bold: true, font: SS.font, color: C.textDark },
          paragraph: { spacing: { before: 160, after: 60, line: SS.line, lineRule: 'auto' }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MT, right: MR, bottom: MB, left: ML } },
        docGrid: createDocumentGrid({ type: DocumentGridType.SNAP_TO_CHARS, linePitch: SS.line }),
      },
      headers: { default: mkHeader(title) },
      footers: { default: mkFooter() },
      children: [...reportHeader, ...body],
    }]
  });
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
(async () => {
  for (const f of Object.keys(META)) {
    const out = path.join(OUT, f.replace('.md', '.docx'));
    process.stdout.write(`Converting ${f} ... `);
    try {
      const buf = await Packer.toBuffer(await buildDoc(f));
      fs.writeFileSync(out, buf);
      console.log(`OK (${Math.round(buf.length / 1024)} KB) → ${out}`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      console.error(e.stack);
    }
  }
  for (const f of Object.keys(REPORT_META)) {
    const out = path.join(OUT, f.replace('.md', '.docx'));
    process.stdout.write(`Converting (report) ${f} ... `);
    try {
      const buf = await Packer.toBuffer(await buildReport(f));
      fs.writeFileSync(out, buf);
      console.log(`OK (${Math.round(buf.length / 1024)} KB) → ${out}`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      console.error(e.stack);
    }
  }
  console.log('\nDone.');
})();
