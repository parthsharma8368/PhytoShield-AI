"""API Pydantic Schemas for Explainable AI Plant Disease Detection.

Defines input/output data validation schemas for FastAPI endpoints including:
    - Prediction with 7-method XAI heatmaps
    - Explanation Quality Metrics (Faithfulness, Stability, Robustness, Sparsity, Localization)
    - Counterfactual & Botanical Concept Attributions
    - Clinical Decision Support & Foliar Severity Staging
    - Multi-Model Predictive Benchmarking
    - Subgroup Fairness & Trustworthiness Safety Audit
    - 10-Dimension XAI Evaluation Framework
"""

from typing import Any
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    """API Health Check response schema."""
    status: str = Field(..., json_schema_extra={"example": "healthy"})
    model_loaded: bool = Field(..., json_schema_extra={"example": True})


class PipelineTimings(BaseModel):
    """Monotonic high-resolution execution duration measurements (in seconds) for a single pipeline stage."""
    preprocessing_seconds: float = Field(..., description="Image preprocessing and normalization time in seconds")
    classification_seconds: float = Field(..., description="EfficientNet-B0 forward pass inference time in seconds")
    gradcam_seconds: float | None = Field(None, description="Grad-CAM convolutional activation map generation time in seconds")
    gradcam_pp_seconds: float | None = Field(None, description="Grad-CAM++ higher-order gradient map generation time in seconds")
    saliency_seconds: float | None = Field(None, description="Vanilla Saliency pixel gradient computation time in seconds")
    smoothgrad_seconds: float | None = Field(None, description="SmoothGrad noise-averaged saliency computation time in seconds")
    ig_seconds: float | None = Field(None, description="Integrated Gradients 20-step path calculation time in seconds")
    shap_seconds: float | None = Field(None, description="SHAP 8x8 patch occlusion sensitivity computation time in seconds")
    lime_seconds: float | None = Field(None, description="LIME SLIC superpixel surrogate model fitting time in seconds")
    xai_wall_seconds: float | None = Field(None, description="Total wall-clock duration for all XAI attribution engines")
    groq_seconds: float | None = Field(None, description="Groq LLM clinical interpretation API time in seconds")
    total_seconds: float = Field(..., description="Total end-to-end duration of this pipeline stage in seconds")


class FaithfulnessMetrics(BaseModel):
    """Faithfulness evaluation metrics."""
    deletion_auc: float
    insertion_auc: float
    faithfulness_score: float


class SparsityMetrics(BaseModel):
    """Sparsity and compactness metrics."""
    gini_index: float
    entropy_sparsity: float
    sparsity_score: float


class ExplanationQualityResponse(BaseModel):
    """Evaluation metrics quantifying explanation faithfulness, stability, and robustness."""
    faithfulness: FaithfulnessMetrics
    stability_score: float = Field(..., description="Lipschitz stability score under input noise (0 to 1)")
    consistency: dict[str, float] = Field(..., description="Cross-method Spearman rank correlation matrix")
    robustness_score: float = Field(..., description="SSIM retention under photometric variation (0 to 1)")
    sparsity: SparsityMetrics
    localization_score: float = Field(..., description="Pointing game foliar energy ratio (0 to 1)")
    composite_xai_quality: float = Field(..., description="Overall weighted XAI quality score (0 to 1)")


class CounterfactualResponse(BaseModel):
    """Counterfactual visual reasoning and minimal perturbation metrics."""
    counterfactual_image_b64: str
    difference_map_b64: str
    original_disease_confidence: float
    counterfactual_disease_confidence: float
    confidence_drop: float
    healthy_confidence_gain: float
    counterfactual_predicted_class: str
    lesion_surface_percentage: float
    narrative_explanation: str


class BotanicalConceptItem(BaseModel):
    """Single botanical pathology concept attribution score."""
    concept_id: str
    name: str
    score: float
    clinical_relevance: str
    pathology_significance: str


class BotanicalConceptsResponse(BaseModel):
    """Botanical Concept Bottleneck Model (CBM) reasoning breakdown."""
    concepts: list[BotanicalConceptItem]
    dominant_concept: str
    dominant_score: float
    botanical_reasoning_summary: str


class DecisionStaging(BaseModel):
    """Clinical severity staging information."""
    stage_level: int
    stage_name: str
    severity_tag: str
    color: str
    urgency: str
    prognosis: str


class DecisionSupportResponse(BaseModel):
    """Actionable agronomic decision-support response schema."""
    affected_leaf_percentage: float
    staging: DecisionStaging
    validation_checklist: list[dict[str, Any]]
    triage_actions: list[str]
    decision_impact_summary: str


class QuickPredictionResponse(BaseModel):
    """Fast-path prediction: classification + primary heatmap only.

    Returned by ``POST /api/predict/quick`` in well under a second so the
    diagnosis can render immediately, ahead of the deeper research report.
    """
    class_name: str = Field(..., description="Raw model predicted category name")
    disease_title: str = Field(..., description="Clean human-readable disease title (deterministic, no LLM)")
    confidence: float = Field(..., description="Prediction confidence score percentage (0-100)")
    primary_heatmap_b64: str = Field(..., description="Base64 Grad-CAM++ (or Grad-CAM fallback) heatmap overlay")
    timings: PipelineTimings = Field(..., description="Real measured high-resolution execution durations")


