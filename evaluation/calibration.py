"""Temperature scaling: one scalar T, fitted on the validation set, so softmax(logits / T) is better calibrated.

  python -m evaluation.calibration     # fits T on the validation split, checks it on the test split, writes models/temperature.json

The API reads T with ``load_temperature()``. T = 1.0 (no change) when the file is missing.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from scipy.optimize import minimize_scalar

from config.config import TrainingConfig
from models.efficientnet import build_efficientnet_b0
from preprocessing.transforms import get_validation_transforms

CONFIG = TrainingConfig()
TEMPERATURE_FILE = CONFIG.MODELS_DIR / "temperature.json"


def load_temperature(path: Path = TEMPERATURE_FILE) -> float:
    try:
        return float(json.loads(path.read_text(encoding="utf-8"))["temperature"])
    except (OSError, KeyError, ValueError):
        return 1.0


def fit_temperature(logits: torch.Tensor, labels: torch.Tensor) -> float:
    """T that minimises the validation negative log-likelihood (does not change which class wins)."""
    res = minimize_scalar(lambda t: F.cross_entropy(logits / t, labels).item(), bounds=(0.05, 10.0), method="bounded")
    return float(res.x)


def _ece(conf: np.ndarray, correct: np.ndarray, bins: int = 15) -> float:
    edges, total = np.linspace(0, 1, bins + 1), 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        total += m.mean() * abs(correct[m].mean() - conf[m].mean()) if m.any() else 0.0
    return float(total)


def _split_logits(model: torch.nn.Module, split: str, device: torch.device) -> tuple[torch.Tensor, torch.Tensor]:
    names = json.loads((CONFIG.MODELS_DIR / CONFIG.CLASS_NAMES_FILE).read_text(encoding="utf-8"))
    manifest = json.loads((CONFIG.DATA_DIR / f"{split}_split.json").read_text(encoding="utf-8"))
    items = [(p, names.index(c)) for c in names for p in manifest[c]]
    tf, out = get_validation_transforms(), []
    for i in range(0, len(items), 64):
        batch = torch.stack([tf(Image.open(p).convert("RGB")) for p, _ in items[i : i + 64]]).to(device)
        with torch.no_grad():
            out.append(model(batch).cpu())
    return torch.cat(out), torch.tensor([y for _, y in items])


def main() -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    names = json.loads((CONFIG.MODELS_DIR / CONFIG.CLASS_NAMES_FILE).read_text(encoding="utf-8"))
    model = build_efficientnet_b0(num_classes=len(names), pretrained=False)
    state = torch.load(CONFIG.MODELS_DIR / CONFIG.BEST_MODEL_NAME, map_location=device, weights_only=False)
    model.load_state_dict(state.get("model_state_dict", state))
    model.to(device).eval()

    t = fit_temperature(*_split_logits(model, "val", device))
    test_logits, test_labels = _split_logits(model, "test", device)

    def report(temp: float) -> dict[str, float]:
        probs = torch.softmax(test_logits / temp, dim=1)
        conf, pred = probs.max(1)
        return {"nll": round(F.cross_entropy(test_logits / temp, test_labels).item(), 4),
                "ece": round(_ece(conf.numpy(), (pred == test_labels).numpy().astype(float)), 4),
                "mean_confidence": round(conf.mean().item(), 4),
                "accuracy": round((pred == test_labels).float().mean().item(), 4)}

    result = {"temperature": round(t, 4), "fitted_on": "validation split",
              "test_before": report(1.0), "test_after": report(t)}
    TEMPERATURE_FILE.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
