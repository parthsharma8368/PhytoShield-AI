import io
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient  # type: ignore
from PIL import Image  # type: ignore

from app.main import app

client = TestClient(app)


def test_health_check_endpoint() -> None:
    """Verifies /api/health endpoint returns 200 OK and valid status dict."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "model_loaded" in data


def _sample_leaf_bytes() -> bytes:
    img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_predict_quick_endpoint_valid_image() -> None:
    """Verifies /api/predict/quick returns a fast classification + primary heatmap."""
    files = {"file": ("test_leaf.jpg", _sample_leaf_bytes(), "image/jpeg")}
    response = client.post("/api/predict/quick", files=files)

    assert response.status_code == 200
    data = response.json()
    assert "class_name" in data
    assert "disease_title" in data
    assert "confidence" in data
    assert data["primary_heatmap_b64"].startswith("data:image/")
    assert data["timings"]["total_seconds"] >= 0


def test_predict_report_endpoint_valid_image() -> None:
    """Verifies /api/predict/report returns the full XAI + research suite."""
    files = {"file": ("test_leaf.jpg", _sample_leaf_bytes(), "image/jpeg")}
    response = client.post("/api/predict/report", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["gradcam_heatmap_b64"].startswith("data:image/")
    assert data["ig_heatmap_b64"] is not None
    assert data["shap_heatmap_b64"] is not None
    assert data["lime_heatmap_b64"] is not None
    assert data["decision_support"] is not None
    assert data["explanation_quality"] is not None
    assert data["uncertainty"] is not None


def test_predict_insight_endpoint() -> None:
    """Verifies /api/predict/insight returns the LLM clinical narrative from a class name alone."""
    response = client.post(
        "/api/predict/insight",
        json={"class_name": "Potato___Early_blight", "confidence": 87.5},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["disease_title"]
    assert data["explanation"]
    assert data["cure"]
    assert data["prevention"]
    assert data["precautions"]


if __name__ == "__main__":
    print("Running test_health_check_endpoint...")
    test_health_check_endpoint()
    print("Running test_predict_quick_endpoint_valid_image...")
    test_predict_quick_endpoint_valid_image()
    print("Running test_predict_report_endpoint_valid_image...")
    test_predict_report_endpoint_valid_image()
    print("Running test_predict_insight_endpoint...")
    test_predict_insight_endpoint()
    print("All API integration tests passed successfully!")

