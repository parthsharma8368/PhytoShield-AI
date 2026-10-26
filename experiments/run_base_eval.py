"""Base-model evaluation (classifier only, no explanations) on the full held-out test split.

Writes: predictions.csv, base_model_results.json  (into reports/study/)
"""

from __future__ import annotations

import json
from collections import Counter

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support
from tqdm import tqdm

from experiments.common import CONFIG, OUT_DIR, class_names, device, load_model, load_rgb, test_samples
from preprocessing.transforms import get_test_transforms

BATCH = 64
MC_PASSES = 10


def ece_mce(conf: np.ndarray, correct: np.ndarray, bins: int = 15) -> tuple[float, float, list[dict]]:
    edges = np.linspace(0, 1, bins + 1)
    ece, mce, table = 0.0, 0.0, []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.sum() == 0:
            continue
        gap = abs(correct[m].mean() - conf[m].mean())
        ece += m.mean() * gap
        mce = max(mce, gap)
        table.append({"lo": float(lo), "hi": float(hi), "n": int(m.sum()),
                      "confidence": float(conf[m].mean()), "accuracy": float(correct[m].mean())})
    return float(ece), float(mce), table


def main() -> None:
    names, model, tf, dev = class_names(), load_model(), get_test_transforms(), device()
    samples = test_samples()
    rows = []
    for start in tqdm(range(0, len(samples), BATCH), desc="base model inference"):
        chunk = samples[start : start + BATCH]
        x = torch.stack([tf(load_rgb(p)) for p, _ in chunk]).to(dev)
        with torch.no_grad():
            probs = torch.softmax(model(x), dim=1)
            # Monte-Carlo dropout: dropout layers stay active, model otherwise in eval mode
            for m in model.modules():
                if isinstance(m, torch.nn.Dropout):
                    m.train()
            mc = torch.stack([torch.softmax(model(x), dim=1) for _ in range(MC_PASSES)])
            model.eval()
        mc_mean = mc.mean(0)
        top = probs.argmax(1)
        mc_std = mc[:, torch.arange(len(chunk)), top].std(0)
        mc_entropy = -(mc_mean * torch.log2(mc_mean + 1e-12)).sum(1)
        labels_t = torch.tensor([lab for _, lab in chunk], device=dev)
        brier = ((probs - torch.nn.functional.one_hot(labels_t, len(names)).float()) ** 2).sum(1).cpu().numpy()
        p_np = probs.cpu().numpy()
        for i, (path, label) in enumerate(chunk):
            order = np.argsort(p_np[i])[::-1]
            rows.append({
                "path": path, "true": label, "pred": int(order[0]), "conf": float(p_np[i][order[0]]),
                "second": int(order[1]), "second_conf": float(p_np[i][order[1]]),
                "brier": float(brier[i]), "mc_std": float(mc_std[i]), "mc_entropy": float(mc_entropy[i]),
                "correct": int(order[0] == label),
            })
    df = pd.DataFrame(rows)
    df.to_csv(OUT_DIR / "predictions.csv", index=False)

    y, p = df["true"].to_numpy(), df["pred"].to_numpy()
    pr, rc, f1, sup = precision_recall_fscore_support(y, p, labels=range(len(names)), zero_division=0)
    macro = precision_recall_fscore_support(y, p, average="macro", zero_division=0)[:3]
    weighted = precision_recall_fscore_support(y, p, average="weighted", zero_division=0)[:3]
    cm = confusion_matrix(y, p, labels=range(len(names)))
    ece, mce, rel = ece_mce(df["conf"].to_numpy(), df["correct"].to_numpy().astype(float))
    pairs = Counter((names[t], names[q]) for t, q in zip(y, p) if t != q).most_common(10)

    manifest_sizes = {s: sum(len(v) for v in json.loads((CONFIG.DATA_DIR / f"{s}_split.json").read_text()).values())
                      for s in ("train", "val", "test")}
    results = {
        "n_test": int(len(df)), "split_sizes": manifest_sizes,
        "accuracy": float(df["correct"].mean() * 100),
        "macro": dict(zip(("precision", "recall", "f1"), map(float, macro))),
        "weighted": dict(zip(("precision", "recall", "f1"), map(float, weighted))),
        "per_class": {names[i]: {"precision": float(pr[i]), "recall": float(rc[i]), "f1": float(f1[i]), "support": int(sup[i])}
                      for i in range(len(names))},
        "confusion_matrix": cm.tolist(), "class_names": names,
        "ece": ece, "mce": mce, "brier": float(df["brier"].mean()), "reliability_bins": rel,
        "n_failures": int((1 - df["correct"]).sum()),
        "top_confusions": [{"true": t, "pred": q, "count": c} for (t, q), c in pairs],
        "mean_confidence_correct": float(df.loc[df.correct == 1, "conf"].mean()),
        "mean_confidence_wrong": float(df.loc[df.correct == 0, "conf"].mean()) if (df.correct == 0).any() else None,
    }
    (OUT_DIR / "base_model_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"accuracy={results['accuracy']:.2f}%  macroF1={macro[2]:.4f}  ECE={ece:.4f}  failures={results['n_failures']}/{len(df)}")


if __name__ == "__main__":
    main()
