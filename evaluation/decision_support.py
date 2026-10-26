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


SEG_SIZE = 256


def segment_leaf_and_lesions(original_image: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    """Colour-based leaf and lesion masks on a 256x256 copy, independent of the CNN.

    1. Leaf: GrabCut seeded by the large green regions (the border band is background), holes filled.
    2. Lesion: leaf pixels that are not healthy green and are tissue-coloured (yellow, brown, red), near-black,
       or pale (mould, bleaching). Grey/purple shading is ignored, and a 4 px band at the leaf edge is dropped
       because it holds soft shadow rather than tissue.

    Returns (leaf_mask, lesion_mask, rgb) or None when no leaf can be isolated.
    """
    rgb = np.array(original_image.convert("RGB").resize((SEG_SIZE, SEG_SIZE), Image.BILINEAR))
    hsv = cv2.cvtColor(cv2.medianBlur(rgb, 5), cv2.COLOR_RGB2HSV)
    hue, sat, val = (hsv[..., i].astype(np.float32) for i in range(3))
    green = (hue >= 30) & (hue <= 95) & (sat >= 30) & (val >= 25)

    core = ((hue >= 30) & (hue <= 95) & (sat >= 50) & (val >= 35)).astype(np.uint8)
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(core)
    big = np.isin(labels, [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 0.02 * SEG_SIZE ** 2])
    if not big.any():
        return None

    gc = np.full(core.shape, cv2.GC_PR_BGD, np.uint8)
    gc[cv2.dilate(big.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0] = cv2.GC_PR_FGD
    gc[cv2.erode(big.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = cv2.GC_FGD
    m = SEG_SIZE // 20
    gc[:m] = gc[-m:] = cv2.GC_BGD
    gc[:, :m] = gc[:, -m:] = cv2.GC_BGD
    if not (gc == cv2.GC_FGD).any():
        return None
    cv2.grabCut(rgb, gc, None, np.zeros((1, 65)), np.zeros((1, 65)), 4, cv2.GC_INIT_WITH_MASK)

    leaf = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
    leaf = cv2.morphologyEx(leaf, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(leaf)
    if n < 2:
        return None
    leaf = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    contours, _ = cv2.findContours(leaf, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(leaf)
    cv2.drawContours(filled, contours, -1, 1, -1)
    if filled.sum() < 0.03 * SEG_SIZE ** 2:
        return None

    inner = cv2.erode(filled, np.ones((9, 9), np.uint8)) > 0
    tissue_colour = (((hue <= 32) | (hue >= 165)) & (sat >= 40)) | (val < 25) | ((sat < 30) & (val > 170))
    lesion = inner & ~green & tissue_colour
    lesion = cv2.morphologyEx(lesion.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    return filled.astype(bool), lesion, rgb


def quantify_foliar_lesion_severity(
    original_image: Image.Image,
    heatmap: np.ndarray | None = None,
    threshold: float = 0.45,
) -> dict[str, Any]:
    """Share of the leaf covered by discoloured tissue, measured from pixel colour (not from the CNN heatmap).

    Also reports how much of the CNN's attention hotspot (heatmap >= threshold) falls on the leaf and on lesions,
    so the severity number and the explanation can be cross-checked. ``affected_leaf_percentage`` is None when no
    leaf can be isolated from the background.
    """
    seg = segment_leaf_and_lesions(original_image)
    if seg is None:
        return {"affected_leaf_percentage": None, "total_leaf_pixels": 0, "lesion_pixels": 0,
                "attention_on_leaf": None, "attention_on_lesion": None, "yellow_halo": False}
    leaf, lesion, rgb = seg
    leaf_px, lesion_px = int(leaf.sum()), int(lesion.sum())

    attention_on_leaf = attention_on_lesion = None
    if heatmap is not None:
        hot = cv2.resize(np.asarray(heatmap, dtype=np.float32), (SEG_SIZE, SEG_SIZE)) >= threshold
        if hot.any():
            attention_on_leaf = float((hot & leaf).sum() / hot.sum())
            attention_on_lesion = float((hot & cv2.dilate(lesion.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)).sum() / hot.sum())

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    yellow = (hsv[..., 0] >= 18) & (hsv[..., 0] <= 34) & (hsv[..., 1] >= 60) & (hsv[..., 2] >= 90)
    ring = cv2.dilate(lesion.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool) & leaf & ~lesion
    yellow_halo = bool(ring.sum() > 0 and (yellow & ring).sum() / ring.sum() >= 0.05)

    return {
        "affected_leaf_percentage": round(100.0 * lesion_px / leaf_px, 1),
        "total_leaf_pixels": leaf_px,
        "lesion_pixels": lesion_px,
        "attention_on_leaf": attention_on_leaf,
        "attention_on_lesion": attention_on_lesion,
        "yellow_halo": yellow_halo,
    }


def determine_disease_staging(
    affected_pct: float | None,
    class_name: str,
) -> dict[str, Any]:
    """Determines clinical disease severity stage and agronomic urgency.

    Args:
        affected_pct: Estimated foliar affected percentage.
        class_name: Predicted class name.

    Returns:
        dict[str, Any]: Stage name, stage level (1-3), severity color, and prognosis.
    """
    if affected_pct is None:
        return {
            "stage_level": -1,
            "stage_name": "Severity not measurable",
            "severity_tag": "Leaf could not be separated from the background",
            "color": "#94a3b8",
            "urgency": "Retake the photo: one leaf, plain background, good light",
            "prognosis": "Unknown from this photo.",
        }

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
    on_leaf, on_lesion = severity_info["attention_on_leaf"], severity_info["attention_on_lesion"]
    measured = affected_pct is not None

    # Checklist items are computed from this photo, not preset. Each one can fail.
    checklist = [
        {
            "id": "chk_lesion_alignment",
            "title": "Visual Lesion Alignment",
            "description": "Do the AI hotspots sit on visibly discoloured tissue? (needs at least 1% discoloured leaf and 50% of the hotspot on it)",
            "verified": bool(measured and affected_pct >= 1.0 and on_lesion is not None and on_lesion >= 0.5),
        },
        {
            "id": "chk_halo_presence",
            "title": "Chlorotic Halo Verification",
            "description": "Is there yellowing in a ring around the discoloured spots? (measured from colour)",
            "verified": bool(measured and not is_healthy and severity_info["yellow_halo"]),
        },
        {
            "id": "chk_background_isolated",
            "title": "Background Immunity",
            "description": "Is at least 85% of the AI hotspot on the leaf rather than the table, soil or shadow?",
            "verified": bool(on_leaf is not None and on_leaf >= 0.85),
        },
        {
            "id": "chk_canopy_spread",
            "title": "Canopy Threshold Exceeded",
            "description": "Does measured damage exceed the 10% level used for systemic spraying?",
            "verified": bool(measured and affected_pct >= 10.0),
        },
    ]

    # Specific Farm Triage Actions
    if not measured:
        triage_actions = ["Retake the photo with one leaf filling the frame on a plain background, then analyse again."]
    elif is_healthy:
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
            f"Colour analysis found {affected_pct}% of the leaf discolured, which places it at '{staging['stage_name']}'."
            if measured else
            "The leaf could not be separated from the background, so no damage estimate is given."
        ),
    }
