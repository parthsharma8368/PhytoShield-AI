"""API Routes for Explainable AI Plant Disease Detection.

Prediction is split into three independent stages so a diagnosis renders
almost immediately instead of waiting on the full research pipeline:
  • POST /predict/quick   — classification + one heatmap, target <300ms
  • POST /predict/report  — full 7-method XAI suite + research extensions
  • POST /predict/insight — Groq LLM clinical narrative

The 7-method XAI attribution engine behind /predict/report:
  • Grad-CAM             — class-discriminative coarse region heatmap
  • Grad-CAM++           — second-order gradient weighting, sharper localization
  • Vanilla Saliency     — fastest pixel-level |∂y/∂x| attribution
  • SmoothGrad           — noise-averaged saliency for cleaner pixel maps
  • Integrated Gradients — axiomatically complete path-integral attribution
  • SHAP Occlusion       — game-theory patch-importance maps (single batched pass)
  • LIME                 — model-agnostic superpixel surrogate

Extended with:
  • Counterfactual Analysis & Botanical Concept Attribution
  • Clinical Decision Support & Foliar Severity Staging
  • Explanation Quality Metrics (Faithfulness, Stability, Robustness, etc.)
  • Multi-Model Benchmarking Matrix
  • Subgroup Fairness & Trustworthiness Safety Audit
  • 10-Dimension XAI Evaluation Framework
"""

import asyncio
import io
import json
import logging
import time
from pathlib import Path
from typing import Any

import torch
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image

from api.schemas import (
    BenchmarkModelItem,
    CounterfactualResponse,
    BotanicalConceptsResponse,
    DecisionSupportResponse,
    ExplanationQualityResponse,
    HealthCheckResponse,
    InsightRequest,
    InsightResponse,
    PipelineTimings,
    QuickPredictionResponse,
    ReportResponse,
    TrustworthinessResponse,
    XAIExplanationRequest,
    XAIExplanationResponse,
    XAIFrameworkResponse,
)

from app.services.llm_explainer import clean_class_name, get_disease_explanation, get_xai_specific_explanation
from evaluation.decision_support import generate_decision_support_summary
from evaluation.model_benchmarks import generate_benchmarking_report
from evaluation.trustworthiness import compute_mc_dropout_uncertainty, generate_trustworthiness_report
from explainability.concept_explainer import BotanicalConceptExplainer
from explainability.counterfactual import CounterfactualExplainer
from explainability.grad_cam import GradCAM
from explainability.grad_cam_plus_plus import GradCAMPlusPlus
from explainability.integrated_gradients import IntegratedGradients
from explainability.lime_explainer import LIMEExplainer
from explainability.metrics import evaluate_all_explanation_metrics
from explainability.saliency import SaliencyExplainer, SmoothGradExplainer
from explainability.shap_explainer import SHAPExplainer
from explainability.visualizer import encode_all_heatmaps
from models.efficientnet import build_efficientnet_b0
from preprocessing.transforms import preprocess_image_for_inference

logger = logging.getLogger("api.routes")
router = APIRouter()

# ── Global engine holders ────────────────────────────────────────────────────
MODEL: torch.nn.Module | None = None
CLASS_MAPPING: dict[str, int] = {}
IDX_TO_CLASS: dict[int, str] = {}

GRAD_CAM: GradCAM | None = None
GRAD_CAM_PP: GradCAMPlusPlus | None = None
SALIENCY_EXPLAINER: SaliencyExplainer | None = None
SMOOTH_GRAD_EXPLAINER: SmoothGradExplainer | None = None
IG_EXPLAINER: IntegratedGradients | None = None
SHAP_EXPLAINER: SHAPExplainer | None = None
LIME_EXPLAINER: LIMEExplainer | None = None
COUNTERFACTUAL_EXPLAINER: CounterfactualExplainer | None = None
CONCEPT_EXPLAINER: BotanicalConceptExplainer | None = None

if torch.cuda.is_available():
    DEVICE: torch.device = torch.device("cuda")
elif torch.backends.mps.is_available():
    DEVICE: torch.device = torch.device("mps")
else:
    DEVICE: torch.device = torch.device("cpu")


