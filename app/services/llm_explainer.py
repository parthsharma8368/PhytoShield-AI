"""Groq LLM service: disease guidance and per-method explanations written from this image's measured findings.

There is no canned text. If Groq cannot be reached the response says so (``source: "unavailable"``)
instead of showing generic filler that looks like a real answer.
"""

import json
import logging
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("app.services.llm_explainer")

# Attempt importing Groq SDK safely
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logger.warning("Groq package not installed. Fallback mode will be used.")



CURATED_DISEASE_NAMES: dict[str, str] = {
    # Pepper
    "Pepper__bell___Bacterial_spot": "Bell Pepper Bacterial Spot Disease",
    "Pepper_bell___Bacterial_spot": "Bell Pepper Bacterial Spot Disease",
    "Pepper__bell___healthy": "Healthy Bell Pepper Foliage",
    "Pepper_bell___healthy": "Healthy Bell Pepper Foliage",
    # Potato
    "Potato___Early_blight": "Potato Early Blight Disease",
    "Potato___Late_blight": "Potato Late Blight Disease",
    "Potato___healthy": "Healthy Potato Foliage",
    "Potato_healthy": "Healthy Potato Foliage",
    # Tomato
    "Tomato_Bacterial_spot": "Tomato Bacterial Spot Disease",
    "Tomato___Bacterial_spot": "Tomato Bacterial Spot Disease",
    "Tomato_Early_blight": "Tomato Early Blight Disease",
    "Tomato___Early_blight": "Tomato Early Blight Disease",
    "Tomato_Late_blight": "Tomato Late Blight Disease",
    "Tomato___Late_blight": "Tomato Late Blight Disease",
    "Tomato_Leaf_Mold": "Tomato Leaf Mold Disease",
    "Tomato___Leaf_Mold": "Tomato Leaf Mold Disease",
    "Tomato_Septoria_leaf_spot": "Tomato Septoria Leaf Spot Disease",
    "Tomato___Septoria_leaf_spot": "Tomato Septoria Leaf Spot Disease",
    "Tomato_Spider_mites_Two_spotted_spider_mite": "Tomato Two-Spotted Spider Mite Infestation",
    "Tomato___Spider_mites_Two_spotted_spider_mite": "Tomato Two-Spotted Spider Mite Infestation",
    "Tomato__Target_Spot": "Tomato Target Spot Disease",
    "Tomato___Target_Spot": "Tomato Target Spot Disease",
    "Tomato__Tomato_YellowLeaf__Curl_Virus": "Tomato Yellow Leaf Curl Virus (TYLCV)",
    "Tomato___Tomato_YellowLeaf__Curl_Virus": "Tomato Yellow Leaf Curl Virus (TYLCV)",
    "Tomato_Yellow_Leaf_Curl_Virus": "Tomato Yellow Leaf Curl Virus (TYLCV)",
    "Tomato__Tomato_mosaic_virus": "Tomato Mosaic Virus (ToMV)",
    "Tomato___Tomato_mosaic_virus": "Tomato Mosaic Virus (ToMV)",
    "Tomato_mosaic_virus": "Tomato Mosaic Virus (ToMV)",
    "Tomato_healthy": "Healthy Tomato Foliage",
    "Tomato___healthy": "Healthy Tomato Foliage",
    # Apple
    "Apple___Apple_scab": "Apple Scab Disease",
    "Apple___Black_rot": "Apple Black Rot Disease",
    "Apple___Cedar_apple_rust": "Cedar Apple Rust Disease",
    "Apple___healthy": "Healthy Apple Foliage",
    # Corn
    "Corn_(maize)___Cercospora_leaf_spot_Gray_leaf_spot": "Corn Gray Leaf Spot Disease",
    "Corn_(maize)___Common_rust_": "Corn Common Rust Disease",
    "Corn_(maize)___Northern_Leaf_Blight": "Northern Corn Leaf Blight Disease",
    "Corn_(maize)___healthy": "Healthy Corn Foliage",
    # Grape
    "Grape___Black_rot": "Grapevine Black Rot Disease",
    "Grape___Esca_(Black_Measles)": "Grapevine Esca (Black Measles) Disease",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Grapevine Leaf Blight (Isariopsis Spot)",
    "Grape___healthy": "Healthy Grapevine Foliage",
    # Peach
    "Peach___Bacterial_spot": "Peach Bacterial Spot Disease",
    "Peach___healthy": "Healthy Peach Foliage",
}


