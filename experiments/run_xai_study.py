"""XAI study: quantitative comparison of all attribution engines on a stratified test sample.

Usage: python -m experiments.run_xai_study [--per-class 20] [--lime-per-class 5]
Writes xai_metrics.csv, xai_curves.npz, xai_consistency.json, xai_examples.npz (into reports/study/)
"""

from __future__ import annotations

import argparse
import itertools
import json

import numpy as np
import pandas as pd
from tqdm import tqdm

from experiments.common import (
    METHODS, OUT_DIR, Explainers, auc, class_names, deletion_insertion, load_model, load_rgb, predict,
    rank_corr, stratified, test_samples, to_tensor, topk_iou,
)
from explainability.metrics import compute_localization, compute_sparsity


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=20)
    ap.add_argument("--lime-per-class", type=int, default=5)
    args = ap.parse_args()

    names, model = class_names(), load_model()
    engines = Explainers(model)
    sample = stratified(test_samples(), args.per_class, seed=0)
    lime_ok = {p for p, _ in stratified(sample, args.lime_per_class, seed=1)}
    rng = np.random.default_rng(0)

    rows, curves, pair_sp, pair_iou, examples = [], {m: {"del": [], "ins": []} for m in [*METHODS, "random"]}, [], [], {}
    for path, label in tqdm(sample, desc="XAI study"):
        image = load_rgb(path)
        x = to_tensor(image)
        probs = predict(model, x)
        cls = int(probs.argmax())
        use = [m for m in METHODS if m != "lime" or path in lime_ok]
        maps, secs = engines.run(use, x, cls, image)

        # random-attribution baseline (3 draws) — a faithful method must beat this
        for k in range(3):
            fr, pd_, pi_ = deletion_insertion(model, x, rng.random((224, 224)).astype(np.float32), cls)
            curves["random"]["del"].append(pd_); curves["random"]["ins"].append(pi_)
            rows.append({"path": path, "label": label, "pred": cls, "correct": int(cls == label), "method": "random",
                         "del_auc": auc(fr, pd_), "ins_auc": auc(fr, pi_), "localization": np.nan,
                         "sparsity": np.nan, "seconds": 0.0, "draw": k})

        ok = {m: h for m, h in maps.items() if h is not None}
        for m, h in ok.items():
            fr, p_del, p_ins = deletion_insertion(model, x, h, cls)
            curves[m]["del"].append(p_del); curves[m]["ins"].append(p_ins)
            rows.append({"path": path, "label": label, "pred": cls, "correct": int(cls == label), "method": m,
                         "del_auc": auc(fr, p_del), "ins_auc": auc(fr, p_ins),
                         "localization": compute_localization(image, h),
                         "sparsity": compute_sparsity(h)["sparsity_score"], "seconds": secs[m], "draw": 0})
        for a, b in itertools.combinations(ok, 2):
            pair_sp.append({"a": a, "b": b, "v": rank_corr(ok[a], ok[b])})
            pair_iou.append({"a": a, "b": b, "v": topk_iou(ok[a], ok[b])})
        if label not in examples and len(ok) == len(METHODS):
            examples[label] = (path, cls, ok)

    pd.DataFrame(rows).to_csv(OUT_DIR / "xai_metrics.csv", index=False)
    np.savez_compressed(OUT_DIR / "xai_curves.npz", fracs=fr,
                        **{f"{m}_{k}": np.array(v) for m, d in curves.items() for k, v in d.items() if v})

    def mean_matrix(pairs: list[dict]) -> dict:
        df = pd.DataFrame(pairs)
        return {f"{a}|{b}": float(g.v.mean()) for (a, b), g in df.groupby(["a", "b"])}

    (OUT_DIR / "xai_consistency.json").write_text(json.dumps(
        {"spearman": mean_matrix(pair_sp), "top20_iou": mean_matrix(pair_iou), "n_images": len(sample)}, indent=2))
    flat = {f"{label}__{k}": v for label, (path, cls, ok) in examples.items() for k, v in ok.items()}
    np.savez_compressed(OUT_DIR / "xai_examples.npz", **flat,
                        meta=json.dumps({str(l): {"path": p, "pred": c} for l, (p, c, _) in examples.items()}))
    print(f"done: {len(sample)} images, classes={names[:1]}…")


if __name__ == "__main__":
    main()
