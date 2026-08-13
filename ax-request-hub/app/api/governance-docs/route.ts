import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import type { Dirent } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

const DOCS_DIR = path.join(process.cwd(), 'docs')
const GOVERNANCE_SUBDIR = path.join(DOCS_DIR, 'governance')

// 재귀적으로 .md 파일 목록 반환 (relative path 기준)
async function collectMdFiles(dir: string, base: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results: string[] = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) {
      // 참조/압축본 폴더 스킵 — l1/l2/l3 폴더만 스캔
      if (['archive', 'docx', 'meta', 'slim', 'full', 'operations'].includes(e.name)) continue
      const sub = await collectMdFiles(path.join(dir, e.name), rel)
      results.push(...sub)
    } else if (e.name.endsWith('.md')) {
      results.push(rel)
    }
  }
  return results
}

// GET /api/governance-docs?type=지침   → 문서 목록 (파일 + DB 메타 조합)
// GET /api/governance-docs?file=xxx   → 특정 문서 내용 + 메타데이터 (xxx = relative path)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const file = searchParams.get('file')
  const typeFilter = searchParams.get('type') || ''

  try {
    if (file) {
      // 경로 안전성 검증
      if (file.includes('..')) {
        return NextResponse.json({ error: '잘못된 파일명' }, { status: 400 })
      }
      const filePath = path.resolve(DOCS_DIR, file)
      if (!filePath.startsWith(DOCS_DIR + path.sep) && filePath !== DOCS_DIR) {
        return NextResponse.json({ error: '잘못된 파일명' }, { status: 400 })
      }
      const [content, stats, meta] = await Promise.all([
        readFile(filePath, 'utf-8'),
        stat(filePath),
        prisma.governanceDoc.findUnique({ where: { fileName: file } }),
      ])
      return NextResponse.json({ file, content, updatedAt: stats.mtime, meta })
    }

    // 목록: governance/ 하위 전체 (full + operations) + docs/ 루트 .md
    const [governanceFiles, rootEntries, allMeta] = await Promise.all([
      collectMdFiles(GOVERNANCE_SUBDIR, 'governance').catch(() => []),
      readdir(DOCS_DIR, { withFileTypes: true }).catch(() => []),
      prisma.governanceDoc.findMany(),
    ])

    const rootMdFiles = (rootEntries as Dirent[])
      .filter(e => !e.isDirectory() && e.name.endsWith('.md') && !e.name.startsWith('.'))
      .map(e => e.name)

    const governanceSet = new Set(governanceFiles)
    const allFiles = [...governanceFiles, ...rootMdFiles.filter(f => !governanceSet.has(f))]

    const metaMap = new Map(allMeta.map(m => [m.fileName, m]))

    const docs = await Promise.all(
      allFiles.map(async (relPath) => {
        const absPath = path.join(DOCS_DIR, relPath)
        const stats = await stat(absPath)
        const meta = metaMap.get(relPath) ?? null
        let title = meta?.title ?? ''
        if (!title) {
          const first = await readFile(absPath, 'utf-8').then(c => c.split('\n')[0])
          title = first.replace(/^#+\s*/, '').trim() || path.basename(relPath, '.md')
        }
        return {
          file: relPath, title, updatedAt: stats.mtime, size: stats.size,
          registered: !!meta,
          docId: meta?.docId ?? null,
          type: meta?.type ?? null,
          level: meta?.level ?? null,
          version: meta?.version ?? null,
          author: meta?.author ?? null,
          approvedBy: meta?.approvedBy ?? null,
          approvedAt: meta?.approvedAt ?? null,
          securityLevel: meta?.securityLevel ?? null,
          status: meta?.status ?? 'unregistered',
          description: meta?.description ?? null,
          id: meta?.id ?? null,
        }
      })
    )

    const LEVEL_ORDER: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4 }
    const TYPE_ORDER: Record<string, number> = {
      규정: 1, 지침: 2, 가이드라인: 3, 매뉴얼: 4,
    }

    const filtered = typeFilter ? docs.filter(d => d.type === typeFilter) : docs
    filtered.sort((a, b) => {
      // 등록된 문서 먼저
      if (a.registered !== b.registered) return a.registered ? -1 : 1
      // 레벨 우선 (L1 → L2 → L3)
      const la = LEVEL_ORDER[a.level ?? 'L4'] ?? 9
      const lb = LEVEL_ORDER[b.level ?? 'L4'] ?? 9
      if (la !== lb) return la - lb
      // 같은 레벨 내 타입 순서
      const ta = TYPE_ORDER[a.type ?? ''] ?? 9
      const tb = TYPE_ORDER[b.type ?? ''] ?? 9
      if (ta !== tb) return ta - tb
      // 마지막은 docId 순
      return (a.docId ?? '').localeCompare(b.docId ?? '')
    })

    return NextResponse.json({ docs: filtered })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