def load_model_and_metadata() -> None:
    """Loads class mapping, model weights, and all XAI and analysis engines into global scope."""
    global MODEL, CLASS_MAPPING, IDX_TO_CLASS
    global GRAD_CAM, GRAD_CAM_PP
    global SALIENCY_EXPLAINER, SMOOTH_GRAD_EXPLAINER
    global IG_EXPLAINER, SHAP_EXPLAINER, LIME_EXPLAINER
    global COUNTERFACTUAL_EXPLAINER, CONCEPT_EXPLAINER

    project_root = Path(__file__).resolve().parent.parent
    mapping_path = project_root / "data" / "class_mapping.json"
    checkpoint_path = project_root / "models" / "best_model.pth"

    if mapping_path.exists():
        with open(mapping_path, "r", encoding="utf-8") as f:
            CLASS_MAPPING = json.load(f)
            IDX_TO_CLASS = {v: k for k, v in CLASS_MAPPING.items()}
    else:
        logger.warning("Class mapping file not found at %s.", mapping_path)
        CLASS_MAPPING = {"Tomato_healthy": 0, "Potato___Early_blight": 1, "Potato___Late_blight": 2}
        IDX_TO_CLASS = {v: k for k, v in CLASS_MAPPING.items()}

    num_classes = max(len(CLASS_MAPPING), 1)
    MODEL = build_efficientnet_b0(num_classes=num_classes, pretrained=True)

    if checkpoint_path.exists():
        logger.info("Loading trained weights from %s...", checkpoint_path)
        checkpoint = torch.load(checkpoint_path, map_location=DEVICE, weights_only=True)
        MODEL.load_state_dict(checkpoint["model_state_dict"])
    else:
        logger.warning("Checkpoint '%s' not found. Running with initial weights.", checkpoint_path)

    MODEL.to(DEVICE)
    MODEL.eval()

    # ── Initialise XAI engines ───────────────────────────────────────────────
    target_layer = MODEL.get_target_layer_for_gradcam()

    GRAD_CAM              = GradCAM(model=MODEL, target_layer=target_layer)
    GRAD_CAM_PP           = GradCAMPlusPlus(model=MODEL, target_layer=target_layer)
    SALIENCY_EXPLAINER    = SaliencyExplainer(model=MODEL)
    SMOOTH_GRAD_EXPLAINER = SmoothGradExplainer(model=MODEL, num_samples=15, noise_level=0.1)
    IG_EXPLAINER          = IntegratedGradients(model=MODEL)
    SHAP_EXPLAINER        = SHAPExplainer(model=MODEL, grid_size=8)
    LIME_EXPLAINER        = LIMEExplainer(model=MODEL, num_samples=40, num_features=8)
    COUNTERFACTUAL_EXPLAINER = CounterfactualExplainer(model=MODEL, class_mapping=CLASS_MAPPING)
    CONCEPT_EXPLAINER     = BotanicalConceptExplainer(model=MODEL)

    logger.info("All 7 XAI engines and research evaluation modules initialized successfully.")


@router.get("/health", response_model=HealthCheckResponse)
def health_check() -> dict[str, Any]:
    """Health check endpoint to verify backend service state."""
    return {
        "status": "healthy",
        "model_loaded": MODEL is not None,
    }


@router.get("/benchmarks", response_model=list[BenchmarkModelItem])
def get_model_benchmarks() -> list[dict[str, Any]]:
    """Returns comparative predictive benchmarks across 4 candidate deep learning architectures.

    Contrasts EfficientNet-B0 against ResNet-50, MobileNetV3-Large, and DenseNet-121
    across Accuracy, Parameters, Latency, GFLOPs, and XAI gradient quality.
    """
    project_root = Path(__file__).resolve().parent.parent
    benchmarks_file = project_root / "reports" / "model_benchmarks.json"

    if benchmarks_file.exists():
        with open(benchmarks_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return generate_benchmarking_report()


@router.get("/trustworthiness", response_model=TrustworthinessResponse)
def get_trustworthiness_audit() -> dict[str, Any]:
    """Returns trustworthiness, subgroup fairness, calibration, and spurious feature audits."""
    project_root = Path(__file__).resolve().parent.parent
    trust_file = project_root / "reports" / "trustworthiness_audit.json"

    if trust_file.exists():
        with open(trust_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return generate_trustworthiness_report()


@router.get("/xai-framework", response_model=XAIFrameworkResponse)
def get_xai_framework() -> dict[str, Any]:
    """Returns the complete 10-Dimension XAI Evaluation and Impact Framework report."""
    project_root = Path(__file__).resolve().parent.parent
    framework_file = project_root / "reports" / "xai_framework_evaluation.json"

    if not framework_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="XAI framework report not found. Run evaluation first.",
        )

    with open(framework_file, "r", encoding="utf-8") as f:
        return json.load(f)


async def _read_and_validate_image(file: UploadFile) -> Image.Image:
    """Validates content type and decodes an uploaded file into an RGB PIL Image."""
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File provided is not a valid image.",
        )
    try:
        contents = await file.read()
        return Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        logger.error("Failed to read image upload: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid image file.",
        ) from exc


