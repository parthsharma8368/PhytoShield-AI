/* Shared types for the Analyze workspace, mirroring api/schemas.py's 3-stage
 * prediction response shapes (QuickPredictionResponse, ReportResponse, InsightResponse). */

export interface PipelineTimings {
  preprocessing_seconds: number;
  classification_seconds: number;
  gradcam_seconds?: number | null;
  gradcam_pp_seconds?: number | null;
  saliency_seconds?: number | null;
  smoothgrad_seconds?: number | null;
  ig_seconds?: number | null;
  shap_seconds?: number | null;
  lime_seconds?: number | null;
  xai_wall_seconds?: number | null;
  groq_seconds?: number | null;
  total_seconds: number;
}

export interface QuickResult {
  class_name: string;
  disease_title: string;
  confidence: number;
  primary_heatmap_b64: string;
  timings: PipelineTimings;
}

export interface DecisionStaging {
  stage_level: number;
  stage_name: string;
  severity_tag: string;
  color: string;
  urgency: string;
  prognosis: string;
}

export interface DecisionSupportItem {
  affected_leaf_percentage: number | null;
  staging: DecisionStaging;
  validation_checklist: Array<{
    id: string;
    title: string;
    description: string;
    verified: boolean;
  }>;
  triage_actions: string[];
  decision_impact_summary: string;
}

export interface FaithfulnessMetrics {
  deletion_auc: number;
  insertion_auc: number;
  faithfulness_score: number;
  random_baseline_score?: number;
}

export interface SparsityMetrics {
  gini_index: number;
  entropy_sparsity: number;
  sparsity_score: number;
}

export interface ExplanationQualityMetrics {
  faithfulness?: FaithfulnessMetrics;
  stability_score?: number;
  consistency?: Record<string, number>;
  robustness_score?: number;
  sparsity?: SparsityMetrics;
  localization_score?: number;
  composite_xai_quality?: number;
}

export interface CounterfactualData {
  counterfactual_image_b64: string;
  difference_map_b64: string;
  original_disease_confidence: number;
  counterfactual_disease_confidence: number;
  confidence_drop: number;
  healthy_confidence_gain: number;
  counterfactual_predicted_class: string;
  lesion_surface_percentage: number;
  narrative_explanation: string;
}

export interface BotanicalConceptItem {
  concept_id: string;
  name: string;
  score: number;
  clinical_relevance: string;
  pathology_significance: string;
}

export interface BotanicalConceptsResponse {
  concepts: BotanicalConceptItem[];
  dominant_concept: string;
  dominant_score: number;
  botanical_reasoning_summary: string;
}

export interface UncertaintyData {
  mean_confidence?: number;
  epistemic_std?: number;
  predictive_entropy?: number;
  uncertainty_score?: number;
  trust_tier?: string;
}

export interface ReportResult {
  class_name: string;
  confidence: number;
  gradcam_heatmap_b64: string;
  gradcam_pp_heatmap_b64: string | null;
  saliency_heatmap_b64: string | null;
  smoothgrad_heatmap_b64: string | null;
  ig_heatmap_b64: string | null;
  shap_heatmap_b64: string | null;
  lime_heatmap_b64: string | null;
  timings: PipelineTimings;
  decision_support?: DecisionSupportItem;
  explanation_quality?: ExplanationQualityMetrics;
  counterfactual?: CounterfactualData;
  botanical_concepts?: BotanicalConceptsResponse;
  uncertainty?: UncertaintyData;
}

export interface InsightResult {
  disease_title: string;
  explanation: string;
  xai_feature_explanation: string;
  cure: string;
  prevention: string;
  precautions: string;
  signs?: string;
  source?: 'groq' | 'unavailable';
  groq_seconds: number;
}

export type XAIMethodKey = 'gradcam_pp' | 'gradcam' | 'saliency' | 'smoothgrad' | 'ig' | 'shap' | 'lime';
export type ClinicalTab = 'pathology' | 'treatment' | 'prevention' | 'precautions';
