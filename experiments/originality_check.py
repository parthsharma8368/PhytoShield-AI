"""Local pre-submission checks for the written report. It does NOT replace the university's plagiarism tool.

  python -m experiments.originality_check path/to/draft.tex|md|txt|docx [--refs report_kit/references.bib]

1. Copy-through: finds runs of >= N identical words between the draft and the project's own text (README, fact sheets,
   generated tables, slide notes). A long run means a passage was pasted instead of written in your own words.
2. Citations: every [n] / \\cite{key} must exist in the reference list and every reference must be cited.
3. Number audit: every figure quoted in the draft (e.g. 97.31%) must be traceable to a file under reports/study/.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [ROOT / "README.md", *sorted((ROOT / "report_kit").glob("*.md")), *sorted((ROOT / "reports" / "study").glob("*.md"))]
NUM = re.compile(r"(?<![\w.])\d+(?:\.\d+)?%?")


def read_text(path: Path) -> str:
    if path.suffix == ".docx":
        from docx import Document  # python-docx
        return "\n".join(p.text for p in Document(str(path)).paragraphs)
    return path.read_text(encoding="utf-8", errors="ignore")


def words(text: str) -> list[str]:
    text = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?", " ", text)  # strip LaTeX commands
    return re.findall(r"[a-z0-9']+", text.lower())


def longest_shared_runs(draft: list[str], source: list[str], n: int) -> list[str]:
    grams = {tuple(source[i : i + n]) for i in range(len(source) - n + 1)}
    runs, i = [], 0
    while i <= len(draft) - n:
        if tuple(draft[i : i + n]) in grams:
            j = i + n
            while j < len(draft) and tuple(draft[j - n + 1 : j + 1]) in grams:
                j += 1
            runs.append(" ".join(draft[i:j]))
            i = j
        else:
            i += 1
    return runs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("draft", type=Path)
    ap.add_argument("--refs", type=Path, default=ROOT / "report_kit" / "references.bib")
    ap.add_argument("--run", type=int, default=8, help="flag shared word runs of at least this length")
    args = ap.parse_args()

    raw = read_text(args.draft)
    dw = words(raw)
    print(f"draft: {len(dw)} words\n")
    problems = 0

    print(f"== 1. copy-through from project text (runs >= {args.run} words) ==")
    for src in SOURCES:
        if not src.exists() or src.resolve() == args.draft.resolve():
            continue
        for run in longest_shared_runs(dw, words(src.read_text(encoding="utf-8", errors="ignore")), args.run):
            problems += 1
            print(f"  [{src.relative_to(ROOT)}] ({len(run.split())} words) “{run[:140]}…”")
    print("  none" if problems == 0 else "  → rewrite these passages in your own words\n")

    print("== 2. citations ==")
    refs = args.refs.read_text(encoding="utf-8") if args.refs.exists() else ""
    keys = set(re.findall(r"@\w+\{([^,\s]+),", refs))
    cited = {k.strip() for grp in re.findall(r"\\cite[tp]?\{([^}]*)\}", raw) for k in grp.split(",")}
    numeric = {int(n) for grp in re.findall(r"\[(\d+(?:\s*[,–-]\s*\d+)*)\]", raw) for n in re.findall(r"\d+", grp)}
    if cited and not keys:
        problems += 1; print(f"  {len(cited)} \\cite keys used but {args.refs} is missing or empty")
    if keys:
        for k in sorted(cited - keys):
            problems += 1; print(f"  cited but missing from references: {k}")
        for k in sorted(keys - cited):
            print(f"  in references but never cited: {k}")
    elif numeric:
        print(f"  numeric citations used: {sorted(numeric)} (check each against your reference list manually)")
    if not cited and not numeric:
        problems += 1; print("  no citations found in the draft")

    print("== 3. number audit (figures quoted vs reports/study) ==")
    known = set()
    for f in [*(ROOT / "reports" / "study").glob("*.json"), *(ROOT / "reports" / "study").glob("*.csv"), *(ROOT / "reports" / "study").glob("*.md")]:
        known.update(m.rstrip("%") for m in NUM.findall(f.read_text(encoding="utf-8", errors="ignore")))
    def traceable(n: str) -> bool:
        try:
            v = float(n)
        except ValueError:
            return True
        dec = len(n.split(".")[1]) if "." in n else 0
        return any(k and abs(float(k) - v) <= 0.5 * 10 ** -dec + 1e-9 or abs(float(k) * 100 - v) <= 0.5 * 10 ** -dec + 1e-9
                   for k in known if re.fullmatch(r"\d+(\.\d+)?", k))
    seen: set[str] = set()
    for m in NUM.findall(re.sub(r"\[\d[^\]]*\]|\\cite\w*\{[^}]*\}", "", raw)):
        n = m.rstrip("%")
        if "." not in n and "%" not in m or n in seen:
            continue
        seen.add(n)
        if not traceable(n):
            problems += 1; print(f"  {m} — not found in reports/study (source it or remove it)")
    print(f"\n{problems} item(s) to review")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