def _classify(image: Image.Image) -> tuple[torch.Tensor, int, float, str, float]:
    """Preprocesses and classifies an image. Returns (input_tensor, pred_idx, confidence, class_name, preprocess_seconds)."""
    t_pre_0 = time.perf_counter()
    input_tensor = preprocess_image_for_inference(image).to(DEVICE)
    dur_pre = time.perf_counter() - t_pre_0

    with torch.no_grad():
        logits = MODEL(input_tensor)
        probs = torch.softmax(logits, dim=1)
        conf_val, pred_idx_tensor = torch.max(probs, dim=1)
        pred_idx = int(pred_idx_tensor.item())
        confidence = float(conf_val.item()) * 100.0

    raw_class_name = IDX_TO_CLASS.get(pred_idx, "Unknown_Class")
    return input_tensor, pred_idx, confidence, raw_class_name, dur_pre


@router.post("/predict/quick", response_model=QuickPredictionResponse)
async def predict_quick(file: UploadFile = File(...)) -> dict[str, Any]:
    """Uploads a leaf image and returns disease classification + one primary heatmap
    as fast as possible. The deeper XAI/research suite is fetched separately via
    ``/predict/report``, and the LLM clinical narrative via ``/predict/insight``.
    """
    t_pipe_start = time.perf_counter()

    if MODEL is None:
        load_model_and_metadata()

    image = await _read_and_validate_image(file)

    t_cls_0 = time.perf_counter()
    input_tensor, pred_idx, confidence, raw_class_name, dur_pre = _classify(image)
    dur_cls = time.perf_counter() - t_cls_0 - dur_pre

    primary_heatmap = GRAD_CAM_PP.generate_heatmap(input_tensor=input_tensor, target_class_idx=pred_idx)
    encoded = encode_all_heatmaps(original_image=image, heatmaps={"primary": primary_heatmap}, alpha=0.5)

    dur_total = time.perf_counter() - t_pipe_start
    timings = PipelineTimings(
        preprocessing_seconds=round(dur_pre, 3),
        classification_seconds=round(dur_cls, 3),
        total_seconds=round(dur_total, 3),
    )

    logger.info("Quick diagnosis executed in %.3fs (%s, %.1f%%)", dur_total, raw_class_name, confidence)

    return {
        "class_name": raw_class_name,
        "disease_title": clean_class_name(raw_class_name),
        "confidence": round(confidence, 2),
        "primary_heatmap_b64": encoded["primary"],
        "timings": timings,
    }


def _generate_gradient_group(
    input_tensor: torch.Tensor, image: Image.Image, pred_idx: int
) -> tuple[dict[str, Any], dict[str, float | None], Any, Any]:
    """Runs the sequential gradient/hook-based XAI engines and research metrics.

    These share hooked state and backward passes on the singleton MODEL
    (Grad-CAM/Grad-CAM++ hooks, MC-Dropout's train()/eval() toggling), so they
    must never run concurrently with each other or with anything else touching
    the model. Returns (heatmaps, durations, quality_res, uncertainty_res).
    """
    heatmaps: dict[str, Any] = {}
    durations: dict[str, float | None] = {}

    t0 = time.perf_counter()
    heatmaps["gradcam"] = GRAD_CAM.generate_heatmap(input_tensor=input_tensor, target_class_idx=pred_idx)
    durations["gradcam"] = time.perf_counter() - t0

    t0 = time.perf_counter()
    heatmaps["gradcam_pp"] = GRAD_CAM_PP.generate_heatmap(input_tensor=input_tensor, target_class_idx=pred_idx)
    durations["gradcam_pp"] = time.perf_counter() - t0

    t0 = time.perf_counter()
    heatmaps["saliency"] = SALIENCY_EXPLAINER.generate_heatmap(input_tensor=input_tensor, target_class_idx=pred_idx)
    durations["saliency"] = time.perf_counter() - t0

    t0 = time.perf_counter()
    heatmaps["smoothgrad"] = SMOOTH_GRAD_EXPLAINER.generate_heatmap(input_tensor=input_tensor, target_class_idx=pred_idx)
    durations["smoothgrad"] = time.perf_counter() - t0

    t0 = time.perf_counter()
    heatmaps["ig"] = IG_EXPLAINER.generate_heatmap(input_tensor=input_tensor, target_class_idx=pred_idx, steps=20)
    durations["ig"] = time.perf_counter() - t0

    primary_heatmap = heatmaps["gradcam_pp"] if heatmaps["gradcam_pp"] is not None else heatmaps["gradcam"]

    try:
        quality_res = evaluate_all_explanation_metrics(
            model=MODEL,
            input_tensor=input_tensor,
            original_image=image,
            heatmap=primary_heatmap,
            target_class_idx=pred_idx,
            explain_fn=lambda t, c: GRAD_CAM_PP.generate_heatmap(t, c),
            preprocess_fn=preprocess_image_for_inference,
            additional_heatmaps={
                "gradcam": heatmaps["gradcam"],
                "ig": heatmaps["ig"],
                "saliency": heatmaps["saliency"],
            },
        )
    except Exception as exc:
        logger.warning("Explanation quality evaluation notice: %s", exc)
        quality_res = None

    try:
        uncertainty_res = compute_mc_dropout_uncertainty(model=MODEL, input_tensor=input_tensor, num_passes=5)
    except Exception as exc:
        logger.warning("MC-Dropout uncertainty notice: %s", exc)
        uncertainty_res = None

    return heatmaps, durations, quality_res, uncertainty_res


