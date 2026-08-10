#!/usr/bin/env python3
import csv, json, hashlib, re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HEADER = ["word","part_of_speech","example","example_zh","chinese","synonyms","antonyms","memory_hint","page","page_end","difficulty"]
CANON = re.compile(r"pages-(\d{3})-(\d{3})\.csv$")
LEGACY = re.compile(r"vocabulary-pages-.*\.csv$")


def read_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        if r.fieldnames != HEADER:
            raise SystemExit(f"Bad header in {path}: {r.fieldnames}")
        rows = []
        for i, row in enumerate(r, start=2):
            if None in row:
                raise SystemExit(f"Extra column in {path}:{i}")
            clean = {k: (row.get(k) or "") for k in HEADER}
            if not clean["word"]:
                raise SystemExit(f"Empty word in {path}:{i}")
            try:
                p = int(clean["page"])
            except Exception:
                raise SystemExit(f"Invalid page in {path}:{i}: {clean['page']!r}")
            if clean["page_end"]:
                try:
                    pe = int(clean["page_end"])
                except Exception:
                    raise SystemExit(f"Invalid page_end in {path}:{i}: {clean['page_end']!r}")
                if pe < p:
                    raise SystemExit(f"page_end < page in {path}:{i}")
            if clean["difficulty"] and clean["difficulty"] not in {"1","2","3","4","5"}:
                raise SystemExit(f"Invalid difficulty in {path}:{i}: {clean['difficulty']!r}")
            rows.append(clean)
        return rows


def sig(rows):
    serial = [json.dumps([r[k] for k in HEADER], ensure_ascii=False, separators=(",", ":")) for r in rows]
    serial.sort()
    return hashlib.sha256("\n".join(serial).encode("utf-8")).hexdigest()


def bucket(page):
    start = ((page - 1) // 10) * 10 + 1
    return start, start + 9


def write_csv(path, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADER, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def main():
    DATA.mkdir(exist_ok=True)
    canonical = sorted(p for p in DATA.glob("pages-*.csv") if CANON.match(p.name))
    legacy = sorted(p for p in DATA.glob("vocabulary-pages-*.csv") if LEGACY.match(p.name))
    source_files = canonical if canonical else legacy
    if not source_files:
        raise SystemExit("No vocabulary CSV source files found")

    source_rows = []
    for p in source_files:
        source_rows.extend(read_csv(p))

    keys = [(r["word"].casefold(), r["page"]) for r in source_rows]
    dup = [k for k, n in Counter(keys).items() if n > 1]
    if dup:
        raise SystemExit(f"Duplicate word/page keys found: {dup[:20]}")

    before_count = len(source_rows)
    before_sig = sig(source_rows)

    groups = defaultdict(list)
    for r in source_rows:
        p = int(r["page"])
        groups[bucket(p)].append(r)

    generated = []
    for (start, end), rows in sorted(groups.items()):
        rows.sort(key=lambda r: (int(r["page"]), r["word"].casefold()))
        name = f"pages-{start:03d}-{end:03d}.csv"
        path = DATA / name
        write_csv(path, rows)
        generated.append(path)

    rebuilt = []
    for p in generated:
        rebuilt.extend(read_csv(p))
    after_count = len(rebuilt)
    after_sig = sig(rebuilt)
    if before_count != after_count or before_sig != after_sig:
        raise SystemExit(f"Integrity verification failed: before={before_count}/{before_sig}, after={after_count}/{after_sig}")

    pages = sorted({int(r["page"]) for r in rebuilt})
    ranges = []
    for path in generated:
        m = CANON.match(path.name)
        start, end = map(int, m.groups())
        rows = read_csv(path)
        actual_pages = sorted({int(r["page"]) for r in rows})
        ranges.append({
            "label": f"{start}-{end}",
            "start": start,
            "end": end,
            "file": f"data/{path.name}",
            "pages": actual_pages,
            "count": len(rows),
        })

    manifest = {
        "schema_version": 1,
        "total_words": len(rebuilt),
        "first_page": min(pages) if pages else None,
        "last_page": max(pages) if pages else None,
        "pages": pages,
        "ranges": ranges,
        "content_sha256": after_sig,
    }
    (DATA / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    index = [{
        "word": r["word"],
        "part_of_speech": r["part_of_speech"],
        "chinese": r["chinese"],
        "page": int(r["page"]),
        "page_end": int(r["page_end"]) if r["page_end"] else None,
        "difficulty": int(r["difficulty"]) if r["difficulty"] else None,
    } for r in sorted(rebuilt, key=lambda r: (int(r["page"]), r["word"].casefold()))]
    (DATA / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    per_page = Counter(int(r["page"]) for r in rebuilt)
    report = {
        "ok": True,
        "source_mode": "canonical" if canonical else "legacy_migration",
        "source_files": [str(p.relative_to(ROOT)) for p in source_files],
        "generated_files": [str(p.relative_to(ROOT)) for p in generated],
        "row_count_before": before_count,
        "row_count_after": after_count,
        "content_sha256_before": before_sig,
        "content_sha256_after": after_sig,
        "field_level_content_identical": before_sig == after_sig,
        "per_page_counts": {str(k): per_page[k] for k in sorted(per_page)},
    }
    (DATA / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if not canonical:
        for p in legacy:
            p.unlink()

    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
