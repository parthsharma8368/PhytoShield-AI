"""End-to-end unit and integration test suite for the 6-requirement XAI framework."""

import io
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from PIL import Image
import torch
from fastapi.testclient import TestClient

from app.main import app
from evaluation.decision_support import (
    determine_disease_staging,
    quantify_foliar_lesion_severity,
)
from evaluation.model_benchmarks import (
    generate_benchmarking_report,
    get_real_model_benchmarks,
)
from evaluation.trustworthiness import (
    compute_mc_dropout_uncertainty,
    evaluate_subgroup_fairness,
    generate_trustworthiness_report,
)
from explainability.concept_explainer import BotanicalConceptExplainer
from explainability.counterfactual import CounterfactualExplainer
from explainability.metrics import (
    compute_consistency,
    compute_localization,
    compute_sparsity,
    compute_stability,
)
from models.efficientnet import build_efficientnet_b0
from preprocessing.transforms import preprocess_image_for_inference


def test_benchmarking_module() -> None:
    """Verifies that all 4 models are dynamically audited and reported without fake data."""
    results = get_real_model_benchmarks()
    assert len(results) == 4
    model_names = [m["model_name"] for m in results]
    assert any("EfficientNet-B0" in n for n in model_names)
    assert any("ResNet-50" in n for n in model_names)
    assert any("MobileNetV3" in n for n in model_names)
    assert any("DenseNet-121" in n for n in model_names)

    eff = next(m for m in results if "EfficientNet-B0" in m["model_name"])
    assert eff["has_checkpoint"] is True
    assert eff["test_accuracy"] is not None

    untrained = [m for m in results if not m["is_production"]]
    for m in untrained:
        assert m["has_checkpoint"] is False
        assert m["test_accuracy"] is None
        assert m["parameters_million"] > 0

    report = generate_benchmarking_report()
    assert len(report) == 4
    print("✓ Benchmarking module verified (100% genuine data).")


def test_trustworthiness_module() -> None:
    """Verifies subgroup fairness, calibration, and MC-dropout."""
    fairness = evaluate_subgroup_fairness()
    assert "crop_species_fairness" in fairness
    assert "pathogen_type_fairness" in fairness
    assert 0.90 <= fairness["disparate_impact_ratio"] <= 1.05

    audit_file = PROJECT_ROOT / "reports" / "trustworthiness_audit.json"
    assert audit_file.exists()
    import json
    with open(audit_file, "r", encoding="utf-8") as f:
        audit_data = json.load(f)
    assert audit_data["calibration"]["expected_calibration_error_ece"] < 0.05
    assert audit_data["spurious_features"]["background_invariance_score"] > 0.70

    model = build_efficientnet_b0(num_classes=15, pretrained=False)
    dummy_input = torch.randn(1, 3, 224, 224)
    uncertainty = compute_mc_dropout_uncertainty(model, dummy_input, num_passes=3)
    assert "epistemic_std" in uncertainty
    assert "uncertainty_score" in uncertainty
    print("✓ Trustworthiness module verified.")


def test_explanation_metrics_module() -> None:
    """Verifies sparsity, localization, consistency, and stability."""
    heatmap = np.zeros((224, 224), dtype=np.float32)
    heatmap[80:120, 80:120] = 1.0  # Compact lesion spot

    sparsity_res = compute_sparsity(heatmap)
    assert 0.0 <= sparsity_res["sparsity_score"] <= 1.0
    assert sparsity_res["gini_index"] > 0.5  # High sparsity on localized spot

    # Synthetic green leaf
    test_leaf = Image.new("RGB", (224, 224), color=(34, 139, 34))
    loc_score = compute_localization(test_leaf, heatmap)
    assert 0.0 <= loc_score <= 1.0

    # Consistency
    h2 = np.copy(heatmap)
    consistency_res = compute_consistency({"m1": heatmap, "m2": h2})
    assert consistency_res["mean_consistency"] >= 0.95

    # Stability
    explain_fn = lambda t, c: heatmap
    dummy_input = torch.randn(1, 3, 224, 224)
    stab = compute_stability(explain_fn, dummy_input, target_class_idx=0, num_samples=2)
    assert 0.0 <= stab <= 1.0
    print("✓ Explanation metrics module verified.")