def clean_class_name(raw_class_name: str) -> str:
    """Formats raw class identifier into human-friendly, agronomically accurate display name."""
    if not raw_class_name:
        return "Unknown Plant Specimen"

    # Direct match
    if raw_class_name in CURATED_DISEASE_NAMES:
        return CURATED_DISEASE_NAMES[raw_class_name]

    # Case-insensitive match
    for k, v in CURATED_DISEASE_NAMES.items():
        if k.lower() == raw_class_name.lower():
            return v

    # Fallback semantic normalization
    clean = (
        raw_class_name.replace("___", " - ")
        .replace("__", " ")
        .replace("_", " ")
        .replace("(including sour)", "")
        .replace("(maize)", "")
        .strip()
    )
    clean = clean.replace("Pepper bell", "Bell Pepper")
    clean = clean.replace("YellowLeaf", "Yellow Leaf")
    if "healthy" in clean.lower():
        crop = clean.lower().replace("healthy", "").replace("-", "").strip().title()
        return f"Healthy {crop} Foliage" if crop else "Healthy Plant Foliage"

    return clean.title()



def normalize_method_key(xai_method: str) -> str:
    """Normalizes xai_method string to canonical key."""
    m = xai_method.lower().strip()
    if "gradcam_pp" in m or "gradcam++" in m or "plus" in m:
        return "gradcam_pp"
    if "gradcam" in m or "grad_cam" in m:
        return "gradcam"
    if "saliency" in m or "vanilla" in m:
        return "saliency"
    if "smoothgrad" in m or "smooth" in m:
        return "smoothgrad"
    if "integrated" in m or m == "ig":
        return "integrated_gradients"
    if "shap" in m:
        return "shap"
    if "lime" in m:
        return "lime"
    return "all"


def _clean_json_text(raw_text: str) -> str:
    """Strips markdown code fences (```json ... ```) from LLM output before json parsing."""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text



DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_TIMEOUT_S = 30.0

METHOD_TITLES: dict[str, str] = {
    "gradcam": "Grad-CAM", "gradcam_pp": "Grad-CAM++", "saliency": "Saliency", "smoothgrad": "SmoothGrad",
    "integrated_gradients": "Integrated Gradients", "shap": "SHAP (occlusion)", "lime": "LIME", "all": "All 7 methods",
}

METHOD_FOCUS: dict[str, str] = {
    "gradcam": "Grad-CAM: coarse regions where the last convolution layer is most active for this class.",
    "gradcam_pp": "Grad-CAM++: like Grad-CAM but weights gradients so several separate lesions can each light up.",
    "saliency": "Saliency: how much the class score changes if each single pixel changes; shows fine edges and veins.",
    "smoothgrad": "SmoothGrad: saliency averaged over noisy copies of the image, which removes speckle.",
    "integrated_gradients": "Integrated Gradients: pixel credit summed along a path from a blank image to this image.",
    "shap": "SHAP (occlusion): patches of the leaf are hidden one at a time; patches whose removal lowers the score matter most.",
    "lime": "LIME: a simple local model fitted on many altered copies of the image, giving credit to superpixel regions.",
    "all": "All seven methods side by side: what each one adds and how far they should be trusted to agree.",
}

SYSTEM_PROMPT = (
    "You are a plant pathologist who also explains computer-vision models to growers. "
    "Write for a farmer or student: plain words, specific, practical. "
    "Base every statement about THIS leaf only on the analysis facts you are given and never invent numbers. "
    "If confidence is low, uncertainty is high or the facts disagree, say so and what to check. "
    "Plain text only (no markdown, no asterisks). Treatments must mention checking local rules and product labels. "
    "Answer with one JSON object and nothing else."
)


def _ask_groq(user_prompt: str, api_key: str | None = None, max_tokens: int = 2500) -> dict[str, Any]:
    """One Groq chat call that returns the parsed JSON object. Raises on any failure."""
    key = api_key or os.getenv("GROQ_API_KEY")
    if not GROQ_AVAILABLE:
        raise RuntimeError("the groq package is not installed")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set")
    extra = {"reasoning_effort": "low"} if "gpt-oss" in DEFAULT_GROQ_MODEL else {}
    completion = Groq(api_key=key, timeout=GROQ_TIMEOUT_S).chat.completions.create(
        model=DEFAULT_GROQ_MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}],
        temperature=0.3,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        **extra,
    )
    return json.loads(_clean_json_text(completion.choices[0].message.content or "{}"))


