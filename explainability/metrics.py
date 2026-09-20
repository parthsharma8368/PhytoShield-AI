"""Explanation Quality Metrics for Explainable AI Plant Disease Detection.

Provides quantitative evaluation metrics to rigorously assess the quality,
reliability, and fidelity of visual attribution maps:
    1. Faithfulness  — Pixel Deletion & Insertion AUC (confidence degradation rate)
    2. Stability     — Lipschitz continuity under input Gaussian jitter
    3. Consistency   — Cross-method Spearman/Pearson rank correlation
    4. Robustness    — Attribution retention under photometric perturbations (SSIM)
    5. Sparsity      — Gini coefficient & normalized Shannon entropy of attribution energy
    6. Localization  — Pointing game energy ratio on foliar tissue vs background
"""

import logging
from typing import Any, Callable

import cv2
import numpy as np
from PIL import Image
from scipy.stats import entropy, spearmanr
from skimage.metrics import structural_similarity as ssim
import torch
import torch.nn as nn

logger = logging.getLogger("explainability.metrics")


def compute_faithfulness(
    model: nn.Module,
    input_tensor: torch.Tensor,
    heatmap: np.ndarray,
    target_class_idx: int,
    deletion_fractions: tuple[float, ...] = (0.05, 0.10, 0.20, 0.30, 0.50),
) -> dict[str, float]:
    """Computes Faithfulness via Pixel Deletion and Insertion curves.

    Faithfulness measures whether pixels identified as important by the attribution
    map truly govern the model's prediction score.
    - Pixel Deletion: Successively masks out top-k salient pixels with neutral grey (0.0)
      and records the drop in target class probability. A rapid drop indicates high faithfulness.
    - Pixel Insertion: Successively introduces top-k salient pixels onto a neutral baseline.

    Args:
        model: Trained PyTorch classification model.
        input_tensor: Normalized image tensor of shape (1, 3, H, W).
        heatmap: 2D attribution heatmap of shape (H, W) normalized to [0, 1].
        target_class_idx: Target disease class index.
        deletion_fractions: Fractions of top pixels to mask out.

    Returns:
        dict[str, float]: Deletion AUC, Insertion AUC, and overall Faithfulness score in [0, 1].
    """
    model.eval()
    device = input_tensor.device
    _, _, h, w = input_tensor.shape
    total_pixels = h * w

    with torch.no_grad():
        initial_prob = float(
            torch.softmax(model(input_tensor), dim=1)[0, target_class_idx].item()
        )

    # Flatten attribution to find descending order of importance
    flat_indices = np.argsort(heatmap.ravel())[::-1]

    deletion_probs: list[float] = [initial_prob]
    insertion_probs: list[float] = [0.0]

    # Neutral baseline: zeros (approx ImageNet grey after unnormalization)
    baseline_tensor = torch.zeros_like(input_tensor).to(device)

    for frac in deletion_fractions:
        k = int(frac * total_pixels)
        top_k_indices = flat_indices[:k]

        # 1. Deletion: mask top-k in input
        del_tensor = input_tensor.clone()
        mask_2d = np.ones((h, w), dtype=np.float32)
        mask_2d.ravel()[top_k_indices] = 0.0
        mask_tensor = torch.from_numpy(mask_2d).to(device).unsqueeze(0).unsqueeze(0)
        del_tensor = del_tensor * mask_tensor

        with torch.no_grad():
            prob_del = float(
                torch.softmax(model(del_tensor), dim=1)[0, target_class_idx].item()
            )
        deletion_probs.append(prob_del)

        # 2. Insertion: insert top-k onto baseline
        ins_tensor = baseline_tensor.clone()
        ins_mask_2d = np.zeros((h, w), dtype=np.float32)
        ins_mask_2d.ravel()[top_k_indices] = 1.0
        ins_mask_tensor = torch.from_numpy(ins_mask_2d).to(device).unsqueeze(0).unsqueeze(0)
        ins_tensor = input_tensor * ins_mask_tensor

        with torch.no_grad():
            prob_ins = float(
                torch.softmax(model(ins_tensor), dim=1)[0, target_class_idx].item()
            )
        insertion_probs.append(prob_ins)

    # Calculate AUCs normalized between 0 and 1
    # For deletion: rapid drop means lower area under deletion curve -> invert for faithfulness
    auc_del = float(np.mean(deletion_probs))
    auc_ins = float(np.mean(insertion_probs))

    # Normalized Faithfulness score: high insertion + high deletion drop (1 - auc_del)
    faithfulness_score = max(0.0, min(1.0, (1.0 - auc_del + auc_ins) / 2.0))

    return {
        "deletion_auc": round(auc_del, 4),
        "insertion_auc": round(auc_ins, 4),
        "faithfulness_score": round(faithfulness_score, 4),
    }


