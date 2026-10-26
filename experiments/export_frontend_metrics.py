"""Write frontend/src/generated/metrics.ts from the measured results, so the website never shows a hand-typed number.

Run after experiments/run_all.sh:  python -m experiments.export_frontend_metrics
Anything that has not been measured is exported as "Not measured" / "Pending", never a guess.
"""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
from sklearn.metrics import f1_score, precision_score, recall_score

from experiments.common import OUT_DIR, PROJECT_ROOT, class_names

TARGET = PROJECT_ROOT / "frontend" / "src" / "generated" / "metrics.ts"
NA = "Not measured"

GROUPS = {
    "Fungal Diseases": ("Early/Late Blight, Leaf Mold, Septoria Spot, Target Spot",
                        ["Potato___Early_blight", "Potato___Late_blight", "Tomato_Early_blight", "Tomato_Late_blight",
                         "Tomato_Leaf_Mold", "Tomato_Septoria_leaf_spot", "Tomato__Target_Spot"]),
    "Bacterial Infections": ("Bacterial Spot on Pepper and Tomato", ["Pepper__bell___Bacterial_spot", "Tomato_Bacterial_spot"]),
    "Viral Invasions": ("Tomato Yellow Leaf Curl Virus, Tomato Mosaic Virus",
                        ["Tomato__Tomato_YellowLeaf__Curl_Virus", "Tomato__Tomato_mosaic_virus"]),
    "Arthropod Damage": ("Two-Spotted Spider Mite", ["Tomato_Spider_mites_Two_spotted_spider_mite"]),
    "Healthy Controls": ("Leaves with no disease", ["Pepper__bell___healthy", "Potato___healthy", "Tomato_healthy"]),
}
CROPS = {"Bell Pepper": "Pepper", "Potato": "Potato", "Tomato": "Tomato"}


def load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def pct(x: float, d: int = 2) -> str:
    return f"{x:.{d}f}%"


def status(value: float | None, rules: list[tuple[float, str]], default: str) -> str:
    """rules: ascending (threshold, label); first threshold the value is below wins."""
    if value is None:
        return "Pending"
    for limit, label in rules:
        if value < limit:
            return label
    return default


