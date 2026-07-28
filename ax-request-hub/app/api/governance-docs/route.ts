import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'
import { db } from '@/src/lib/db'

const DOCS_DIR = path.join(process.cwd(), 'docs')

// GET /api/governance-docs?type=지침   → 문서 목록 (파일 + DB 메타 조합)
// GET /api/governance-docs?file=xxx   → 특정 문서 내용 + 메타데이터
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const file = searchParams.get('file')
  const typeFilter = searchParams.get('type') || ''

  try {
    if (file) {
      if (file.includes('..') || file.includes('/') || file.includes('\\')) {
        return NextResponse.json({ error: '잘못된 파일명' }, { status: 400 })
      }
      const filePath = path.join(DOCS_DIR, file)
      const [content, stats, meta] = await Promise.all([
        readFile(filePath, 'utf-8'),
        stat(filePath),
        db.governanceDoc.findUnique({ where: { fileName: file } }),
      ])
      return NextResponse.json({ file, content, updatedAt: stats.mtime, meta })
    }

    // 목록: 파일 시스템 + DB 메타 조합
    const [entries, allMeta] = await Promise.all([
      readdir(DOCS_DIR),
      db.governanceDoc.findMany(),
    ])

    const metaMap = new Map(allMeta.map(m => [m.fileName, m]))
    const mdFiles = entries.filter(f => f.endsWith('.md') && !f.startsWith('.'))

    const docs = await Promise.all(
      mdFiles.map(async f => {
        const stats = await stat(path.join(DOCS_DIR, f))
        const meta = metaMap.get(f) ?? null
        let title = meta?.title ?? ''
        if (!title) {
          const first = await readFile(path.join(DOCS_DIR, f), 'utf-8').then(c => c.split('\n')[0])
          title = first.replace(/^#+\s*/, '').trim() || f.replace('.md', '')
        }
        return {
          file: f, title, updatedAt: stats.mtime, size: stats.size,
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

    const filtered = typeFilter ? docs.filter(d => d.type === typeFilter) : docs
    filtered.sort((a, b) => {
      if (a.docId && b.docId) return a.docId.localeCompare(b.docId)
      if (a.docId) return -1
      if (b.docId) return 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    return NextResponse.json({ docs: filtered })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
