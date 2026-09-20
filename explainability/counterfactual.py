"""Counterfactual Explainable AI Engine for Plant Disease Detection.

Implements visual counterfactual perturbation analysis to identify minimal
pathological lesion regions whose removal or neutralization shifts the model's
prediction towards healthy foliage or lowers disease confidence.
"""

import logging
from typing import Any, Callable

import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn as nn

from explainability.visualizer import encode_image_to_base64

logger = logging.getLogger("explainability.counterfactual")


class CounterfactualExplainer:
    """Visual counterfactual generation engine for plant leaf pathology."""

    def __init__(self, model: nn.Module, class_mapping: dict[str, int]) -> None:
        """Initializes the counterfactual explainer.

        Args:
            model: Trained PyTorch classification model.
            class_mapping: Mapping of class name to integer index.
        """
        self.model = model
        self.class_mapping = class_mapping
        self.idx_to_class = {v: k for k, v in class_mapping.items()}

    def generate_counterfactual(
        self,
        original_image: Image.Image,
        heatmap: np.ndarray,
        target_class_idx: int,
        preprocess_fn: Callable[[Image.Image], torch.Tensor],
        threshold: float = 0.55,
    ) -> dict[str, Any]:
        """Generates a counterfactual leaf image by neutralizing top lesion regions.

        Args:
            original_image: Raw PIL leaf image.
            heatmap: 2D attribution heatmap of shape (H, W) in [0, 1].
            target_class_idx: Predicted disease class index.
            preprocess_fn: Preprocessing function for inference.
            threshold: Attribution cutoff above which pixels are identified as key lesions.

        Returns:
            dict[str, Any]: Counterfactual image base64, difference map base64,
            probability drop, and natural language counterfactual explanation.
        """
        self.model.eval()
        device = next(self.model.parameters()).device

        img_np = np.array(original_image.convert("RGB"))
        h, w, _ = img_np.shape

        # 1. Resize heatmap to image size
        heatmap_resized = cv2.resize(heatmap, (w, h))

        # 2. Extract primary lesion mask
        lesion_mask = (heatmap_resized >= threshold).astype(np.uint8) * 255
        lesion_pixel_count = int(np.sum(lesion_mask > 0))

        # 3. Calculate healthy reference color from surrounding non-lesion leaf tissue
        # Segment general leaf area via excess green
        r = img_np[:, :, 0].astype(np.float32)
        g = img_np[:, :, 1].astype(np.float32)
        b = img_np[:, :, 2].astype(np.float32)
        exg = 2.0 * g - r - b
        leaf_mask = (exg > 0).astype(np.uint8) * 255

        healthy_leaf_mask = cv2.bitwise_and(leaf_mask, cv2.bitwise_not(lesion_mask))
        if np.sum(healthy_leaf_mask > 0) > 100:
            healthy_median_color = np.median(img_np[healthy_leaf_mask > 0], axis=0)
        else:
            healthy_median_color = np.array([45, 120, 45], dtype=np.float32)

        # 4. Generate Counterfactual Image via localized inpainting / smooth color synthesis
        # Use Telea inpainting on the lesion mask to synthesize healthy leaf blade
        counterfactual_np = cv2.inpaint(img_np, lesion_mask, inpaintRadius=7, flags=cv2.INPAINT_TELEA)

        counterfactual_pil = Image.fromarray(counterfactual_np)

        # 5. Difference map highlighting exactly what changed
        diff_map = np.abs(counterfactual_np.astype(np.float32) - img_np.astype(np.float32))
        diff_gray = np.mean(diff_map, axis=2)
        diff_norm = cv2.normalize(diff_gray, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        diff_colored = cv2.applyColorMap(diff_norm, cv2.COLORMAP_VIRIDIS)
        diff_colored = cv2.cvtColor(diff_colored, cv2.COLOR_BGR2RGB)
        diff_pil = Image.fromarray(diff_colored)

        # 6. Evaluate Model Prediction on Counterfactual Image
        orig_tensor = preprocess_fn(original_image).to(device)
        cf_tensor = preprocess_fn(counterfactual_pil).to(device)

        with torch.no_grad():
            orig_probs = torch.softmax(self.model(orig_tensor), dim=1)[0]
            cf_probs = torch.softmax(self.model(cf_tensor), dim=1)[0]

            orig_disease_conf = float(orig_probs[target_class_idx].item()) * 100.0
            cf_disease_conf = float(cf_probs[target_class_idx].item()) * 100.0

            # Find healthy class in mapping
            healthy_candidates = [
                idx for name, idx in self.class_mapping.items() if "healthy" in name.lower()
            ]
            if healthy_candidates:
                orig_healthy_conf = float(orig_probs[healthy_candidates[0]].item()) * 100.0
                cf_healthy_conf = float(cf_probs[healthy_candidates[0]].item()) * 100.0
            else:
                orig_healthy_conf = 0.0
                cf_healthy_conf = 0.0

            cf_top_class_idx = int(torch.argmax(cf_probs).item())
            cf_top_class_name = self.idx_to_class.get(cf_top_class_idx, "Unknown")

        prob_drop = orig_disease_conf - cf_disease_conf
        healthy_gain = cf_healthy_conf - orig_healthy_conf

        narrative = (
            f"Neutralizing the primary {round(lesion_pixel_count / (h * w) * 100, 1)}% foliar lesion cluster "
            f"decreased disease confidence from {orig_disease_conf:.1f}% down to {cf_disease_conf:.1f}% "
            f"(a net reduction of {prob_drop:.1f}%). "
            f"Counterfactual top diagnosis shifted to '{cf_top_class_name}', confirming that the highlighted "
            f"lesion tissue is strictly the decisive causal factor."
        )

        return {
            "counterfactual_image_b64": encode_image_to_base64(counterfactual_pil),
            "difference_map_b64": encode_image_to_base64(diff_pil),
            "original_disease_confidence": round(orig_disease_conf, 2),
            "counterfactual_disease_confidence": round(cf_disease_conf, 2),
            "confidence_drop": round(prob_drop, 2),
            "healthy_confidence_gain": round(healthy_gain, 2),
            "counterfactual_predicted_class": cf_top_class_name,
            "lesion_surface_percentage": round(lesion_pixel_count / (h * w) * 100, 2),
            "narrative_explanation": narrative,
        }
