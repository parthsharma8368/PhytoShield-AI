"""How accurate is the leaf-damage percentage? Two checks, both written to reports/study/severity_validation.json.

1. Specificity: real healthy test leaves should read close to 0 %.
2. Accuracy against known truth: paint brown lesions of known area onto healthy leaves and compare the estimate.
   This is a synthetic test. PlantVillage has no expert lesion masks, so real-lesion accuracy is NOT measured here.

  python -m experiments.validate_severity
"""

from __future__ import annotations

import json

import cv2
import numpy as np
from PIL import Image

from evaluation.decision_support import SEG_SIZE, quantify_foliar_lesion_severity, segment_leaf_and_lesions
from experiments.common import OUT_DIR, class_names, test_samples

TARGETS = (5, 10, 25)


def paint_lesions(rgb: np.ndarray, leaf: np.ndarray, target_pct: float, rng: np.random.Generator) -> tuple[np.ndarray, float]:
    """Brown elliptical lesions inside the leaf. Returns the painted image and the true % of the leaf painted."""
    inside = cv2.erode(leaf.astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
    ys, xs = np.nonzero(inside)
    if len(ys) < 500:
        return rgb, 0.0
    out, painted = rgb.copy(), np.zeros(leaf.shape, np.uint8)
    goal = target_pct / 100.0 * leaf.sum()
    for _ in range(200):
        if painted.sum() >= goal:
            break
        i = rng.integers(len(ys))
        axes = (int(rng.integers(5, 16)), int(rng.integers(5, 16)))
        cv2.ellipse(painted, (int(xs[i]), int(ys[i])), axes, float(rng.integers(0, 180)), 0, 360, 1, -1)
    painted = painted.astype(bool) & leaf
    hsv = np.zeros_like(rgb)
    hsv[..., 0] = rng.integers(8, 18, leaf.shape)
    hsv[..., 1] = rng.integers(140, 200, leaf.shape)
    hsv[..., 2] = rng.integers(70, 120, leaf.shape)
    out[painted] = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)[painted]
    return out, float(100.0 * painted.sum() / leaf.sum())


def main() -> None:
    names = class_names()
    healthy = [p for p, y in test_samples() if "healthy" in names[y].lower()]
    rng = np.random.default_rng(0)
    picks = [healthy[i] for i in rng.permutation(len(healthy))[:120]]

    spec = [quantify_foliar_lesion_severity(Image.open(p))["affected_leaf_percentage"] for p in picks]
    unmeasurable = sum(v is None for v in spec)
    spec = np.array([v for v in spec if v is not None])

    truth, est = [], []
    for p in picks[:60]:
        seg = segment_leaf_and_lesions(Image.open(p))
        if seg is None:
            continue
        leaf, _, rgb = seg
        for t in TARGETS:
            painted, true_pct = paint_lesions(rgb, leaf, t, rng)
            got = quantify_foliar_lesion_severity(Image.fromarray(painted))["affected_leaf_percentage"]
            if got is not None and true_pct > 0:
                truth.append(true_pct); est.append(got)
    truth, est = np.array(truth), np.array(est)

    def stage(v: np.ndarray) -> np.ndarray:
        return np.digitize(v, [10.0, 25.0 + 1e-9])

    result = {
        "specificity_real_healthy_leaves": {
            "n": int(len(spec)), "not_measurable": int(unmeasurable),
            "mean_pct": round(float(spec.mean()), 2), "median_pct": round(float(np.median(spec)), 2),
            "p95_pct": round(float(np.percentile(spec, 95)), 2),
            "share_below_5pct": round(float((spec < 5).mean()), 3),
        },
        "accuracy_synthetic_lesions": {
            "n": int(len(truth)), "target_pct": list(TARGETS),
            "mean_absolute_error_pct_points": round(float(np.abs(est - truth).mean()), 2),
            "pearson_r": round(float(np.corrcoef(truth, est)[0, 1]), 3),
            "stage_agreement": round(float((stage(truth) == stage(est)).mean()), 3),
            "mean_signed_error_pct_points": round(float((est - truth).mean()), 2),
        },
        "note": "Synthetic brown lesions on healthy leaves; no expert-annotated lesion masks exist for PlantVillage.",
    }
    (OUT_DIR / "severity_validation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
