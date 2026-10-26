"""Shared helpers for the final-review experiments (base model, XAI study, failure analysis)."""

from __future__ import annotations

import io
import json
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image, ImageEnhance, ImageFilter
from scipy.stats import spearmanr

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from config.config import TrainingConfig  # noqa: E402
from explainability.grad_cam import GradCAM  # noqa: E402
from explainability.grad_cam_plus_plus import GradCAMPlusPlus  # noqa: E402
from explainability.integrated_gradients import IntegratedGradients  # noqa: E402
from explainability.metrics import deletion_insertion_curves  # noqa: E402
from explainability.lime_explainer import LIMEExplainer  # noqa: E402
from explainability.saliency import SaliencyExplainer, SmoothGradExplainer  # noqa: E402
from explainability.shap_explainer import SHAPExplainer  # noqa: E402
from models.efficientnet import build_efficientnet_b0  # noqa: E402
from preprocessing.transforms import preprocess_image_for_inference  # noqa: E402

CONFIG = TrainingConfig()
OUT_DIR = Path(os.environ.get("STUDY_OUT", PROJECT_ROOT / "reports" / "study"))
FIG_DIR = OUT_DIR / "figures"
for _d in (OUT_DIR, FIG_DIR):
    _d.mkdir(parents=True, exist_ok=True)

METHODS = ["gradcam", "gradcam_pp", "saliency", "smoothgrad", "ig", "shap", "lime"]
METHOD_LABELS = {
    "gradcam": "Grad-CAM", "gradcam_pp": "Grad-CAM++", "saliency": "Saliency",
    "smoothgrad": "SmoothGrad", "ig": "Integrated Gradients", "shap": "SHAP (occlusion)",
    "lime": "LIME", "random": "Random (baseline)",
}


def device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def class_names() -> list[str]:
    return json.loads((CONFIG.MODELS_DIR / CONFIG.CLASS_NAMES_FILE).read_text(encoding="utf-8"))


def load_model(ckpt: Path | None = None) -> torch.nn.Module:
    ckpt = Path(os.environ.get("MODEL_PATH", ckpt or CONFIG.MODELS_DIR / CONFIG.BEST_MODEL_NAME))
    model = build_efficientnet_b0(num_classes=len(class_names()), pretrained=False)
    state = torch.load(ckpt, map_location=device(), weights_only=False)
    model.load_state_dict(state.get("model_state_dict", state))
    return model.to(device()).eval()


def test_samples() -> list[tuple[str, int]]:
    names = class_names()
    manifest = json.loads((CONFIG.DATA_DIR / "test_split.json").read_text(encoding="utf-8"))
    return [(p, names.index(c)) for c in names for p in manifest[c]]


def stratified(samples: list[tuple[str, int]], per_class: int, seed: int = 0) -> list[tuple[str, int]]:
    rng = np.random.default_rng(seed)
    out: list[tuple[str, int]] = []
    for label in sorted({s[1] for s in samples}):
        pool = [s for s in samples if s[1] == label]
        idx = rng.permutation(len(pool))[:per_class]
        out.extend(pool[i] for i in idx)
    return out


def load_rgb(path: str) -> Image.Image:
    with Image.open(path) as im:
        return im.convert("RGB")


class Explainers:
    """One instance of every attribution engine, built once per model (hooks are registered once)."""

    def __init__(self, model: torch.nn.Module) -> None:
        layer = model.get_target_layer_for_gradcam()
        self.model = model
        self.engines = {
            "gradcam": GradCAM(model=model, target_layer=layer),
            "gradcam_pp": GradCAMPlusPlus(model=model, target_layer=layer),
            "saliency": SaliencyExplainer(model=model),
            "smoothgrad": SmoothGradExplainer(model=model, num_samples=15, noise_level=0.1),
            "ig": IntegratedGradients(model=model),
            "shap": SHAPExplainer(model=model, grid_size=8),
            "lime": LIMEExplainer(model=model, num_samples=40, num_features=8),
        }

    def heatmap(self, name: str, tensor: torch.Tensor, cls: int, image: Image.Image) -> np.ndarray:
        x = tensor.clone()
        eng = self.engines[name]
        if name == "ig":
            h = eng.generate_heatmap(input_tensor=x, target_class_idx=cls, steps=20)
        elif name == "lime":
            h = eng.generate_heatmap(input_tensor=x, target_class_idx=cls, original_image=image)
        else:
            h = eng.generate_heatmap(input_tensor=x, target_class_idx=cls)
        h = np.asarray(h, dtype=np.float32)
        if h.shape != (224, 224):
            h = cv2.resize(h, (224, 224))
        return h

    def run(self, names: list[str], tensor: torch.Tensor, cls: int, image: Image.Image):
        maps, secs = {}, {}
        for n in names:
            t0 = time.perf_counter()
            try:
                maps[n] = self.heatmap(n, tensor, cls, image)
            except Exception:  # noqa: BLE001 - a single failing engine must not abort a study run
                maps[n] = None
            secs[n] = time.perf_counter() - t0
        return maps, secs


