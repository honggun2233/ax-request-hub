const fs = require('fs');
const path = require('path');
const DOCX_PATH = 'C:/Users/Samsung/AppData/Roaming/npm/node_modules/docx';
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, HeadingLevel, AlignmentType, BorderStyle, WidthType,
  ShadingType, LevelFormat, PageNumber, TableOfContents
} = require(DOCX_PATH);

const DOCS_DIR = 'C:/project/ax-team/docs';
const OUT_DIR  = 'C:/project/ax-team/docs/word';

const FILES = [
  '규정_AI_거버넌스.md',
  '지침_AI_거버넌스.md',
  '가이드라인_AI_거버넌스.md',
  '운영방안_AX위원회.md',
  'AI_거버넌스_문서_구조도.md',
];

// ── helpers ──────────────────────────────────────────────────────────────────

function inlineRuns(text) {
  // convert **bold** and `code` to TextRun array
  const runs = [];
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), font: 'Malgun Gothic', size: 22 }));
    if (m[2]) runs.push(new TextRun({ text: m[2], bold: true, font: 'Malgun Gothic', size: 22 }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], font: 'Courier New', size: 20 }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), font: 'Malgun Gothic', size: 22 }));
  return runs.length ? runs : [new TextRun({ text, font: 'Malgun Gothic', size: 22 })];
}

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function makeTable(rows) {
  if (!rows.length) return null;
  const colCount = rows[0].length;
  const tableWidth = 9026; // A4 content width DXA
  const colW = Math.floor(tableWidth / colCount);
  const colWidths = Array(colCount).fill(colW);
  // adjust last col for rounding
  colWidths[colCount - 1] += tableWidth - colW * colCount;

  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((row, ri) => new TableRow({
      children: row.map((cell, ci) => new TableCell({
        borders: BORDERS,
        width: { size: colWidths[ci], type: WidthType.DXA },
        shading: ri === 0 ? { fill: 'D5E8F0', type: ShadingType.CLEAR } : { fill: 'FFFFFF', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: inlineRuns(cell.trim()) })]
      }))
    }))
  });
}

function parseMd(md) {
  const elements = [];
  const lines = md.split('\n');
  let i = 0;
  let tableBuffer = [];
  let codeBuffer = [];
  let inCode = false;

  const numbering = {
    config: [
      {
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      }
    ]
  };

  function flushTable() {
    if (!tableBuffer.length) return;
    // filter separator rows (---|---) and header separator
    const dataRows = tableBuffer.filter(r => !/^[\s|:\-]+$/.test(r.replace(/\|/g, '').trim()));
    if (dataRows.length) {
      const parsed = dataRows.map(r =>
        r.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      );
      const t = makeTable(parsed);
      if (t) elements.push(t);
    }
    tableBuffer = [];
  }

  while (i < lines.length) {
    const line = lines[i];

    // code block
    if (line.trim().startsWith('```')) {
      if (inCode) {
        // end code block
        const codeText = codeBuffer.join('\n');
        elements.push(new Paragraph({
          children: [new TextRun({ text: codeText, font: 'Courier New', size: 18 })],
          spacing: { before: 80, after: 80 },
          shading: { fill: 'F5F5F5', type: ShadingType.CLEAR }
        }));
        codeBuffer = [];
        inCode = false;
      } else {
        flushTable();
        inCode = true;
      }
      i++; continue;
    }
    if (inCode) { codeBuffer.push(line); i++; continue; }

    // table row
    if (line.trim().startsWith('|')) {
      tableBuffer.push(line.trim());
      i++; continue;
    } else {
      flushTable();
    }

    // headings
    const h1 = line.match(/^# (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    if (h1) {
      elements.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: inlineRuns(h1[1]), spacing: { before: 360, after: 120 } }));
      i++; continue;
    }
    if (h2) {
      elements.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: inlineRuns(h2[1]), spacing: { before: 240, after: 80 } }));
      i++; continue;
    }
    if (h3) {
      elements.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(h3[1]), spacing: { before: 180, after: 60 } }));
      i++; continue;
    }

    // blockquote (metadata lines starting with >)
    if (line.trim().startsWith('>')) {
      const text = line.replace(/^>\s?/, '').trim();
      if (text) elements.push(new Paragraph({
        children: inlineRuns(text),
        indent: { left: 720 },
        spacing: { before: 40, after: 40 },
      }));
      i++; continue;
    }

    // bullet
    if (line.match(/^- /)) {
      elements.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: inlineRuns(line.replace(/^- /, '')),
      }));
      i++; continue;
    }
    // sub-bullet (  - or    -)
    if (line.match(/^\s{2,}- /)) {
      elements.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: inlineRuns(line.replace(/^\s+- /, '')),
        indent: { left: 1080 },
      }));
      i++; continue;
    }
    // numbered list
    if (line.match(/^\d+\. /)) {
      elements.push(new Paragraph({
        children: inlineRuns(line),
        indent: { left: 720 },
        spacing: { before: 40, after: 40 },
      }));
      i++; continue;
    }

    // horizontal rule
    if (line.trim() === '---') { i++; continue; }

    // empty line
    if (line.trim() === '') {
      elements.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 60 } }));
      i++; continue;
    }

    // normal paragraph
    elements.push(new Paragraph({
      children: inlineRuns(line.trim()),
      spacing: { before: 40, after: 40 },
    }));
    i++;
  }
  flushTable();

  return { elements, numbering };
}

function makeDoc(md, filename) {
  const { elements, numbering } = parseMd(md);
  const docTitle = filename.replace('.md', '');

  const doc = new Document({
    numbering,
    styles: {
      default: {
        document: { run: { font: 'Malgun Gothic', size: 22 } }
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Malgun Gothic', color: '1F3864' },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1F3864', space: 1 } } }
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Malgun Gothic', color: '2E75B6' },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 }
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Malgun Gothic', color: '404040' },
          paragraph: { spacing: { before: 180, after: 60 }, outlineLevel: 2 }
        },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1700 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: '삼성자산운용 AX/PI센터', font: 'Malgun Gothic', size: 18, color: '888888' }),
              new TextRun({ text: '  |  ', font: 'Malgun Gothic', size: 18, color: 'CCCCCC' }),
              new TextRun({ text: docTitle, font: 'Malgun Gothic', size: 18, bold: true, color: '555555' }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 1 } }
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: '2026-07-06  |  ', font: 'Malgun Gothic', size: 16, color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Malgun Gothic', size: 16, color: '888888' }),
            ],
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 1 } }
          })]
        })
      },
      children: elements
    }]
  });
  return doc;
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  for (const f of FILES) {
    const mdPath = path.join(DOCS_DIR, f);
    const outName = f.replace('.md', '.docx');
    const outPath = path.join(OUT_DIR, outName);
    console.log(`Converting ${f} ...`);
    try {
      const md = fs.readFileSync(mdPath, 'utf8');
      const doc = makeDoc(md, f.replace('.md', ''));
      const buf = await Packer.toBuffer(doc);
      fs.writeFileSync(outPath, buf);
      console.log(`  -> ${outPath} (${Math.round(buf.length/1024)} KB)`);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
    }
  }
  console.log('Done.');
})();
