"""Robustness scenarios: accuracy + explanation stability under realistic input corruptions.

Writes perturbation_results.json (into reports/study/)
"""

from __future__ import annotations

import argparse
import json

import numpy as np
import torch
from tqdm import tqdm

from experiments.common import (
    OUT_DIR, PERTURBATIONS, Explainers, device, load_model, load_rgb, predict, rank_corr, stratified,
    test_samples, to_tensor, topk_iou,
)
from preprocessing.transforms import get_test_transforms

BATCH = 64


def accuracy_under(model, samples, fn, tf) -> tuple[float, float]:
    hits, confs, dev = 0, [], device()
    for s in range(0, len(samples), BATCH):
        chunk = samples[s : s + BATCH]
        x = torch.stack([tf(fn(load_rgb(p))) for p, _ in chunk]).to(dev)
        with torch.no_grad():
            pr = torch.softmax(model(x), dim=1)
        conf, pred = pr.max(1)
        hits += int((pred.cpu().numpy() == np.array([l for _, l in chunk])).sum())
        confs.extend(conf.cpu().tolist())
    return 100.0 * hits / len(samples), float(np.mean(confs))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stability-per-class", type=int, default=7)
    args = ap.parse_args()
    model, tf = load_model(), get_test_transforms()
    engines = Explainers(model)
    samples = test_samples()
    sub = stratified(samples, args.stability_per_class, seed=2)
    results = {"n_accuracy": len(samples), "n_stability": len(sub), "scenarios": {}}

    for name, fn in tqdm(PERTURBATIONS.items(), desc="scenarios"):
        acc, conf = accuracy_under(model, samples, fn, tf)
        rho, iou, flips = [], [], 0
        for path, _ in sub:
            img = load_rgb(path)
            x0 = to_tensor(img)
            cls = int(predict(model, x0).argmax())
            xp = to_tensor(fn(img))
            flips += int(predict(model, xp).argmax() != cls)
            h0 = engines.heatmap("gradcam_pp", x0, cls, img)
            hp = engines.heatmap("gradcam_pp", xp, cls, img)
            rho.append(rank_corr(h0, hp)); iou.append(topk_iou(h0, hp))
        results["scenarios"][name] = {
            "accuracy": acc, "mean_confidence": conf,
            "explanation_spearman": float(np.mean(rho)), "explanation_top20_iou": float(np.mean(iou)),
            "prediction_flip_rate": 100.0 * flips / len(sub),
        }
    (OUT_DIR / "perturbation_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    for k, v in results["scenarios"].items():
        print(f"{k:22s} acc={v['accuracy']:.2f}  expl_rho={v['explanation_spearman']:.2f}  flips={v['prediction_flip_rate']:.1f}%")


if __name__ == "__main__":
    main()