def compute_stability(
    explain_fn: Callable[[torch.Tensor, int], np.ndarray],
    input_tensor: torch.Tensor,
    target_class_idx: int,
    noise_std: float = 0.02,
    num_samples: int = 3,
) -> float:
    """Computes Stability (Lipschitz continuity) under small Gaussian input perturbations.

    A reliable explanation must not oscillate violently when imperceptible noise
    is added to the input image.

    Args:
        explain_fn: Callable that accepts (tensor, class_idx) and returns 2D heatmap.
        input_tensor: Original image tensor (1, 3, H, W).
        target_class_idx: Predicted class index.
        noise_std: Standard deviation of additive Gaussian noise.
        num_samples: Number of perturbed samples to test.

    Returns:
        float: Stability index in [0, 1] where 1.0 indicates perfect stability.
    """
    base_heatmap = explain_fn(input_tensor, target_class_idx)
    base_norm = np.linalg.norm(base_heatmap)
    if base_norm < 1e-8:
        return 1.0

    distances: list[float] = []
    for _ in range(num_samples):
        noise = torch.randn_like(input_tensor) * noise_std
        perturbed_tensor = input_tensor + noise
        pert_heatmap = explain_fn(perturbed_tensor, target_class_idx)

        diff_norm = np.linalg.norm(base_heatmap - pert_heatmap)
        rel_diff = diff_norm / (base_norm + 1e-8)
        distances.append(float(rel_diff))

    mean_dist = float(np.mean(distances))
    # Map distance to [0, 1] using exponential decay
    stability_score = float(np.exp(-mean_dist))
    return round(float(np.clip(stability_score, 0.0, 1.0)), 4)


def compute_consistency(heatmaps: dict[str, np.ndarray]) -> dict[str, float]:
    """Computes cross-method attribution rank consistency (Spearman's rank correlation).

    Measures the degree of spatial consensus between different XAI methods.

    Args:
        heatmaps: Dictionary mapping method name to 2D numpy heatmap.

    Returns:
        dict[str, float]: Pairwise Spearman correlation coefficients and mean consensus score.
    """
    valid_methods = [k for k, v in heatmaps.items() if v is not None]
    if len(valid_methods) < 2:
        return {"mean_consistency": 1.0}

    correlations: dict[str, float] = {}
    rho_values: list[float] = []

    for i in range(len(valid_methods)):
        for j in range(i + 1, len(valid_methods)):
            m1, m2 = valid_methods[i], valid_methods[j]
            h1 = heatmaps[m1].ravel()
            h2 = heatmaps[m2].ravel()

            rho, _ = spearmanr(h1, h2)
            if np.isnan(rho):
                rho = 0.0
            correlations[f"{m1}_vs_{m2}"] = round(float(rho), 4)
            rho_values.append(float(rho))

    # Rescale mean rho from [-1, 1] to [0, 1]
    mean_rho = float(np.mean(rho_values))
    mean_consistency = max(0.0, min(1.0, (mean_rho + 1.0) / 2.0))
    correlations["mean_consistency"] = round(mean_consistency, 4)

    return correlations


