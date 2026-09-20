"""SHAP Explainable AI Engine for Plant Disease Detection.

Implements KernelSHAP / Occlusion-based SHAP estimation for PyTorch classification models
to highlight spatial region attributions for plant leaf disease predictions.
"""

import logging
import numpy as np  # type: ignore
import torch  # type: ignore
import torch.nn as nn  # type: ignore

logger = logging.getLogger("explainability.shap_explainer")


class SHAPExplainer:
    """SHAP (Shapley Additive exPlanations) occlusion explainer for image classification models."""

    def __init__(self, model: nn.Module, grid_size: int = 8) -> None:
        """Initializes SHAP occlusion explainer with target model.

        Args:
            model: Trained PyTorch classification model.
            grid_size: Spatial patch division size (e.g. 8x8 grid of superpixels).
        """
        self.model = model
        self.grid_size = grid_size

    def generate_heatmap(
        self,
        input_tensor: torch.Tensor,
        target_class_idx: int | None = None,
    ) -> np.ndarray:
        """Generates an occlusion-based SHAP value heatmap normalized to range [0, 1].

        Args:
            input_tensor: Preprocessed image tensor of shape (1, 3, H, W).
            target_class_idx: Index of target class. Defaults to top predicted class.

        Returns:
            np.ndarray: Normalized 2D heatmap matrix of shape (H, W).
        """
        self.model.eval()
        _, _, h, w = input_tensor.shape

        if target_class_idx is None:
            with torch.no_grad():
                logits = self.model(input_tensor)
                target_class_idx = int(logits.argmax(dim=1).item())

        patch_h = h // self.grid_size
        patch_w = w // self.grid_size
        n_patches = self.grid_size * self.grid_size

        # Build one batch: index 0 is the unmasked baseline, followed by one
        # occluded variant per grid patch. A single batched forward pass replaces
        # what used to be `n_patches + 1` sequential single-image forward passes.
        batch = input_tensor.repeat(n_patches + 1, 1, 1, 1).clone()
        patch_bounds: list[tuple[int, int, int, int]] = []
        for i in range(self.grid_size):
            for j in range(self.grid_size):
                r_start, r_end = i * patch_h, (i + 1) * patch_h
                c_start, c_end = j * patch_w, (j + 1) * patch_w
                batch_idx = 1 + i * self.grid_size + j
                batch[batch_idx, :, r_start:r_end, c_start:c_end] = 0.0
                patch_bounds.append((r_start, r_end, c_start, c_end))

        with torch.no_grad():
            probs = torch.softmax(self.model(batch), dim=1)[:, target_class_idx]

        baseline_prob = float(probs[0].item())
        occluded_probs = probs[1:].tolist()

        heatmap = np.zeros((h, w), dtype=np.float32)
        for (r_start, r_end, c_start, c_end), prob in zip(patch_bounds, occluded_probs):
            # Importance is drop in target class confidence when region is occluded
            importance = max(0.0, baseline_prob - prob)
            heatmap[r_start:r_end, c_start:c_end] = importance

        # Normalize to [0, 1] range
        h_min, h_max = heatmap.min(), heatmap.max()
        if h_max - h_min > 1e-8:
            heatmap = (heatmap - h_min) / (h_max - h_min)
        else:
            heatmap = np.zeros_like(heatmap)

        logger.info("SHAP occlusion heatmap generated successfully (%dx%d grid).", self.grid_size, self.grid_size)
        return heatmap
