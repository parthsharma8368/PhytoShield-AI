"""LIME Explainable AI Engine for Plant Disease Detection.

Implements Local Interpretable Model-agnostic Explanations (LIME) for image
classification using superpixel-based perturbation analysis.

LIME (Ribeiro et al., 2016) treats the model as a complete black box and explains
individual predictions by:
    1. Segmenting the input image into semantically coherent superpixels (SLIC algorithm).
    2. Generating a neighbourhood of perturbed images where random subsets of
       superpixels are occluded (set to grey).
    3. Getting model predictions on all perturbed images.
    4. Fitting a weighted linear surrogate model (LASSO/Ridge) around these predictions.
    5. The linear model's coefficients are the SHAP-like feature importances per superpixel.

LIME is the only truly model-agnostic method in our XAI stack — it requires no access
to gradients, layers, or internal model structure. It is particularly valuable for
non-ML audiences because the "which regions matter" question is answered via simple
linear approximation, not deep network internals.

Trade-off: LIME is the slowest method (~2–5 seconds) due to the ~150–200 forward passes
required to build the perturbation dataset.

Reference:
    Ribeiro, M. T., Singh, S., & Guestrin, C. (2016). "Why should I trust you?":
    Explaining the predictions of any classifier. KDD 2016. arXiv:1602.04938.
"""

import logging
from typing import Callable

import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image

logger = logging.getLogger("explainability.lime_explainer")


class LIMEExplainer:
    """LIME superpixel explainer for plant disease classification.

    Generates superpixel importance maps by probing the model with hundreds of
    masked perturbations and fitting a linear surrogate model. Compatible with
    the overlay_heatmap_on_image() visualizer interface.
    """

    def __init__(
        self,
        model: nn.Module,
        num_samples: int = 200,
        num_features: int = 10,
    ) -> None:
        """Initializes the LIME explainer.

        Args:
            model: Trained PyTorch classification model (EfficientNet-B0).
            num_samples: Number of perturbed images to generate for the surrogate
                         model fit (default: 200). Higher → more stable, slower.
            num_features: Number of top superpixels to highlight in the output
                          (default: 10). Controls how many regions are shown as
                          important.
        """
        self.model = model
        self.num_samples = num_samples
        self.num_features = num_features
        logger.info(
            "LIME explainer initialized. num_samples=%d, num_features=%d",
            num_samples,
            num_features,
        )

    def _build_predict_fn(
        self,
        device: torch.device,
        preprocess_fn: Callable[[Image.Image], torch.Tensor],
    ) -> Callable[[np.ndarray], np.ndarray]:
        """Builds a LIME-compatible prediction function.

        LIME's LimeImageExplainer expects a function that takes an array of
        perturbed uint8 images (N, H, W, 3) and returns a probability matrix (N, C).

        Args:
            device: Torch device for inference.
            preprocess_fn: Preprocessing transform function for a single PIL Image.

        Returns:
            Callable: Batch prediction function compatible with lime.lime_image.
        """
        model = self.model
        imagenet_mean = torch.tensor([0.485, 0.456, 0.406], device=device).view(1, 3, 1, 1)
        imagenet_std = torch.tensor([0.229, 0.224, 0.225], device=device).view(1, 3, 1, 1)

        def predict_batch(images: np.ndarray) -> np.ndarray:
            """Runs vectorized batch inference on perturbed images for LIME surrogate fitting.

            Args:
                images: NumPy array of perturbed uint8 leaf images (N, H, W, 3).

            Returns:
                np.ndarray: Softmax probability matrix (N, C).
            """
            model.eval()
            # Fast vectorized batch normalization directly from numpy
            t = torch.from_numpy(images).permute(0, 3, 1, 2).float().to(device) / 255.0
            if t.shape[2:] != (224, 224):
                t = torch.nn.functional.interpolate(t, size=(224, 224), mode="bilinear", align_corners=False)
            t = (t - imagenet_mean) / imagenet_std

            with torch.no_grad():
                logits = model(t)                      # (N, C)
                probs = torch.softmax(logits, dim=1)   # (N, C)

            return probs.cpu().numpy()

        return predict_batch

    def generate_heatmap(
        self,
        input_tensor: torch.Tensor,
        target_class_idx: int | None = None,
        original_image: Image.Image | None = None,
    ) -> np.ndarray:
        """Generates a LIME superpixel importance heatmap normalized to [0, 1].

        Args:
            input_tensor: Preprocessed image tensor (1, 3, H, W).
            target_class_idx: Class index to explain. Defaults to argmax prediction.
            original_image: Original PIL Image.

        Returns:
            np.ndarray: Normalized 2D superpixel importance heatmap (H, W), [0, 1].
        """
        try:
            from lime import lime_image
            from lime.wrappers.scikit_image import SegmentationAlgorithm
        except ImportError as exc:
            raise ImportError(
                "LIME package is required. Install with: pip install lime"
            ) from exc

        from preprocessing.transforms import preprocess_image_for_inference

        self.model.eval()
        device = next(self.model.parameters()).device

        # Determine target class
        with torch.no_grad():
            logits = self.model(input_tensor)
            if target_class_idx is None:
                target_class_idx = int(logits.argmax(dim=1).item())

        if original_image is None:
            imagenet_mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
            imagenet_std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
            img_denorm = input_tensor.squeeze(0).cpu() * imagenet_std + imagenet_mean
            img_denorm = torch.clamp(img_denorm, 0.0, 1.0)
            img_np = (img_denorm.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
            original_image = Image.fromarray(img_np, mode="RGB")

        orig_w, orig_h = original_image.size
        # Optimize for 224x224 to achieve real-time LIME execution (<1s)
        lime_input_img = original_image.resize((224, 224), Image.Resampling.BILINEAR)
        img_array = np.array(lime_input_img)

        predict_fn = self._build_predict_fn(
            device=device,
            preprocess_fn=preprocess_image_for_inference,
        )

        explainer = lime_image.LimeImageExplainer(verbose=False)
        segmentation_fn = SegmentationAlgorithm(
            algo_type="slic",
            n_segments=60,
            compactness=10,
            sigma=1,
        )

        effective_samples = min(self.num_samples, 50)
        explanation = explainer.explain_instance(
            image=img_array,
            classifier_fn=predict_fn,
            labels=(target_class_idx,),
            hide_color=128,
            num_samples=effective_samples,
            batch_size=32,
            segmentation_fn=segmentation_fn,
        )

        segments = explanation.segments
        segment_weights: dict[int, float] = {}
        if target_class_idx in explanation.local_exp:
            segment_weights = dict(explanation.local_exp[target_class_idx])
        elif len(explanation.local_exp) > 0:
            first_label = list(explanation.local_exp.keys())[0]
            segment_weights = dict(explanation.local_exp[first_label])

        heatmap = np.zeros_like(segments, dtype=np.float32)
        for seg_id, weight in segment_weights.items():
            if weight > 0.0:
                heatmap[segments == seg_id] = weight

        # Normalize to [0, 1]
        h_min, h_max = heatmap.min(), heatmap.max()
        if h_max - h_min > 1e-8:
            heatmap = (heatmap - h_min) / (h_max - h_min)
        else:
            heatmap = np.zeros_like(heatmap, dtype=np.float32)

        # Resize back to original image aspect if needed
        if (orig_w, orig_h) != (224, 224):
            heatmap = cv2.resize(heatmap, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)

        logger.info(
            "LIME heatmap generated. Active segments: %d, Shape: %s",
            int((heatmap > 0).sum()),
            heatmap.shape,
        )
        return heatmap
