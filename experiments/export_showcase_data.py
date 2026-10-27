"""Export the real numbers and images behind the 3D scroll showcase.

  python -m experiments.export_showcase_data

Writes frontend/public/showcase/** (textures from real test photos and real explanation maps) and
frontend/src/generated/showcase.ts (training history, counts, metrics, probabilities). Nothing is invented:
every value comes from the trained model, the saved reports, or the dataset splits.
"""

from __future__ import annotations

import json

import cv2
import numpy as np
import pandas as pd
import torch
import torchvision.transforms as T
from PIL import Image
from scipy.stats import entropy

from evaluation.calibration import load_temperature
from evaluation.decision_support import segment_leaf_and_lesions
from experiments.common import (OUT_DIR, PROJECT_ROOT, Explainers, class_names, load_model, load_rgb, predict, to_tensor)

PUB = PROJECT_ROOT / "frontend" / "public" / "showcase"
GEN = PROJECT_ROOT / "frontend" / "src" / "generated" / "showcase.ts"
SAMPLES = {"tomato": "Tomato_Early_blight", "potato": "Potato___Late_blight", "pepper": "Pepper__bell___Bacterial_spot", "hard": None}  # "hard": a real test photo the model is unsure about


def gray_png(h: np.ndarray, path, robust: bool = False) -> None:
    """Heatmap as an 8-bit image. Sparse pixel-level maps (saliency, SmoothGrad, IG) are scaled by their 99.5th
    percentile for display only, so a handful of extreme pixels does not make the whole map look empty."""
    h = np.asarray(h, dtype=np.float32)
    if robust:
        h = h / max(float(np.percentile(h, 99.5)), 1e-6)
    Image.fromarray(np.uint8(255 * np.clip(h, 0, 1))).resize((224, 224)).save(path)


