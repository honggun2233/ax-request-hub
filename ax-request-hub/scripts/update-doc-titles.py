"""
거버넌스 문서 제목 정리
1. .md 파일 H1에서 '삼성자산운용' 제거
2. DB GovernanceDoc.title → [type]_실제제목 포맷으로 업데이트
"""
import sqlite3, os, re

DOCS_ROOT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'governance')
DB_PATH   = os.path.join(os.path.dirname(__file__), '..', 'prisma', 'dev.db')

# ── 1. 파일 H1에서 '삼성자산운용' 제거 ─────────────────────────────
def strip_company(text: str) -> str:
    return text.replace('삼성자산운용 ', '').replace('삼성자산운용', '')

changed_files = []
for subdir in ['full', 'operations']:
    dir_path = os.path.join(DOCS_ROOT, subdir)
    for fname in sorted(os.listdir(dir_path)):
        if not fname.endswith('.md'):
            continue
        fpath = os.path.join(dir_path, fname)
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        lines = content.split('\n')
        if lines and lines[0].startswith('# ') and '삼성자산운용' in lines[0]:
            old = lines[0]
            lines[0] = '# ' + strip_company(lines[0][2:])
            new_content = '\n'.join(lines)
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            changed_files.append((fname, old, lines[0]))
            print(f'  [수정] {fname}')
            print(f'    전: {old}')
            print(f'    후: {lines[0]}')

if not changed_files:
    print('  [이미 정리됨] 삼성자산운용 없음')

# ── 2. DB title → [type]_실제제목 ──────────────────────────────────
# docId → (type, 새 title) 매핑
# 실제 파일 H1에서 읽은 제목 사용

def get_h1(rel_path: str) -> str:
    abs_path = os.path.join(os.path.dirname(__file__), '..', 'docs', rel_path.replace('/', os.sep))
    with open(abs_path, 'r', encoding='utf-8-sig') as f:
        first = f.readline().strip()
    return first.lstrip('#').strip()

conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()
cur.execute('SELECT docId, fileName, type, title FROM GovernanceDoc ORDER BY docId')
rows = cur.fetchall()

print('\n── DB title 업데이트 ──')
for (doc_id, file_name, dtype, old_title) in rows:
    # 파일에서 실제 H1 읽기
    try:
        real_h1 = get_h1(file_name)
        real_h1 = strip_company(real_h1)  # 혹시 남은 경우 제거
    except Exception:
        real_h1 = strip_company(old_title.split('_', 1)[-1] if '_' in old_title else old_title)

    new_title = f'[{dtype}]_{real_h1}'
    cur.execute('UPDATE GovernanceDoc SET title = ?, updatedAt = datetime("now") WHERE docId = ?',
                (new_title, doc_id))
    print(f'  {doc_id}: {new_title}')

conn.commit()
conn.close()
print('\n완료.')
