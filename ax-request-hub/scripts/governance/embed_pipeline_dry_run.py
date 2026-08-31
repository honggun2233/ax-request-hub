"""
거버넌스 벡터화 드라이런 — 파싱 결과만 출력
=============================================
DB·OpenAI API 호출 없이 docs/governance/**/*.md 를 파싱해
청크 목록을 stdout에 출력한다. 환경변수 불필요.

실행:
  python scripts/governance/embed_pipeline_dry_run.py
  python scripts/governance/embed_pipeline_dry_run.py --json   # JSON 전체 덤프
  python scripts/governance/embed_pipeline_dry_run.py --docs-dir /path/to/docs
"""

import argparse
import dataclasses
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from parser import parse_file, recompute_is_latest  # noqa: E402

REPO_ROOT = Path(__file__).parent.parent.parent
DEFAULT_DOCS_DIR = REPO_ROOT / "docs" / "governance"


def collect(docs_dir: Path):
    all_meta, all_chunks = [], []

    for f in sorted(docs_dir.rglob("*.md")):
        try:
            meta, chunks = parse_file(f)
        except Exception as e:
            print(f"[SKIP] {f.relative_to(docs_dir)}: {e}", file=sys.stderr)
            continue

        if meta.doc_id == "UNKNOWN":
            print(f"[EXCLUDE] {f.relative_to(docs_dir)}: doc_id=UNKNOWN")
            continue

        all_meta.append(meta)
        all_chunks.extend(chunks)

    return all_meta, all_chunks


def main() -> None:
    parser = argparse.ArgumentParser(description="거버넌스 파싱 드라이런")
    parser.add_argument("--docs-dir", type=Path, default=DEFAULT_DOCS_DIR)
    parser.add_argument("--json", action="store_true", help="JSON 형식으로 전체 덤프")
    args = parser.parse_args()

    docs_dir: Path = args.docs_dir
    if not docs_dir.exists():
        print(f"[ERROR] docs_dir 없음: {docs_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"=== 드라이런 (DB·API 호출 없음) ===")
    print(f"docs_dir : {docs_dir}\n")

    all_meta, all_chunks = collect(docs_dir)
    recompute_is_latest(all_meta, all_chunks)

    if args.json:
        out = {
            "documents": [dataclasses.asdict(m) for m in all_meta],
            "chunks": [dataclasses.asdict(c) for c in all_chunks],
        }
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return

    # 요약 출력
    for meta in all_meta:
        doc_chunks = [c for c in all_chunks if c.doc_id == meta.doc_id]
        is_latest_mark = "✓" if meta.is_latest else " "
        print(
            f"[{is_latest_mark}] {meta.doc_id:35s} {meta.version:6s} "
            f"{meta.approval_status.value:8s} chunks={len(doc_chunks):3d}  {meta.doc_name}"
        )

    print(f"\n문서 {len(all_meta)}개 / 청크 {len(all_chunks)}개")

    # 청크 샘플 (최대 5개)
    sample = all_chunks[:5]
    if sample:
        print("\n--- 청크 샘플 (최대 5개) ---")
        for c in sample:
            preview = c.text[:80].replace("\n", " ")
            print(f"  {c.chunk_id}")
            print(f"    article_no={c.article_no}  risk={c.risk_level}  is_latest={c.is_latest}")
            print(f"    text: {preview}...")
            print()


if __name__ == "__main__":
    main()