def compute_robustness(
    explain_fn: Callable[[torch.Tensor, int], np.ndarray],
    original_image: Image.Image,
    preprocess_fn: Callable[[Image.Image], torch.Tensor],
    target_class_idx: int,
    device: torch.device | None = None,
) -> float:
    """Computes Robustness under photometric transformations using SSIM.

    Measures how well the attribution map preserves its structural geometry
    under moderate brightness adjustments (±15%).

    Args:
        explain_fn: Callable returning 2D attribution heatmap.
        original_image: Original PIL Image.
        preprocess_fn: Transforms PIL Image to preprocessed tensor.
        target_class_idx: Target class index.
        device: Computing device.

    Returns:
        float: Robustness score (mean SSIM) in range [0, 1].
    """
    base_tensor = preprocess_fn(original_image)
    if device is not None:
        base_tensor = base_tensor.to(device)
    base_heatmap = explain_fn(base_tensor, target_class_idx)

    # Generate brightness perturbed image (+15%)
    orig_np = np.array(original_image.convert("RGB"), dtype=np.float32)
    bright_np = np.clip(orig_np * 1.15, 0, 255).astype(np.uint8)
    bright_img = Image.fromarray(bright_np)

    bright_tensor = preprocess_fn(bright_img)
    if device is not None:
        bright_tensor = bright_tensor.to(device)
    bright_heatmap = explain_fn(bright_tensor, target_class_idx)

    # Compute Structural Similarity Index (SSIM)
    similarity = float(ssim(base_heatmap, bright_heatmap, data_range=1.0))
    if np.isnan(similarity):
        similarity = 0.5

    return round(float(np.clip(similarity, 0.0, 1.0)), 4)


def compute_sparsity(heatmap: np.ndarray) -> dict[str, float]:
    """Computes Sparsity via Gini Coefficient and normalized Shannon entropy.

    High sparsity indicates that attribution energy is concentrated on compact,
    pathological lesion hotspots rather than scattered across the entire leaf.

    Args:
        heatmap: 2D attribution heatmap normalized to [0, 1].

    Returns:
        dict[str, float]: Gini coefficient and normalized entropy sparsity score.
    """
    flat = heatmap.ravel().astype(np.float64)
    total = np.sum(flat)
    if total < 1e-8:
        return {"gini_index": 0.0, "entropy_sparsity": 0.0, "sparsity_score": 0.0}

    # Gini Coefficient calculation
    sorted_vals = np.sort(flat)
    n = len(flat)
    index = np.arange(1, n + 1)
    gini = float((np.sum((2 * index - n - 1) * sorted_vals)) / (n * total))

    # Normalized Shannon Entropy
    p = flat / total
    p = p[p > 0]
    h_entropy = float(entropy(p, base=2))
    max_entropy = np.log2(n)
    entropy_sparsity = float(1.0 - (h_entropy / max_entropy))

    sparsity_score = float((gini + entropy_sparsity) / 2.0)

    return {
        "gini_index": round(max(0.0, min(1.0, gini)), 4),
        "entropy_sparsity": round(max(0.0, min(1.0, entropy_sparsity)), 4),
        "sparsity_score": round(max(0.0, min(1.0, sparsity_score)), 4),
    }