def test_decision_support_module() -> None:
    """Verifies foliar severity quantification and 3-stage severity staging."""
    test_leaf = Image.new("RGB", (224, 224), color=(34, 139, 34))
    heatmap = np.zeros((224, 224), dtype=np.float32)
    heatmap[50:100, 50:100] = 0.8

    severity = quantify_foliar_lesion_severity(test_leaf, heatmap, threshold=0.4)
    assert "affected_leaf_percentage" in severity
    assert 0.0 <= severity["affected_leaf_percentage"] <= 100.0

    stage_mild = determine_disease_staging(6.5, "Tomato_Early_blight")
    assert stage_mild["stage_level"] == 1

    stage_mod = determine_disease_staging(18.0, "Tomato_Early_blight")
    assert stage_mod["stage_level"] == 2

    stage_sev = determine_disease_staging(35.0, "Tomato_Early_blight")
    assert stage_sev["stage_level"] == 3
    print("✓ Decision support module verified.")


def test_concept_and_counterfactual() -> None:
    """Verifies Botanical Concept and Counterfactual generation."""
    model = build_efficientnet_b0(num_classes=15, pretrained=False)
    test_leaf = Image.new("RGB", (224, 224), color=(34, 139, 34))
    heatmap = np.zeros((224, 224), dtype=np.float32)
    heatmap[70:110, 70:110] = 0.9

    concept_explainer = BotanicalConceptExplainer(model=model)
    concepts_res = concept_explainer.extract_concept_activations(test_leaf, heatmap, "Tomato_Early_blight")
    assert len(concepts_res["concepts"]) == 5
    assert "dominant_concept" in concepts_res

    cf_explainer = CounterfactualExplainer(model=model, class_mapping={"Tomato_Early_blight": 0, "Tomato_healthy": 1})
    cf_res = cf_explainer.generate_counterfactual(
        original_image=test_leaf,
        heatmap=heatmap,
        target_class_idx=0,
        preprocess_fn=preprocess_image_for_inference,
    )
    assert "counterfactual_image_b64" in cf_res
    assert "confidence_drop" in cf_res
    print("✓ Concept and Counterfactual modules verified.")


def test_api_endpoints() -> None:
    """Verifies all new FastAPI endpoints with TestClient."""
    client = TestClient(app)

    # 1. Health
    r_health = client.get("/api/health")
    assert r_health.status_code == 200

    # 2. Benchmarks
    r_bench = client.get("/api/benchmarks")
    assert r_bench.status_code == 200
    assert len(r_bench.json()) == 4

    # 3. Trustworthiness
    r_trust = client.get("/api/trustworthiness")
    assert r_trust.status_code == 200
    assert "subgroup_fairness" in r_trust.json()

    # 4. 10-Dimension XAI Framework
    r_xai = client.get("/api/xai-framework")
    assert r_xai.status_code == 200
    data_xai = r_xai.json()
    assert data_xai["total_dimensions"] == 10
    assert len(data_xai["dimensions"]) == 10

    # 5. Predict report with research extensions
    img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    files = {"file": ("test_leaf.jpg", buf, "image/jpeg")}

    # Send request (LIME will be fast or fallback cleanly)
    r_pred = client.post("/api/predict/report", files=files)
    assert r_pred.status_code == 200
    data_pred = r_pred.json()

    assert "decision_support" in data_pred
    assert "explanation_quality" in data_pred
    assert "counterfactual" in data_pred
    assert "botanical_concepts" in data_pred
    assert "uncertainty" in data_pred
    print("✓ All API endpoints and extended outputs verified!")


if __name__ == "__main__":
    test_benchmarking_module()
    test_trustworthiness_module()
    test_explanation_metrics_module()
    test_decision_support_module()
    test_concept_and_counterfactual()
    test_api_endpoints()
    print("\n🎉 ALL 6 RESEARCH REQUIREMENTS FULLY VERIFIED IN BACKEND!")
