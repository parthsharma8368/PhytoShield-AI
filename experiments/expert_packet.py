"""Builds the blinded human-expert evaluation packet (agronomist / plant-pathologist feedback).

Writes reports/study/expert_packet/: cases/case_XX.png, expert_form.csv (template), answer_key.csv (DO NOT SHARE),
INSTRUCTIONS.md. Needs predictions.csv from run_base_eval.
"""

from __future__ import annotations

import argparse

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from experiments.common import OUT_DIR, Explainers, class_names, load_model, load_rgb, overlay, to_tensor

FORM_COLUMNS = [
    "case_id", "expert_id",
    "own_diagnosis",            # expert's diagnosis from the photo alone (one of the 15 class names)
    "agrees_with_ai",           # yes / no / unsure
    "highlight_matches_symptoms_1to5",
    "best_method",              # A / B / C / none (letters in answer_key.csv)
    "explanation_helps_trust_1to5",
    "would_act_on_diagnosis_1to5",
    "comments",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-failures", type=int, default=8)
    ap.add_argument("--n-correct", type=int, default=8)
    args = ap.parse_args()

    names, model = class_names(), load_model()
    engines = Explainers(model)
    df = pd.read_csv(OUT_DIR / "predictions.csv")
    rng = np.random.default_rng(7)
    fails = df[df.correct == 0]
    fails = fails.iloc[rng.permutation(len(fails))[: args.n_failures]]
    good = df[df.correct == 1].sample(frac=1, random_state=7).drop_duplicates("true")  # one correct case per class
    good = good.iloc[rng.permutation(len(good))[: args.n_correct]]
    cases = pd.concat([fails, good]).iloc[lambda d: rng.permutation(len(d))].reset_index(drop=True)

    out = OUT_DIR / "expert_packet"
    (out / "cases").mkdir(parents=True, exist_ok=True)
    key = []
    for i, r in cases.iterrows():
        cid = f"C{i + 1:02d}"
        img = load_rgb(r.path)
        x = to_tensor(img)
        maps, _ = engines.run(["gradcam_pp", "shap", "lime"], x, int(r.pred), img)
        fig, ax = plt.subplots(1, 4, figsize=(11, 3.2))
        ax[0].imshow(img.resize((224, 224))); ax[0].set_title("Leaf photo", fontsize=9)
        for a, (m, t) in zip(ax[1:], (("gradcam_pp", "Method A"), ("shap", "Method B"), ("lime", "Method C"))):
            a.imshow(overlay(img, maps[m])); a.set_title(t, fontsize=9)
        for a in ax:
            a.axis("off")
        fig.suptitle(f"{cid} — AI diagnosis: {names[int(r.pred)].replace('_', ' ')}  (confidence {r.conf * 100:.0f}%)", fontsize=10)
        fig.tight_layout()
        fig.savefig(out / "cases" / f"{cid}.png", dpi=150)
        plt.close(fig)
        key.append({"case_id": cid, "path": r.path, "true": names[int(r.true)], "ai_pred": names[int(r.pred)],
                    "ai_correct": int(r.correct), "ai_conf": r.conf,
                    "method_A": "gradcam_pp", "method_B": "shap", "method_C": "lime"})
    pd.DataFrame(key).to_csv(out / "answer_key.csv", index=False)
    pd.DataFrame(columns=FORM_COLUMNS).to_csv(out / "expert_form.csv", index=False)
    (out / "INSTRUCTIONS.md").write_text(
        "# Expert evaluation — plant disease AI\n\n"
        f"You will see {len(key)} leaf photos (cases C01–C{len(key):02d}). Each shows the photo, the AI's diagnosis and "
        "three highlight maps (Methods A, B, C) that colour the areas the AI relied on (red = most important).\n\n"
        "For every case, fill **one row** in `expert_form.csv`:\n\n"
        "| Column | Meaning |\n|---|---|\n"
        "| own_diagnosis | what *you* think it is, from the photo alone (before looking at the AI) |\n"
        "| agrees_with_ai | yes / no / unsure |\n"
        "| highlight_matches_symptoms_1to5 | 1 = highlights point at healthy tissue or background, 5 = exactly on the symptoms |\n"
        "| best_method | A / B / C / none — which map is the most useful to you |\n"
        "| explanation_helps_trust_1to5 | 1 = no help, 5 = strongly helps you decide whether to trust the AI |\n"
        "| would_act_on_diagnosis_1to5 | 1 = would not act, 5 = would act on it (e.g. spray) |\n"
        "| comments | anything unusual, wrong or unclear |\n\n"
        "Please do not discuss cases with other experts until you have submitted your sheet. "
        "Include your `expert_id` (initials / ID) and your years of experience in the comments of the first row.\n",
        encoding="utf-8")
    print(f"expert packet: {len(key)} cases ({int((cases.correct == 0).sum())} failures) -> {out}")


if __name__ == "__main__":
    main()