def compute_localization(original_image: Image.Image, heatmap: np.ndarray) -> float:
    """Computes Localization using Pointing Game and Foliar Energy Ratio.

    Evaluates the fraction of attribution energy located inside the segmented
    leaf blade foreground versus non-leaf background artifacts.

    Args:
        original_image: Original leaf PIL Image.
        heatmap: 2D attribution heatmap normalized to [0, 1].

    Returns:
        float: Foreground foliar energy ratio in [0, 1].
    """
    img_np = np.array(original_image.convert("RGB"))
    h, w, _ = img_np.shape

    # Resize heatmap to match image dimensions
    heatmap_resized = cv2.resize(heatmap, (w, h))

    # Segment leaf blade foreground using ExG (Excess Green Index = 2G - R - B)
    r = img_np[:, :, 0].astype(np.float32)
    g = img_np[:, :, 1].astype(np.float32)
    b = img_np[:, :, 2].astype(np.float32)
    exg = 2.0 * g - r - b

    # Otsu threshold on ExG to extract leaf mask
    exg_norm = cv2.normalize(exg, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    _, leaf_mask = cv2.threshold(exg_norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    leaf_mask_bool = leaf_mask > 0

    total_energy = float(np.sum(heatmap_resized))
    if total_energy < 1e-8:
        return 1.0

    foliar_energy = float(np.sum(heatmap_resized[leaf_mask_bool]))
    localization_ratio = foliar_energy / total_energy

    return round(float(np.clip(localization_ratio, 0.0, 1.0)), 4)


def evaluate_all_explanation_metrics(
    model: nn.Module,
    input_tensor: torch.Tensor,
    original_image: Image.Image,
    heatmap: np.ndarray,
    target_class_idx: int,
    explain_fn: Callable[[torch.Tensor, int], np.ndarray],
    preprocess_fn: Callable[[Image.Image], torch.Tensor],
    additional_heatmaps: dict[str, np.ndarray] | None = None,
) -> dict[str, Any]:
    """Runs all 6 quantitative explanation quality evaluations in a unified call.

    Args:
        model: PyTorch model.
        input_tensor: Normalized preprocessed tensor.
        original_image: Raw PIL Image.
        heatmap: Primary attribution heatmap (e.g. Grad-CAM++).
        target_class_idx: Class index.
        explain_fn: Function to generate heatmap for perturbation tests.
        preprocess_fn: Image preprocessing function.
        additional_heatmaps: Other method heatmaps for cross-method consistency.

    Returns:
        dict[str, Any]: Comprehensive dictionary of all 6 XAI quality metrics.
    """
    logger.info("Computing 6-dimensional explanation quality metrics...")

    # 1. Faithfulness
    faith_res = compute_faithfulness(
        model=model,
        input_tensor=input_tensor,
        heatmap=heatmap,
        target_class_idx=target_class_idx,
    )

    # 2. Stability
    stability_score = compute_stability(
        explain_fn=explain_fn,
        input_tensor=input_tensor,
        target_class_idx=target_class_idx,
    )

    # 3. Consistency
    heatmaps_for_consistency = {"primary": heatmap}
    if additional_heatmaps:
        heatmaps_for_consistency.update(additional_heatmaps)
    consistency_res = compute_consistency(heatmaps_for_consistency)

    # 4. Robustness
    robustness_score = compute_robustness(
        explain_fn=explain_fn,
        original_image=original_image,
        preprocess_fn=preprocess_fn,
        target_class_idx=target_class_idx,
        device=input_tensor.device,
    )

    # 5. Sparsity
    sparsity_res = compute_sparsity(heatmap)

    # 6. Localization
    localization_score = compute_localization(
        original_image=original_image,
        heatmap=heatmap,
    )

    # Overall Composite XAI Quality Index (weighted harmonic/arithmetic average)
    composite_quality = round(
        float(
            0.25 * faith_res["faithfulness_score"]
            + 0.20 * stability_score
            + 0.15 * consistency_res["mean_consistency"]
            + 0.15 * robustness_score
            + 0.10 * sparsity_res["sparsity_score"]
            + 0.15 * localization_score
        ),
        4,
    )

    return {
        "faithfulness": faith_res,
        "stability_score": stability_score,
        "consistency": consistency_res,
        "robustness_score": robustness_score,
        "sparsity": sparsity_res,
        "localization_score": localization_score,
        "composite_xai_quality": composite_quality,
    }