@router.post("/predict/report", response_model=ReportResponse)
async def predict_report(file: UploadFile = File(...)) -> dict[str, Any]:
    """Uploads a leaf image and returns the full XAI attribution suite (Grad-CAM,
    Grad-CAM++, Saliency, SmoothGrad, Integrated Gradients, SHAP, LIME), decision
    support, counterfactual analysis, botanical concepts, quality metrics, and
    MC-Dropout uncertainty. Re-runs classification internally (cheap, ~10ms) so
    this endpoint is stateless and independent of ``/predict/quick``.
    """
    t_pipe_start = time.perf_counter()

    if MODEL is None:
        load_model_and_metadata()

    image = await _read_and_validate_image(file)
    input_tensor, pred_idx, confidence, raw_class_name, dur_pre = _classify(image)
    loop = asyncio.get_running_loop()

    # ── Sequential gradient/hook group (must not run concurrently with itself
    # or with anything else touching the shared MODEL's grad/train state) ─────
    t_grad0 = time.perf_counter()
    heatmaps, grad_durations, quality_res, uncertainty_res = await loop.run_in_executor(
        None, _generate_gradient_group, input_tensor, image, pred_idx
    )
    dur_grad_wall = time.perf_counter() - t_grad0
    primary_heatmap = heatmaps["gradcam_pp"] if heatmaps["gradcam_pp"] is not None else heatmaps["gradcam"]

    # ── Parallel group: no_grad-only, model-mode-stable, safe to run concurrently ──
    def _run_shap() -> Any:
        return SHAP_EXPLAINER.generate_heatmap(input_tensor=input_tensor, target_class_idx=pred_idx)

    def _run_lime() -> Any:
        try:
            return LIME_EXPLAINER.generate_heatmap(
                input_tensor=input_tensor, target_class_idx=pred_idx, original_image=image
            )
        except Exception as exc:
            logger.warning("LIME attribution skipped: %s", exc)
            return None

    def _run_counterfactual() -> Any:
        try:
            return COUNTERFACTUAL_EXPLAINER.generate_counterfactual(
                original_image=image,
                heatmap=primary_heatmap,
                target_class_idx=pred_idx,
                preprocess_fn=preprocess_image_for_inference,
            )
        except Exception as exc:
            logger.warning("Counterfactual generation notice: %s", exc)
            return None

    def _run_concepts() -> Any:
        try:
            return CONCEPT_EXPLAINER.extract_concept_activations(
                original_image=image, heatmap=primary_heatmap, class_name=raw_class_name
            )
        except Exception as exc:
            logger.warning("Concept activation notice: %s", exc)
            return None

    def _run_decision_support() -> Any:
        return generate_decision_support_summary(
            original_image=image, heatmap=primary_heatmap, class_name=raw_class_name, confidence=confidence
        )

    def _timed(fn: Any) -> tuple[Any, float]:
        t0 = time.perf_counter()
        result = fn()
        return result, time.perf_counter() - t0

    t_par0 = time.perf_counter()
    (shap_heatmap, dur_shap), (lime_heatmap, dur_lime), (cf_res, _), (concepts_res, _), (decision_support_res, _) = (
        await asyncio.gather(
            loop.run_in_executor(None, _timed, _run_shap),
            loop.run_in_executor(None, _timed, _run_lime),
            loop.run_in_executor(None, _timed, _run_counterfactual),
            loop.run_in_executor(None, _timed, _run_concepts),
            loop.run_in_executor(None, _timed, _run_decision_support),
        )
    )
    dur_par_wall = time.perf_counter() - t_par0
    heatmaps["shap"] = shap_heatmap
    heatmaps["lime"] = lime_heatmap

    encoded = encode_all_heatmaps(original_image=image, heatmaps=heatmaps, alpha=0.5)

    dur_total = time.perf_counter() - t_pipe_start
    timings = PipelineTimings(
        preprocessing_seconds=round(dur_pre, 3),
        classification_seconds=round(0.0, 3),
        gradcam_seconds=round(grad_durations["gradcam"], 3),
        gradcam_pp_seconds=round(grad_durations["gradcam_pp"], 3),
        saliency_seconds=round(grad_durations["saliency"], 3),
        smoothgrad_seconds=round(grad_durations["smoothgrad"], 3),
        ig_seconds=round(grad_durations["ig"], 3),
        shap_seconds=round(dur_shap, 3),
        lime_seconds=round(dur_lime, 3) if lime_heatmap is not None else None,
        xai_wall_seconds=round(dur_grad_wall + dur_par_wall, 3),
        total_seconds=round(dur_total, 3),
    )

    logger.info(
        "Full research report executed in %.3fs (gradient-group=%.3fs, parallel-group=%.3fs)",
        dur_total, dur_grad_wall, dur_par_wall,
    )

    return {
        "class_name": raw_class_name,
        "confidence": round(confidence, 2),
        "gradcam_heatmap_b64": encoded["gradcam"],
        "gradcam_pp_heatmap_b64": encoded.get("gradcam_pp"),
        "saliency_heatmap_b64": encoded.get("saliency"),
        "smoothgrad_heatmap_b64": encoded.get("smoothgrad"),
        "ig_heatmap_b64": encoded.get("ig"),
        "shap_heatmap_b64": encoded.get("shap"),
        "lime_heatmap_b64": encoded.get("lime"),
        "timings": timings,
        "decision_support": decision_support_res,
        "counterfactual": cf_res,
        "botanical_concepts": concepts_res,
        "explanation_quality": quality_res,
        "uncertainty": uncertainty_res,
    }


