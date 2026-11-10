"""Report duplicated blocks of code (cleanup audit 2026-11-09, item 15). Report only: it never fails a build.

    pnpm dups            # the 25 largest groups in src/
    pnpm dups -- tests   # another folder, or several

A block is `WINDOW` consecutive non-blank, non-comment lines, compared after collapsing whitespace. Blocks found in
more than one place are grouped by the set of files they appear in; a group's size is how many such blocks it shares.
The Russian dictionaries and the research data are left out (they repeat by design).
"""
import collections
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
WINDOW = 10
SKIP_DIRS = ("/i18n/ru", "/research")
TRIVIAL = {"}", ");", "});", "]", "],", "})", "{", ")}", "/>", ">", "</>", "<>"}


def lines(path: pathlib.Path):
    out = []
    for n, raw in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
        s = re.sub(r"\s+", " ", raw.strip())
        if not s or s.startswith(("//", "*", "/*")) or s in TRIVIAL:
            continue
        out.append((n, s))
    return out


def groups(roots, window=WINDOW):
    seen = collections.defaultdict(list)
    for root in roots:
        for path in sorted((ROOT / root).rglob("*")):
            rel = path.relative_to(ROOT).as_posix()
            if path.suffix not in (".ts", ".tsx", ".mjs", ".css") or any(d in "/" + rel for d in SKIP_DIRS):
                continue
            ls = lines(path)
            for k in range(len(ls) - window + 1):
                h = hashlib.md5("\n".join(x[1] for x in ls[k : k + window]).encode()).hexdigest()
                seen[h].append((rel, ls[k][0]))
    by_files = collections.Counter()
    first = {}
    for places in seen.values():
        if len(places) < 2:
            continue
        key = tuple(sorted({p[0] for p in places}))
        by_files[key] += 1
        first.setdefault(key, sorted(places)[:4])
    return by_files, first


def main(argv):
    roots = argv or ["src"]
    by_files, first = groups(roots)
    total = sum(by_files.values())
    print(f"{total} duplicated {WINDOW}-line blocks in {', '.join(roots)}; largest groups:")
    for key, n in by_files.most_common(25):
        where = ", ".join(f"{f}:{line}" for f, line in first[key])
        print(f"{n:4}  {' | '.join(key)}\n      e.g. {where}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
