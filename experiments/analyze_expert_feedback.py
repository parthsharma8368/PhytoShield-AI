"""Summarises filled expert forms (reports/study/expert_packet/filled/*.csv). Prints PENDING if none exist."""

from __future__ import annotations

import json
from glob import glob

import numpy as np
import pandas as pd
from sklearn.metrics import cohen_kappa_score

from experiments.common import OUT_DIR

PACK = OUT_DIR / "expert_packet"


def main() -> None:
    files = sorted(glob(str(PACK / "filled" / "*.csv")))
    if not files:
        (OUT_DIR / "expert_feedback_summary.json").write_text(json.dumps({"status": "PENDING — no expert sheets collected yet"}, indent=2))
        print("PENDING: no filled sheets in", PACK / "filled")
        return
    key = pd.read_csv(PACK / "answer_key.csv")
    df = pd.concat([pd.read_csv(f) for f in files]).merge(key, on="case_id")
    method_map = {"A": "gradcam_pp", "B": "shap", "C": "lime"}
    summary = {
        "status": "collected", "n_experts": int(df.expert_id.nunique()), "n_ratings": int(len(df)),
        "expert_diagnosis_accuracy_vs_label": float((df.own_diagnosis == df.true).mean()),
        "agreement_with_ai_overall": float((df.agrees_with_ai == "yes").mean()),
        "agreement_with_ai_on_ai_correct": float((df[df.ai_correct == 1].agrees_with_ai == "yes").mean()),
        "agreement_with_ai_on_ai_wrong": float((df[df.ai_correct == 0].agrees_with_ai == "yes").mean()) if (df.ai_correct == 0).any() else None,
        "highlight_matches_symptoms_mean": float(df.highlight_matches_symptoms_1to5.mean()),
        "highlight_matches_symptoms_correct_vs_wrong": {
            "correct": float(df[df.ai_correct == 1].highlight_matches_symptoms_1to5.mean()),
            "wrong": float(df[df.ai_correct == 0].highlight_matches_symptoms_1to5.mean()) if (df.ai_correct == 0).any() else None},
        "explanation_helps_trust_mean": float(df.explanation_helps_trust_1to5.mean()),
        "would_act_mean": float(df.would_act_on_diagnosis_1to5.mean()),
        "best_method_votes": df.best_method.map(lambda v: method_map.get(str(v).strip().upper(), "none")).value_counts().to_dict(),
    }
    if df.expert_id.nunique() >= 2:
        wide = df.pivot_table(index="case_id", columns="expert_id", values="highlight_matches_symptoms_1to5")
        a, b = wide.columns[:2]
        both = wide[[a, b]].dropna()
        summary["cohens_kappa_quadratic_highlight_rating"] = float(cohen_kappa_score(both[a].astype(int), both[b].astype(int), weights="quadratic"))
    (OUT_DIR / "expert_feedback_summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
