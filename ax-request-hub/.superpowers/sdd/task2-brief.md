# Task 2: Data Catalog Page + Sidebar Update

## Context
AX Hub — Next.js 14 App Router, Tailwind CSS, no shadcn (just Tailwind classes). 
API routes are already implemented at /api/data/assets (GET open, POST DATA_PLATFORM).
Implement the catalog browse page and add sidebar navigation entries.

## Style Reference
Look at app/registry/page.tsx and app/me/services/page.tsx for the UI pattern:
- 'use client' at top
- useSession() for auth
- useEffect + fetch for data
- Tailwind only (no shadcn imports)
- Card layouts with rounded-xl shadow-sm bg-white p-4
- Badge pattern: `className={\`text-xs px-2 py-1 rounded-full font-medium ${COLOR}\`}`

## Classification badge colors (MUST use exactly)
- G1: `bg-green-100 text-green-800`
- G2: `bg-yellow-100 text-yellow-800`  
- G3: `bg-red-100 text-red-800`

## File 1: app/data/catalog/page.tsx

### Layout
- Page title: "데이터 카탈로그"
- Subtitle: "데이터플랫폼 자산 목록 — 이용신청 또는 신규 수집 요청"
- Search bar (text input, debounced 300ms, updates ?search param)
- Filter row:
  - 기밀등급 chips: 전체 / G1 / G2 / G3 (active chip: bg-blue-600 text-white, inactive: bg-white border text-gray-700)
  - 부서 select dropdown (populated from unique ownerDept values in results)
- Card grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4)

### DataAsset Card
Each card shows:
- Name (font-semibold)
- Classification badge (G1/G2/G3 colors above)
- ownerDept (text-sm text-gray-500)
- updateCycle (if set, text-xs text-gray-400)
- deliveryModes as small chips (API / FILE / DB split by comma)
- description (line-clamp-2 text-sm text-gray-600)
- Two buttons at card bottom:
  - [이용신청] (blue, type=ACCESS) → opens request modal
  - [신규요청] (outline gray, type=NEW) → opens request modal

### Request Modal (inline, not separate file)
Triggered by either button. Shows:
- Asset name in modal header
- type (pre-filled ACCESS or NEW, shown as read-only text)
- projectId: text input (label: "연계 과제 ID", placeholder: "proj_xxx")
- purpose: textarea (label: "이용 목적", required)
- classification: select pre-filled from asset.classification (G1/G2/G3)
- periodMonths: number input (label: "이용 기간(개월)", default: 3, min: 1, max: 24)
- requestedSpec: textarea (label: "요청 명세", shown only when type=NEW)
- Submit button: POST /api/data/requests
- On success: show success message, close modal after 1.5s

### Fetch
- On mount + when search/filters change: fetch `/api/data/assets?search=&classification=&ownerDept=&isActive=true`
- Loading state: show 6 skeleton cards (animate-pulse bg-gray-100 rounded-xl h-40)
- Empty state: "검색 결과가 없습니다" centered

## File 2: components/Sidebar.tsx — add nav entries

Read the current Sidebar.tsx. Add a new section between the '나의 AI' section and 'AI 과제' section:

```
{ section: '데이터' },
{ href: '/data/catalog', label: '📊 데이터 카탈로그' },
{ href: '/me/data', label: '내 데이터 신청' },
```

Also add a DATA_PLATFORM-only nav entry. After ADMIN_NAV array's '에이전트 관리' section, add:
```
{ section: '데이터 플랫폼' },
{ href: '/dp/requests', label: '데이터 요청 검토' },
```

The sidebar renders DATA_PLATFORM users the same as isAdmin for showing ADMIN_NAV.
Check: `const isAdmin = ['AX_TEAM', 'C_LEVEL', 'DATA_PLATFORM'].includes(role)` — update this check if needed so DATA_PLATFORM sees the dp section. If the existing isAdmin check doesn't include DATA_PLATFORM, add it or use a separate `isDataPlatform` variable.

Actually — only show /dp/requests to DATA_PLATFORM (and AX_TEAM). Create a `isDPAdmin = ['AX_TEAM', 'DATA_PLATFORM'].includes(role)` variable and show a separate DP_NAV section conditionally below the main admin nav. Keep existing isAdmin check unchanged to avoid breaking other admin pages.

## Commit
After implementing both files:
1. `npx tsc --noEmit 2>&1 | head -20` — confirm no new errors
2. `git add app/data/catalog/page.tsx components/Sidebar.tsx`
3. `git commit -m "feat(data): 데이터 카탈로그 페이지 + 사이드바 네비게이션 추가"`

## Report file
Write full report to: C:/project/ax-team/ax-request-hub/.superpowers/sdd/task2-report.md
Return: status, commit hash, tsc summary, concerns.