class ReportResponse(BaseModel):
    """Full XAI attribution suite + research-grade analysis response schema.

    Returned by ``POST /api/predict/report``. All heatmap fields are
    base64-encoded PNG data URLs that can be rendered directly in an
    ``<img>`` tag: ``src={heatmap_b64}``. Carries no LLM-authored text —
    see ``InsightResponse`` for the narrative clinical explanation.
    """
    class_name: str = Field(..., description="Raw model predicted category name")
    confidence: float = Field(..., description="Prediction confidence score percentage (0-100)")

    # ── Heatmaps (Base64 PNGs) ────────────────────────────────────────────────
    gradcam_heatmap_b64: str = Field(..., description="Base64 Grad-CAM heatmap overlay")
    gradcam_pp_heatmap_b64: str | None = Field(None, description="Base64 Grad-CAM++ heatmap overlay")
    saliency_heatmap_b64: str | None = Field(None, description="Base64 Vanilla Saliency Map overlay")
    smoothgrad_heatmap_b64: str | None = Field(None, description="Base64 SmoothGrad heatmap overlay")
    ig_heatmap_b64: str | None = Field(None, description="Base64 Integrated Gradients overlay")
    shap_heatmap_b64: str | None = Field(None, description="Base64 SHAP occlusion heatmap overlay")
    lime_heatmap_b64: str | None = Field(None, description="Base64 LIME superpixel heatmap overlay")

    # ── High-Resolution Timings ───────────────────────────────────────────────
    timings: PipelineTimings = Field(..., description="Real measured high-resolution execution durations")

    # ── Research-Grade Extensions ──────────────────────────────────────────────
    decision_support: DecisionSupportResponse | None = Field(None, description="Clinical severity staging and farm triage")
    explanation_quality: ExplanationQualityResponse | None = Field(None, description="Faithfulness, stability, robustness metrics")
    counterfactual: CounterfactualResponse | None = Field(None, description="Counterfactual lesion perturbation analysis")
    botanical_concepts: BotanicalConceptsResponse | None = Field(None, description="Botanical concept activations (Chlorosis, Necrosis, etc.)")
    uncertainty: dict[str, Any] | None = Field(None, description="MC-Dropout epistemic uncertainty and confidence bounds")


class InsightResponse(BaseModel):
    """Groq LLM-authored clinical narrative, returned by ``POST /api/predict/insight``."""
    disease_title: str = Field(..., description="Clean human-readable disease title")
    explanation: str = Field(..., description="Detailed disease scientific explanation")
    xai_feature_explanation: str = Field(..., description="Groq LLM natural-language explanation of XAI visual features")
    cure: str = Field(..., description="Recommended organic and chemical treatments")
    prevention: str = Field(..., description="Long-term agricultural prevention strategies")
    precautions: str = Field(..., description="Immediate agricultural precautions")
    groq_seconds: float = Field(..., description="Groq LLM API call duration in seconds")


class InsightRequest(BaseModel):
    """Request schema for the Groq LLM clinical narrative stage."""
    class_name: str = Field(..., description="Raw model predicted category name")
    confidence: float = Field(..., description="Prediction confidence score percentage (0-100)")


class XAIExplanationRequest(BaseModel):
    """Request schema for on-demand method-specific XAI LLM explanation."""
    class_name: str = Field(..., description="Raw model predicted category name")
    confidence: float = Field(..., description="Prediction confidence score percentage (0-100)")
    xai_method: str = Field("gradcam", description="Target XAI technique to explain")


class XAIExplanationResponse(BaseModel):
    """Response schema for method-specific XAI LLM explanation."""
    xai_method: str = Field(..., description="Target XAI technique explained")
    heading: str = Field(..., description="Context-aware panel heading")
    method_label: str = Field(..., description="Human-friendly method title")
    explanation: str = Field(..., description="Contextual LLM explanation for this specific XAI method")


class BenchmarkModelItem(BaseModel):
    """Comparative metrics for a single benchmarked architecture."""
    model_name: str
    architecture_type: str
    is_production: bool
    training_status: str
    has_checkpoint: bool
    test_accuracy: float | None = None
    precision: float | None = None
    recall: float | None = None
    f1_score: float | None = None
    parameters_million: float
    model_size_mb: float | None = None
    gflops: float
    inference_latency_ms: float | None = None
    throughput_fps: float | None = None
    xai_compatibility: str
    device: str | None = None


class TrustworthinessResponse(BaseModel):
    """Subgroup fairness, calibration, and spurious feature audit response."""
    subgroup_fairness: dict[str, Any]
    calibration: dict[str, Any]
    spurious_features: dict[str, Any]
    adversarial_robustness: dict[str, Any]
    explanation_disagreement: dict[str, Any]


class XAIFrameworkDimension(BaseModel):
    """Single dimension of the 10-Dimension XAI Evaluation Framework."""
    dimension_id: str
    dimension_name: str
    guiding_question: str
    understanding: str
    our_work_score: float
    score_display: str
    quantitative_metrics: dict[str, Any]
    work_impact: str


class XAIFrameworkResponse(BaseModel):
    """Complete 10-Dimension XAI Evaluation Framework response schema."""
    framework_title: str
    project_name: str
    evaluated_model: str
    total_dimensions: int
    overall_framework_score: float
    dimensions: list[XAIFrameworkDimension]
