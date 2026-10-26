"""Collect the real numbers produced by the experiments into report_kit/fact_sheet.md.

It writes facts and tables only — no prose. Anything not yet produced is marked NOT RUN, never guessed.
Usage: python -m experiments.build_fact_sheet
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pandas as pd

from experiments.common import OUT_DIR, PROJECT_ROOT

OUT = PROJECT_ROOT / "report_kit" / "fact_sheet.md"


def load(name: str):
    p = OUT_DIR / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def table(name: str) -> str:
    p = OUT_DIR / f"{name}.md"
    return p.read_text(encoding="utf-8") if p.exists() else f"_{name}: NOT RUN_"


def main() -> None:
    L: list[str] = [f"# Fact sheet (generated {date.today()}) — numbers only, write the prose yourself", ""]

    audit = load("dataset_audit.json")
    L += ["## Dataset and split", ""]
    if audit:
        old, new = audit["legacy_split_sizes"], audit["clean_split_sizes"]
        L += [f"- Old split: {sum(old.values()):,} files (train {old['train']:,} / val {old['val']:,} / test {old['test']:,}).",
              f"- Clean split after content-hash deduplication: {sum(new.values()):,} unique images "
              f"(train {new['train']:,} / val {new['val']:,} / test {new['test']:,}).",
              f"- Files removed as byte-identical copies: {sum(old.values()) - sum(new.values()):,}.", ""]
    L += [table("table_dataset"), ""]

    base = load("base_model_results.json")
    L += ["## Base model (no XAI)", ""]
    if base:
        L += [f"- Test images: {base['n_test']:,}; errors: {base['n_failures']:,}.",
              f"- Accuracy: {base['accuracy']:.2f} %.",
              f"- Macro P/R/F1: {base['macro']['precision']:.4f} / {base['macro']['recall']:.4f} / {base['macro']['f1']:.4f}.",
              f"- Weighted P/R/F1: {base['weighted']['precision']:.4f} / {base['weighted']['recall']:.4f} / {base['weighted']['f1']:.4f}.",
              f"- ECE {base['ece']:.4f}, MCE {base['mce']:.4f}, Brier {base['brier']:.4f}.",
              f"- Mean confidence: correct {base['mean_confidence_correct']:.3f}, wrong "
              f"{base['mean_confidence_wrong'] if base['mean_confidence_wrong'] is None else round(base['mean_confidence_wrong'], 3)}.",
              "- Most frequent confusions (true → predicted: count): "
              + "; ".join(f"{c['true']} → {c['pred']}: {c['count']}" for c in base["top_confusions"][:5]), ""]
    else:
        L += ["_NOT RUN — python -m experiments.run_base_eval_", ""]
    L += [table("table_base_model"), "", table("table_per_class"), "", "### Error detection from confidence / uncertainty", "", table("table_error_detection"), ""]

    hist = PROJECT_ROOT / "models" / "training_history.json"
    if hist.exists():
        h = json.loads(hist.read_text(encoding="utf-8"))
        keys = list(h) if isinstance(h, dict) else []
        L += ["## Training run", "", f"- history keys: {keys}", ""]
        for k in keys:
            if isinstance(h[k], list) and h[k] and isinstance(h[k][-1], (int, float)):
                L.append(f"- {k}: epochs run = {len(h[k])}, last = {h[k][-1]:.4f}")
        L.append("")

    L += ["## XAI study (stratified sample)", "", table("table_xai_summary"), ""]
    xm = OUT_DIR / "xai_metrics.csv"
    if xm.exists():
        df = pd.read_csv(xm)
        L += [f"- images explained: {df.path.nunique():,}; rows: {len(df):,}",
              f"- correct predictions in sample: {int(df.drop_duplicates('path').correct.sum())} of {df.path.nunique()}", ""]
    cons = load("xai_consistency.json")
    if cons:
        L += [f"- agreement matrices computed on {cons['n_images']} images (see consistency figures)", ""]

    L += ["## Input perturbations", "", table("table_perturbation"), ""]
    L += ["## Failure cases", "", table("table_failures"), ""]
    fs = load("failure_stats.json")
    if fs:
        L += ["### Failures vs correct predictions (means)", "", "```json", json.dumps(fs, indent=2), "```", ""]

    exp = OUT_DIR / "expert_feedback_summary.json"
    L += ["## Human expert feedback", ""]
    L += ["```json", exp.read_text(encoding="utf-8"), "```"] if exp.exists() else ["_status: PENDING — no filled rating sheet found_"]
    L += ["", "## Figures available", ""] + [f"- `{p.relative_to(PROJECT_ROOT)}`" for p in sorted((OUT_DIR / "figures").glob("*.png"))]

    OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