def main() -> None:
    names = class_names()
    pred = pd.read_csv(OUT_DIR / "predictions.csv")
    base = load(OUT_DIR / "base_model_results.json")
    pert = load(OUT_DIR / "perturbation_results.json")
    cons = load(OUT_DIR / "xai_consistency.json")
    audit = load(PROJECT_ROOT / "reports" / "trustworthiness_audit.json") or {}
    bench = load(PROJECT_ROOT / "reports" / "model_benchmarks.json") or []
    active = next((m for m in bench if m.get("is_production")), {})

    overall = float(pred.correct.mean() * 100)
    t, p = pred["true"].map(lambda i: names[i]), pred["pred"].map(lambda i: names[i])

    crops = []
    for label, prefix in CROPS.items():
        m = t.str.startswith(prefix)
        acc = float(pred.correct[m].mean() * 100)
        ct, cp = m.astype(int), p.str.startswith(prefix).astype(int)
        crops.append({"crop": label, "samples": int(m.sum()), "acc": pct(acc),
                      "prec": pct(precision_score(ct, cp, zero_division=0) * 100),
                      "rec": pct(recall_score(ct, cp, zero_division=0) * 100),
                      "f1": pct(f1_score(ct, cp, zero_division=0) * 100),
                      "parity": f"{acc / overall:.4f}", "_acc": acc})
    ratios = [c["_acc"] / overall for c in crops]
    dir_ratio = min(ratios) / max(ratios)
    for c in crops:
        c["status"] = "Equitable" if abs(float(c["parity"]) - 1) <= 0.05 else "Uneven"
        del c["_acc"]

    grp_of = {c: g for g, (_, members) in GROUPS.items() for c in members}
    tg, pg = t.map(grp_of), p.map(grp_of)
    pathogens, gaccs = [], []
    for g, (desc, _) in GROUPS.items():
        m = tg == g
        gaccs.append(float(pred.correct[m].mean() * 100))
        pathogens.append({"group": g, "samples": int(m.sum()), "acc": pct(float(pred.correct[m].mean() * 100)),
                          "f1": pct(f1_score((tg == g).astype(int), (pg == g).astype(int), zero_division=0) * 100),
                          "desc": desc})

    clean = pert["scenarios"]["clean"]["accuracy"] if pert else None
    def keep(name: str) -> float | None:
        return pert["scenarios"][name]["accuracy"] / clean * 100 if pert and clean else None
    bright = [v for v in (keep("brightness_x0.5"), keep("brightness_x1.5")) if v is not None]
    noise, blur, bg = keep("gaussian_noise_0.10"), keep("gaussian_blur_r3"), keep("background_removed")
    light = min(bright) if bright else None

    iou = None
    if cons:
        keys = [k for k in cons["top20_iou"] if set(k.split("|")) <= {"gradcam_pp", "ig", "shap"}]
        iou = float(np.mean([cons["top20_iou"][k] for k in keys])) * 100 if keys else None
    def pair(a: str, b: str):
        return cons["top20_iou"].get(f"{a}|{b}") * 100 if cons and f"{a}|{b}" in cons["top20_iou"] else None
    pairs = [("Grad-CAM++ vs Integrated Gradients", pair("gradcam_pp", "ig"), "Activation weighting vs path-based attribution"),
             ("Grad-CAM++ vs SHAP (Occlusion)", pair("gradcam_pp", "shap"), "Activation maps vs hide-and-test patches"),
             ("Integrated Gradients vs SHAP", pair("ig", "shap"), "Path-based attribution vs hide-and-test patches"),
             ("Average of the three", iou, "Overall agreement between the three methods")]
    pair_rows = [{"pair": n, "iou": NA if v is None else pct(v, 1), "desc": d} for n, v, d in pairs]
    fgsm = (audit.get("adversarial_robustness") or {}).get("accuracy_retention_rate")
    ece = base["ece"] * 100 if base else None
    gap = max(gaccs) - min(gaccs)
    latency = active.get("inference_latency_ms")

    def row(i, name, value, fmt, st, desc):
        return {"id": i, "name": name, "score": NA if value is None else fmt(value), "status": st, "desc": desc}

    tele = [
        row("D01", "Gaussian Noise Stability", noise, pct, status(noise, [(70, "Fragile"), (90, "Moderate")], "Resilient"),
            "Accuracy kept when Gaussian noise (σ = 0.10) is added to every test photo"),
        row("D02", "Brightness Change", light, pct, status(light, [(70, "Fragile"), (90, "Moderate")], "Resilient"),
            "Accuracy kept in the worse of two cases: half as bright and 1.5 times as bright"),
        row("D03", "Blur", blur, pct, status(blur, [(70, "Fragile"), (90, "Moderate")], "Resilient"),
            "Accuracy kept when every test photo is blurred (Gaussian radius 3)"),
        row("D04", "FGSM Adversarial Attack", fgsm, lambda v: pct(v, 1), status(fgsm, [(50, "Vulnerable"), (80, "Moderate")], "Robust"),
            "Accuracy kept under a worst-case gradient attack (ε = 0.03) on a small sample"),
        row("D05", "Calibration ECE", ece, pct, status(ece, [(5, "Calibrated"), (10, "Fair")], "Overconfident"),
            f"Expected Calibration Error over all {len(pred):,} test photos"),
        row("D06", "Crop Fairness Ratio", dir_ratio, lambda v: f"{v:.4f}", status(dir_ratio, [(0.9, "Uneven")], "Equitable"),
            "Lowest crop accuracy divided by highest crop accuracy (Pepper, Potato, Tomato)"),
        row("D07", "Disease Group Gap", gap, pct, status(gap, [(2, "Negligible"), (5, "Small")], "Notable"),
            "Largest accuracy difference between disease groups"),
        row("D08", "Background Removed", bg, pct, status(bg, [(70, "Fragile"), (90, "Moderate")], "Leaf-focused"),
            "Accuracy kept when everything except the leaf is painted black"),
        row("D09", "Explanation Agreement", iou, pct, status(iou, [(40, "Divergent"), (60, "Partial")], "Concordant"),
            "Top-20% overlap between Grad-CAM++, Integrated Gradients and SHAP"),
        row("D10", "Inference Latency", latency, lambda v: f"{v:.1f} ms", status(latency, [(50, "Real-time")], "Slow"),
            f"Time for one prediction on the {active.get('device', 'local')} device"),
    ]

    def one(k, v):
        return f"export const {k} = {json.dumps(v, indent=2, ensure_ascii=False)} as const;\n"

    headline = {
        "model": "EfficientNet-B0",
        "accuracy": f"{overall:.2f}%", "accuracyValue": round(overall, 2),
        "testImages": int(len(pred)), "testImagesLabel": f"{len(pred):,}",
        "macroF1": f"{base['macro']['f1']:.4f}" if base else NA,
        "ece": pct(ece) if ece is not None else NA, "eceValue": round(ece / 100, 4) if ece is not None else None,
        "mce": f"{base['mce']:.4f}" if base else NA, "brier": f"{base['brier']:.4f}" if base else NA,
        "fairnessRatio": f"{dir_ratio:.4f}",
        "latency": f"{latency:.1f} ms" if latency else NA,
        "params": f"{active['parameters_million']:.2f}M" if active.get("parameters_million") else NA,
        "gflops": f"{active['gflops']:.2f}" if active.get("gflops") else NA,
        "size": f"{active['model_size_mb']:.2f} MB" if active.get("model_size_mb") else NA,
    }
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text("// AUTO-GENERATED by experiments/export_frontend_metrics.py from measured results. Do not edit by hand.\n"
                      + one("HEADLINE", headline) + one("CROP_FAIRNESS", crops) + one("PATHOGEN_GROUPS", pathogens)
                      + one("TELEMETRY_10D", tele) + one("EXPLANATION_AGREEMENT", pair_rows), encoding="utf-8")
    print(f"wrote {TARGET.relative_to(PROJECT_ROOT)}  accuracy={headline['accuracy']}  n={len(pred)}")


if __name__ == "__main__":
    main()