def _ensure_str(val: Any, default: str = "") -> str:
    """Turns a JSON field (string, list or dict) into text; list items become '• ' lines the UI splits into cards."""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, list):
        return "\n".join(f"• {x}" for x in val)
    if isinstance(val, dict):
        return "\n".join(f"• {k}: {v}" for k, v in val.items())
    return default if val is None else str(val)


def _facts(class_name: str, confidence: float, findings: dict[str, Any] | None) -> str:
    facts = {"diagnosis": clean_class_name(class_name), "model_class": class_name, "calibrated_confidence_pct": round(confidence, 1)}
    facts.update(findings or {})
    return json.dumps(facts, ensure_ascii=False)[:3000]


def get_xai_specific_explanation(
    class_name: str,
    confidence: float,
    xai_method: str = "gradcam",
    findings: dict[str, Any] | None = None,
    api_key: str | None = None,
) -> dict[str, str]:
    """Explains what the chosen attribution method shows for this specific image."""
    method_key = normalize_method_key(xai_method)
    title = METHOD_TITLES[method_key]
    base = {"xai_method": method_key, "heading": f"WHAT THE AI SEES — {title.upper()}", "method_label": title}
    prompt = (
        f"Analysis facts for this leaf (JSON): {_facts(class_name, confidence, findings)}\n\n"
        f"Method: {METHOD_FOCUS[method_key]}\n\n"
        "Explain in 5-7 sentences: (1) how this method works in one plain sentence, (2) what its heatmap shows on "
        "this leaf and why that is consistent or inconsistent with the diagnosis, using the measured damage, concept "
        "scores, counterfactual drop and quality numbers where present, (3) one limitation of this method, and "
        "(4) what the grower should check on the real leaf. Do not claim the heatmap proves the diagnosis.\n"
        'Return {"explanation": "..."}'
    )
    try:
        return {**base, "explanation": _ensure_str(_ask_groq(prompt, api_key, 1500).get("explanation"))}
    except Exception as exc:
        logger.warning("Groq explanation for %s failed: %s", method_key, exc)
        return {**base, "explanation": f"The AI explanation could not be generated right now ({type(exc).__name__}). The heatmap itself is unaffected."}


def get_disease_explanation(
    class_name: str,
    confidence: float,
    findings: dict[str, Any] | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Disease guidance for this diagnosis, written around the measured findings of this image."""
    disease_title = clean_class_name(class_name)
    prompt = (
        f"Analysis facts for this leaf (JSON): {_facts(class_name, confidence, findings)}\n\n"
        "Write the guidance as a JSON object with exactly these keys:\n"
        '"explanation": 5-7 sentences. The causal organism or condition, how it spreads and what weather or '
        "conditions favour it, how it harms the plant, then what the measured findings for THIS leaf say "
        "(damage level, stage, confidence, uncertainty). If the model is unsure, say which similar diseases to rule out.\n"
        '"signs": list of 4-6 specific things to look for on the real leaf, stem and fruit.\n'
        '"xai_feature_explanation": 4-6 sentences on what the heatmaps, concept scores and counterfactual test '
        "show for this image and how much to trust them given the quality numbers.\n"
        '"cure": list of 4-6 treatment steps in order: removal and cultural steps first, then named active-ingredient '
        "classes (organic and conventional) with timing and repeat interval. State that labels and local rules decide. Call only copper, sulfur, Bacillus-based products, potassium bicarbonate and horticultural or neem oils organic; chlorothalonil, mancozeb and azoxystrobin are conventional.\n"
        '"prevention": list of 4-6 season-long practices.\n'
        '"precautions": list of 4-5 things to do in the next 24-48 hours to stop spread.\n'
        "If the diagnosis is a healthy leaf, make the guidance about keeping it healthy and what early signs to scout for."
    )
    try:
        data = _ask_groq(prompt, api_key, 3000)
        return {
            "disease_title": disease_title,
            "source": "groq",
            **{k: _ensure_str(data.get(k)) for k in ("explanation", "signs", "xai_feature_explanation", "cure", "prevention", "precautions")},
        }
    except Exception as exc:
        logger.warning("Groq guidance for %s failed: %s", class_name, exc)
        note = f"The AI guidance could not be generated right now ({type(exc).__name__}). Try again in a moment; the diagnosis and measurements are unaffected."
        return {"disease_title": disease_title, "source": "unavailable", "explanation": note, "signs": "", "xai_feature_explanation": note,
                "cure": note, "prevention": note, "precautions": note}