def main() -> None:
    names, model, T_cal = class_names(), load_model(), load_temperature()
    engines = Explainers(model)
    pred = pd.read_csv(OUT_DIR / "predictions.csv")
    dev = next(model.parameters()).device
    PUB.mkdir(parents=True, exist_ok=True)
    GEN.parent.mkdir(parents=True, exist_ok=True)
    samples = {}

    for key, cls in SAMPLES.items():
        d = PUB / key
        d.mkdir(exist_ok=True)
        if cls is None:
            pool = pred[(pred.conf > 0.45) & (pred.conf < 0.7)]
            path = pool.sort_values("mc_std", ascending=False).iloc[0].path
        else:
            pool = pred[(pred.true == names.index(cls)) & (pred.correct == 1) & (pred.conf > 0.98)]
            path = pool.sort_values("conf", ascending=False).iloc[min(3, len(pool) - 1)].path
        img = load_rgb(path)
        photo = img.resize((256, 256))
        photo.save(d / "photo.jpg", quality=92)
        base = T.CenterCrop(224)(img.resize((224, 224)))
        base.save(d / "crop224.jpg", quality=92)
        arr = (np.asarray(base) / 255.0 - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
        Image.fromarray((np.clip((arr + 2.5) / 5.0, 0, 1) * 255).astype(np.uint8)).save(d / "norm.png")
        T.RandomHorizontalFlip(p=1.0)(base).save(d / "aug_flip.jpg", quality=92)
        T.RandomRotation((20, 20))(base).save(d / "aug_rot.jpg", quality=92)
        T.Resize(224)(T.CenterCrop(200)(base)).save(d / "aug_zoom.jpg", quality=92)
        T.ColorJitter(brightness=(1.2, 1.2), contrast=(1.2, 1.2))(base).save(d / "aug_jitter.jpg", quality=92)

        x = to_tensor(img)
        with torch.no_grad():
            logits = model(x)[0].cpu().numpy()
        cls_idx = int(logits.argmax())
        p1, pc = torch.softmax(torch.tensor(logits), 0).numpy(), torch.softmax(torch.tensor(logits) / T_cal, 0).numpy()

        maps, _ = engines.run(["gradcam", "gradcam_pp", "saliency", "smoothgrad", "ig", "shap", "lime"], x, cls_idx, img)
        for m, h in maps.items():
            gray_png(h, d / f"heat_{m}.png", robust=m in ("saliency", "smoothgrad", "ig"))

        # six of the noisy saliency maps that SmoothGrad averages
        torch.manual_seed(0)
        for k in range(6):
            noisy = x + 0.1 * torch.randn_like(x)
            gray_png(engines.heatmap("saliency", noisy, cls_idx, img), d / f"smooth_{k}.png", robust=True)

        # SHAP: one patch hidden at a time (same procedure as explainability/shap_explainer.py)
        grid, ph = 8, 224 // 8
        batch = x.repeat(grid * grid + 1, 1, 1, 1).clone()
        for i in range(grid):
            for j in range(grid):
                batch[1 + i * grid + j, :, i * ph:(i + 1) * ph, j * ph:(j + 1) * ph] = 0.0
        with torch.no_grad():
            pr = torch.softmax(model(batch), 1)[:, cls_idx].cpu().numpy()
        shap_drops = (pr[0] - pr[1:]).tolist()

        # LIME: the same SLIC superpixels the engine uses (id stored in the red channel)
        from lime.wrappers.scikit_image import SegmentationAlgorithm
        seg = SegmentationAlgorithm("slic", n_segments=60, compactness=10, sigma=1)(np.asarray(img.resize((224, 224), Image.Resampling.BILINEAR)))
        Image.fromarray(np.stack([seg.astype(np.uint8)] * 3, -1)).save(d / "lime_segments.png")

        # MC-Dropout: head-only passes with dropout on, same temperature as the app
        base_m = model.base_model
        with torch.no_grad():
            feats = torch.flatten(base_m.avgpool(base_m.features(x)), 1)
            for mod in base_m.classifier.modules():
                if isinstance(mod, torch.nn.Dropout):
                    mod.train()
            mc = np.stack([torch.softmax(base_m.classifier(feats.clone()) / T_cal, 1)[0].cpu().numpy() for _ in range(20)])
            model.eval()

        # leaf damage layers
        s = segment_leaf_and_lesions(img)
        leaf, les, rgb = s
        masked = rgb.copy(); masked[~leaf] = (masked[~leaf] * 0.12).astype(np.uint8)
        dmg = masked.copy(); dmg[les] = (0.3 * dmg[les] + 0.7 * np.array([255, 50, 40])).astype(np.uint8)
        Image.fromarray(masked).save(d / "sev_leaf.jpg", quality=92)
        Image.fromarray(dmg).save(d / "sev_damage.jpg", quality=92)

        samples[key] = {
            "classIndex": cls_idx, "className": names[cls_idx], "confidence": float(pc[cls_idx]),
            "logits": [round(float(v), 4) for v in logits], "probsRaw": [round(float(v), 5) for v in p1], "probsCalibrated": [round(float(v), 5) for v in pc],
            "mcTop": [round(float(v), 5) for v in mc[:, cls_idx]], "mcEntropyBits": round(float(entropy(mc.mean(0), base=2)), 4),
            "shapDrops": [round(float(v), 5) for v in shap_drops], "limeSegments": int(seg.max()) + 1,
            "damagePct": round(100.0 * float(les.sum() / leaf.sum()), 1), "trueClass": names[int(pred[pred.path == path].true.iloc[0])],
        }

    # dataset thumbnails atlas (10 x 10 real photos, spread across all classes)
    manifest = json.loads((PROJECT_ROOT / "data" / "train_split.json").read_text(encoding="utf-8"))
    rng = np.random.default_rng(1)
    paths = [p for c in names for p in rng.permutation(manifest[c])[:7].tolist()][:100]
    atlas = Image.new("RGB", (960, 960))
    for i, p in enumerate(paths):
        atlas.paste(load_rgb(p).resize((96, 96)), ((i % 10) * 96, (i // 10) * 96))
    atlas.save(PUB / "atlas.jpg", quality=88)

    # network blocks with exact parameter counts
    sizes = [(32, 112), (16, 112), (24, 56), (40, 28), (80, 14), (112, 14), (192, 7), (320, 7), (1280, 7)]
    blocks = [{"index": i, "channels": c, "size": sz, "params": int(sum(p.numel() for p in f.parameters()))} for i, ((c, sz), f) in enumerate(zip(sizes, model.base_model.features))]
    head_params = int(sum(p.numel() for p in model.base_model.classifier.parameters()))

    hist = json.loads((PROJECT_ROOT / "models" / "training_history.json").read_text(encoding="utf-8"))
    base = json.loads((OUT_DIR / "base_model_results.json").read_text(encoding="utf-8"))
    audit = json.loads((OUT_DIR / "dataset_audit.json").read_text(encoding="utf-8"))
    pert = json.loads((OUT_DIR / "perturbation_results.json").read_text(encoding="utf-8"))
    cal = json.loads((PROJECT_ROOT / "models" / "temperature.json").read_text(encoding="utf-8"))
    xai = pd.read_csv(OUT_DIR / "xai_metrics.csv")
    deletion = {m: round(float(g.del_auc.mean()), 3) for m, g in xai.groupby("method")}
    sev = json.loads((OUT_DIR / "severity_validation.json").read_text(encoding="utf-8"))
    old, new = audit["legacy_split_sizes"], audit["clean_split_sizes"]

    data = {
        "classes": names, "samples": samples, "blocks": blocks, "headParams": head_params,
        "history": {k: [round(float(v), 4) for v in hist[k]] for k in ("train_acc", "val_acc", "train_loss", "val_loss")},
        "counts": {"files": sum(old.values()), "unique": sum(new.values()), "duplicates": sum(old.values()) - sum(new.values()), **{k: v for k, v in new.items()}},
        "metrics": {"accuracy": round(base["accuracy"], 2), "macroF1": round(base["macro"]["f1"], 4), "ece": round(base["ece"], 4), "errors": base["n_failures"], "nTest": base["n_test"],
                    "temperature": cal["temperature"], "eceBefore": cal["test_before"]["ece"], "eceAfter": cal["test_after"]["ece"]},
        "deletionAuc": deletion,
        "perturbation": {k: round(v["accuracy"], 1) for k, v in pert["scenarios"].items()},
        "severity": {"healthyMedian": sev["specificity_real_healthy_leaves"]["median_pct"], "mae": sev["accuracy_synthetic_lesions"]["mean_absolute_error_pct_points"], "r": sev["accuracy_synthetic_lesions"]["pearson_r"]},
        "perClassF1": {k: round(v["f1"], 4) for k, v in base["per_class"].items()},
    }
    GEN.write_text("// AUTO-GENERATED by experiments/export_showcase_data.py from measured results. Do not edit by hand.\n"
                   f"export const SHOWCASE = {json.dumps(data, indent=1)} as const;\n", encoding="utf-8")
    print("showcase data written:", GEN.relative_to(PROJECT_ROOT), "|", {k: v["className"] for k, v in samples.items()})


if __name__ == "__main__":
    main()
