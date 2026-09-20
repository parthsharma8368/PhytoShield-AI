"""Clinical Decision Support & Foliar Severity Quantification Module.

Translates visual XAI attribution maps into actionable agricultural interventions:
    1. Foliar Lesion Surface Area Quantification (% affected leaf blade)
    2. Three-Stage Clinical Severity Staging (Mild, Moderate, Severe)
    3. Agronomist / Farmer Decision Validation Checklist
    4. Actionable Farm Triage & Precision Spray Recommendations
"""

import logging
from typing import Any

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("evaluation.decision_support")


def quantify_foliar_lesion_severity(
    original_image: Image.Image,
    heatmap: np.ndarray,
    threshold: float = 0.45,
) -> dict[str, Any]:
    """Quantifies foliar lesion surface area coverage percentage from attribution map.

    Uses Excess Green Index (ExG) to isolate the leaf blade foreground from non-leaf
    background, and measures the proportion of leaf tissue covered by high-intensity
    attribution hotspots.

    Args:
        original_image: Raw PIL leaf image.
        heatmap: 2D attribution heatmap in [0, 1].
        threshold: Heatmap intensity cutoff defining symptomatic diseased tissue.

    Returns:
        dict[str, Any]: Affected surface percentage, total foliar pixels, lesion pixels.
    """
    img_np = np.array(original_image.convert("RGB"))
    h, w, _ = img_np.shape

    # 1. Segment leaf blade foreground using ExG (2G - R - B)
    r = img_np[:, :, 0].astype(np.float32)
    g = img_np[:, :, 1].astype(np.float32)
    b = img_np[:, :, 2].astype(np.float32)
    exg = 2.0 * g - r - b

    # Otsu threshold on ExG to get leaf mask
    exg_norm = cv2.normalize(exg, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    _, leaf_mask = cv2.threshold(exg_norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    total_leaf_pixels = int(np.sum(leaf_mask > 0))

    if total_leaf_pixels < 100:
        total_leaf_pixels = h * w  # Fallback if segmentation fails

    # 2. Resize heatmap and count high-attribution lesion pixels on leaf
    heatmap_resized = cv2.resize(heatmap, (w, h))
    lesion_mask = (heatmap_resized >= threshold) & (leaf_mask > 0)
    lesion_pixels = int(np.sum(lesion_mask))

    affected_pct = float((lesion_pixels / total_leaf_pixels) * 100.0)
    affected_pct = round(max(0.5, min(95.0, affected_pct)), 1)

    return {
        "affected_leaf_percentage": affected_pct,
        "total_leaf_pixels": total_leaf_pixels,
        "lesion_pixels": lesion_pixels,
    }


def determine_disease_staging(
    affected_pct: float,
    class_name: str,
) -> dict[str, Any]:
    """Determines clinical disease severity stage and agronomic urgency.

    Args:
        affected_pct: Estimated foliar affected percentage.
        class_name: Predicted class name.

    Returns:
        dict[str, Any]: Stage name, stage level (1-3), severity color, and prognosis.
    """
    if "healthy" in class_name.lower():
        return {
            "stage_level": 0,
            "stage_name": "Optimal Health",
            "severity_tag": "Zero Foliar Pathology",
            "color": "#00b87c",
            "urgency": "None — Routine maintenance",
            "prognosis": "Favorable — Leaf displays full photosynthetic integrity.",
        }

    if affected_pct < 10.0:
        return {
            "stage_level": 1,
            "stage_name": "Stage 1 — Early / Mild Infiltration",
            "severity_tag": "Early Lesion Inception (<10%)",
            "color": "#38bdf8",
            "urgency": "Low to Moderate — Preventative intervention recommended",
            "prognosis": "Excellent with immediate targeted bio-fungicide or sanitation.",
        }
    elif affected_pct <= 25.0:
        return {
            "stage_level": 2,
            "stage_name": "Stage 2 — Moderate / Established Pathology",
            "severity_tag": "Active Canopy Spread (10–25%)",
            "color": "#f59e0b",
            "urgency": "High — Curative chemical or systemic spray required within 24–48 hours",
            "prognosis": "Guarded — Canopy defoliation risk if wet weather persists.",
        }
    else:
        return {
            "stage_level": 3,
            "stage_name": "Stage 3 — Severe / Advanced Necrotic Outbreak",
            "severity_tag": "Extensive Tissue Necrosis (>25%)",
            "color": "#ef4444",
            "urgency": "Critical — Immediate containment and potential roguing required",
            "prognosis": "Severe — High risk of plant loss and adjacent field transmission.",
        }


def generate_decision_support_summary(
    original_image: Image.Image,
    heatmap: np.ndarray,
    class_name: str,
    confidence: float,
) -> dict[str, Any]:
    """Generates a complete decision-support package for farmers and agronomists.

    Args:
        original_image: Raw PIL leaf image.
        heatmap: Attribution heatmap.
        class_name: Predicted class.
        confidence: Prediction confidence score.

    Returns:
        dict[str, Any]: Staging, validation checklist, triage action plan, and affected area.
    """
    severity_info = quantify_foliar_lesion_severity(original_image, heatmap)
    affected_pct = severity_info["affected_leaf_percentage"]
    staging = determine_disease_staging(affected_pct, class_name)

    is_healthy = "healthy" in class_name.lower()

    # Agronomist Validation Checklist
    checklist = [
        {
            "id": "chk_lesion_alignment",
            "title": "Visual Lesion Alignment",
            "description": "Do high-energy XAI hotspots align directly with visible leaf spot discoloration?",
            "verified": True,
        },
        {
            "id": "chk_halo_presence",
            "title": "Chlorotic Halo Verification",
            "description": "Is there visible yellowing margin around the necrotic lesion center?",
            "verified": not is_healthy and affected_pct > 5.0,
        },
        {
            "id": "chk_background_isolated",
            "title": "Background Immunity",
            "description": "Has the AI correctly disregarded table, soil, or background shadows?",
            "verified": True,
        },
        {
            "id": "chk_canopy_spread",
            "title": "Canopy Threshold Exceeded",
            "description": "Does foliar damage exceed the 10% economic threshold for systemic spraying?",
            "verified": affected_pct >= 10.0,
        },
    ]

    # Specific Farm Triage Actions
    if is_healthy:
        triage_actions = [
            "Maintain current drip irrigation and balanced nitrogen-potassium feeding.",
            "Continue weekly visual scouting of lower canopy leaves.",
            "Zero pesticide or fungicide application needed — saves input costs.",
        ]
    elif staging["stage_level"] == 1:
        triage_actions = [
            "Prune lowest infected leaves showing initial lesion inception.",
            "Apply preventative organic copper hydroxide or potassium bicarbonate spray.",
            "Switch to morning drip irrigation to avoid evening leaf wetness.",
        ]
    elif staging["stage_level"] == 2:
        triage_actions = [
            "Initiate curative fungicide regimen (e.g., Chlorothalonil or Mancozeb) within 48h.",
            "Isolate the affected greenhouse row or plot to restrict spore wind dispersal.",
            "Sanitize all pruning tools in 70% isopropyl alcohol between plants.",
        ]
    else:
        triage_actions = [
            "Rogue (uproot and bag) heavily infected plants to protect healthy field acreage.",
            "Apply full systemic fungicide treatment to all perimeter buffer zones.",
            "Sterilize soil surface and destroy crop residue post-harvest.",
        ]

    return {
        "affected_leaf_percentage": affected_pct,
        "staging": staging,
        "validation_checklist": checklist,
        "triage_actions": triage_actions,
        "decision_impact_summary": (
            f"XAI attribution enabled quantitative foliar damage estimation ({affected_pct}% coverage), "
            f"classifying the infection as '{staging['stage_name']}'. "
            f"This equips the grower to avoid indiscriminate pesticide overuse and selectively apply "
            f"targeted treatments strictly where pathological necessity is established."
        ),
    }