@torch.no_grad()
def predict(model: torch.nn.Module, tensor: torch.Tensor) -> np.ndarray:
    return torch.softmax(model(tensor), dim=1)[0].cpu().numpy()


def deletion_insertion(model, tensor: torch.Tensor, heat: np.ndarray, cls: int, n_steps: int = 21):
    return deletion_insertion_curves(model, tensor, heat, cls, n_steps)


def auc(fracs: np.ndarray, vals: np.ndarray) -> float:
    return float(np.trapezoid(vals, fracs))


def topk_iou(a: np.ndarray, b: np.ndarray, frac: float = 0.2) -> float:
    ta = a >= np.quantile(a, 1 - frac)
    tb = b >= np.quantile(b, 1 - frac)
    union = np.logical_or(ta, tb).sum()
    return float(np.logical_and(ta, tb).sum() / union) if union else 0.0


def rank_corr(a: np.ndarray, b: np.ndarray) -> float:
    if np.std(a) < 1e-8 or np.std(b) < 1e-8:
        return 0.0
    rho = spearmanr(a.ravel(), b.ravel()).statistic
    return 0.0 if np.isnan(rho) else float(rho)


def leaf_mask(image: Image.Image) -> np.ndarray:
    arr = np.array(image).astype(np.float32)
    exg = 2 * arr[:, :, 1] - arr[:, :, 0] - arr[:, :, 2]
    norm = cv2.normalize(exg, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    _, mask = cv2.threshold(norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return mask > 0


# ---- input perturbation scenarios (image -> image) ----
def _noise(im: Image.Image, sigma: float = 0.10) -> Image.Image:
    a = np.asarray(im).astype(np.float32) / 255.0
    a = np.clip(a + np.random.default_rng(0).normal(0, sigma, a.shape), 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8))


def _jpeg(im: Image.Image, q: int = 15) -> Image.Image:
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=q)
    return Image.open(io.BytesIO(buf.getvalue())).convert("RGB")


def _occlude(im: Image.Image, frac: float = 0.25) -> Image.Image:
    a = np.array(im)
    h, w = a.shape[:2]
    s = int((frac ** 0.5) * min(h, w))
    y, x = (h - s) // 2, (w - s) // 2  # centre patch: the worst case, it covers the lesion most often
    a[y : y + s, x : x + s] = 0
    return Image.fromarray(a)


def _background_removed(im: Image.Image) -> Image.Image:
    a = np.array(im)
    a[~leaf_mask(im)] = 0
    return Image.fromarray(a)


PERTURBATIONS = {
    "clean": lambda im: im,
    "gaussian_noise_0.10": lambda im: _noise(im, 0.10),
    "gaussian_blur_r3": lambda im: im.filter(ImageFilter.GaussianBlur(radius=3)),
    "brightness_x0.5": lambda im: ImageEnhance.Brightness(im).enhance(0.5),
    "brightness_x1.5": lambda im: ImageEnhance.Brightness(im).enhance(1.5),
    "jpeg_q15": _jpeg,
    "occlusion_25pct": _occlude,
    "background_removed": _background_removed,
}


def to_tensor(image: Image.Image) -> torch.Tensor:
    return preprocess_image_for_inference(image).to(device())


def overlay(image: Image.Image, heat: np.ndarray, alpha: float = 0.45) -> np.ndarray:
    """Jet-coloured attribution overlay on the 224x224 view of the image (uint8 RGB)."""
    base = np.array(image.resize((224, 224)))
    col = cv2.cvtColor(cv2.applyColorMap(np.uint8(255 * np.clip(heat, 0, 1)), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    return np.clip(alpha * col + (1 - alpha) * base, 0, 255).astype(np.uint8)
