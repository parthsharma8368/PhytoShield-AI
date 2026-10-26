"""Failure-case study: explanations for every misclassified test image.

Needs predictions.csv from run_base_eval. Writes failure_cases.csv and failures/*.png (into reports/study/)
"""

from __future__ import annotations

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from tqdm import tqdm

from experiments.common import (
    CONFIG, OUT_DIR, Explainers, class_names, load_model, load_rgb, overlay, predict, to_tensor,
)
from explainability.counterfactual import CounterfactualExplainer
from explainability.metrics import compute_localization, compute_sparsity
from preprocessing.transforms import preprocess_image_for_inference

PANEL_METHODS = ["gradcam_pp", "ig", "shap", "lime"]
PANEL_TITLES = {"gradcam_pp": "Grad-CAM++", "ig": "Integrated Gradients", "shap": "SHAP", "lime": "LIME"}


def short(name: str) -> str:
    return name.replace("__", "_").replace("___", "_").replace("_", " ").strip()


def main() -> None:
    names, model = class_names(), load_model()
    engines = Explainers(model)
    mapping = json.loads((CONFIG.DATA_DIR / "class_mapping.json").read_text())
    cf = CounterfactualExplainer(model=model, class_mapping=mapping)
    df = pd.read_csv(OUT_DIR / "predictions.csv")
    fails = df[df.correct == 0].sort_values("conf", ascending=False).reset_index(drop=True)
    (OUT_DIR / "failures").mkdir(exist_ok=True)

    rows = []
    for i, r in tqdm(fails.iterrows(), total=len(fails), desc="failure cases"):
        image = load_rgb(r.path)
        x = to_tensor(image)
        pred = int(r.pred)
        maps, _ = engines.run(PANEL_METHODS, x, pred, image)
        ok = {m: h for m, h in maps.items() if h is not None}
        gcp = ok.get("gradcam_pp")
        row = {
            "id": i, "path": r.path, "true": names[int(r.true)], "pred": names[pred], "conf": r.conf,
            "second": names[int(r.second)], "second_conf": r.second_conf, "mc_std": r.mc_std, "mc_entropy": r.mc_entropy,
        }
        for m, h in ok.items():
            row[f"{m}_localization"] = compute_localization(image, h)
            row[f"{m}_sparsity"] = compute_sparsity(h)["sparsity_score"]
        try:
            res = cf.generate_counterfactual(original_image=image, heatmap=gcp, target_class_idx=pred,
                                             preprocess_fn=preprocess_image_for_inference)
            row["cf_confidence_drop"] = res.get("confidence_drop")
            row["cf_lesion_pct"] = res.get("lesion_surface_percentage")
            row["cf_new_class"] = res.get("counterfactual_predicted_class")
        except Exception:  # noqa: BLE001
            row["cf_confidence_drop"] = row["cf_lesion_pct"] = row["cf_new_class"] = None
        rows.append(row)

        fig, ax = plt.subplots(1, 1 + len(ok), figsize=(3.0 * (1 + len(ok)), 3.5))
        ax[0].imshow(image.resize((224, 224))); ax[0].set_title("input", fontsize=9)
        for a, (m, h) in zip(ax[1:], ok.items()):
            a.imshow(overlay(image, h)); a.set_title(PANEL_TITLES[m], fontsize=9)
        for a in ax:
            a.axis("off")
        fig.suptitle(f"TRUE: {short(names[int(r.true)])}   →   PREDICTED: {short(names[pred])} ({r.conf * 100:.1f}%)", fontsize=10)
        fig.tight_layout()
        fig.savefig(OUT_DIR / "failures" / f"failure_{i:02d}.png", dpi=130)
        plt.close(fig)

    pd.DataFrame(rows).to_csv(OUT_DIR / "failure_cases.csv", index=False)
    print(f"{len(rows)} failure cases analysed")


if __name__ == "__main__":
    main()