@router.post("/predict/insight", response_model=InsightResponse)
async def predict_insight(payload: InsightRequest) -> dict[str, Any]:
    """Returns the Groq LLM-authored clinical narrative for an already-classified
    disease. Takes no image — only ``class_name``/``confidence`` from
    ``/predict/quick`` — and offloads the blocking Groq SDK call to a worker
    thread so it never stalls the FastAPI event loop.
    """
    t_groq0 = time.perf_counter()
    llm_insights = await asyncio.to_thread(
        get_disease_explanation,
        class_name=payload.class_name,
        confidence=payload.confidence,
    )
    dur_groq = time.perf_counter() - t_groq0

    return {
        "disease_title": llm_insights["disease_title"],
        "explanation": llm_insights["explanation"],
        "xai_feature_explanation": llm_insights["xai_feature_explanation"],
        "cure": llm_insights["cure"],
        "prevention": llm_insights["prevention"],
        "precautions": llm_insights["precautions"],
        "groq_seconds": round(dur_groq, 3),
    }


@router.post("/explain-xai", response_model=XAIExplanationResponse)
async def explain_xai_method(payload: XAIExplanationRequest) -> dict[str, str]:
    """Generates an on-demand, method-tailored Groq LLM explanation for a specific XAI technique."""
    return await asyncio.to_thread(
        get_xai_specific_explanation,
        class_name=payload.class_name,
        confidence=payload.confidence,
        xai_method=payload.xai_method,
    )


@router.get("/sample-specimens")
def list_sample_specimens() -> list[dict[str, str]]:
    """Returns metadata for available verified evaluation leaf specimens."""
    return [
        {"id": "potato_early_blight", "name": "Potato Early Blight", "crop": "Potato", "tag": "Fungal Alternaria"},
        {"id": "tomato_early_blight", "name": "Tomato Early Blight", "crop": "Tomato", "tag": "Target-Spot Lesion"},
        {"id": "tomato_leaf_specimen", "name": "Tomato Target Spot", "crop": "Tomato", "tag": "Canopy Chlorosis"},
    ]


@router.get("/sample-image/{sample_id}")
def get_sample_image(sample_id: str):
    """Returns the verified test leaf image file."""
    project_root = Path(__file__).resolve().parent.parent
    mapping = {
        "potato_early_blight": project_root / "Test_Images" / "Test_Image2.png",
        "tomato_early_blight": project_root / "Test_Images" / "Test_Image 1",
        "tomato_leaf_specimen": project_root / "Test_Images" / "Test_Image3.png",
        "scratch_leaf": project_root / "scratch_leaf.jpg",
    }
    file_path = mapping.get(sample_id)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Specimen image not found.")
    return FileResponse(file_path, media_type="image/jpeg")
