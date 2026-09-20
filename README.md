# 🌿 PhytoShield AI — Explainable Plant Disease Detection System

[![Python 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React + Vite](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://vitejs.dev/)
[![PyTorch](https://img.shields.io/badge/ML%20Framework-PyTorch-EE4C2C.svg)](https://pytorch.org/)
[![Accuracy](https://img.shields.io/badge/Test%20Accuracy-99.48%25-00b87c.svg)](#metrics)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**PhytoShield AI** is a research-grade, production-ready Explainable AI (XAI) Plant Pathology Intelligence System. It identifies crop diseases from leaf photography with **99.48% accuracy** across 15 agricultural classes, providing multi-modal visual attribution heatmaps (**Grad-CAM**, **Grad-CAM++**, **Integrated Gradients**, **SHAP**, **LIME**, **SmoothGrad**, **Saliency**), **Counterfactual Foliar Perturbation**, and **Botanical Concept Bottlenecks (CBM)** alongside **Groq LLM** visual feature explanations.

---

## 🌟 Key Features & Research Framework

### 1. Instant Diagnosis, Progressive Research Report
- Prediction is split into three independent endpoints — `POST /api/predict/quick` (classification + primary heatmap, typically well under a second), `POST /api/predict/report` (full 7-engine XAI suite + research extensions), and `POST /api/predict/insight` (Groq LLM clinical narrative) — so the diagnosis renders immediately while the deeper explainability report loads in behind it.
- SHAP occlusion runs as a single batched forward pass instead of one pass per grid patch; independent XAI engines (SHAP, LIME, counterfactual, botanical concepts, decision support) execute concurrently via `asyncio.gather`; the Groq LLM call is offloaded to a worker thread so it never blocks the API for other requests.

### 2. Multi-Model Architecture Benchmarking
- Multi-model factory and comparative framework across **EfficientNet-B0** (Production Backbone, 99.48% Test Accuracy), and candidate architectures **ResNet-50**, **MobileNetV3-Large**, and **DenseNet-121**.
- Live empirical audit: Real parameter counts, model disk sizes, FLOPs, and live measured device latency (MPS / CUDA / CPU) via PyTorch.
- Automated training pipeline (`training/train_benchmarks.py`) to train and evaluate any candidate architecture on the real dataset splits.

### 3. Multi-Engine & Multi-Modality XAI Suite
- **Pixel & Feature Attributions**: Grad-CAM, Grad-CAM++, Integrated Gradients, SHAP Occlusion, LIME Superpixel, SmoothGrad, Saliency.
- **Counterfactual Explanations**: In-painted foliar lesion neutralization engine simulating disease removal, measuring causal confidence reduction ($\Delta P$) and lesion attribution causality.
- **Botanical Concept Bottleneck Model (CBM)**: Concept scores for *Chlorosis*, *Foliar Necrosis*, *Concentric Target Rings*, *Mold/Sporulation*, and *Healthy Foliage*.

### 4. Quantitative Explanation Quality Metrics
- **Faithfulness**: Pixel Deletion & Insertion Area Under Curve (AUC).
- **Stability**: Lipschitz continuity bound under subtle input perturbations.
- **Consistency**: Cross-method Spearman rank correlation across attribution engines.
- **Robustness**: Photometric SSIM structural invariance under lighting shifts.
- **Sparsity**: Gini coefficient & Shannon entropy concentration.
- **Localization**: Pointing Game foliar energy ratio within biological leaf tissue.

### 5. Trustworthy AI Behavior Audits
- **Subgroup Fairness**: Computed directly from 6,203 real test samples (Pepper: 100.0%, Potato: 99.23%, Tomato: 99.44%; Disparate Impact Ratio = 0.9923).
- **Uncertainty Quantification**: Bayesian Monte Carlo Dropout separating epistemic vs aleatoric uncertainty.
- **Model Calibration & Drift**: Real Expected Calibration Error (ECE = 1.17%) across 10 confidence bins with reliability diagrams.
- **Adversarial Robustness Audit**: Empirical Fast Gradient Sign Method (FGSM $\epsilon=0.03$) evaluation across 300 test specimens (clean accuracy 99.33% $\to$ adversarial accuracy 10.33%, demonstrating the empirical necessity of XAI audits).
- **Spurious Feature Invariance**: Foreground-background ablation testing confirming 81.33% prediction invariance when non-leaf backgrounds are masked.

### 6. Agronomist Decision-Support Value
- **Foliar Lesion Staging**: Surface area affected % with 3-stage clinical severity grading (Mild <10%, Moderate 10-25%, Severe >25%).
- **Agronomist Validation Checklist**: Interactive 4-point verification checklist for field agronomists.
- **Precision Triage Protocols**: Prioritized agricultural interventions (Containment, Targeted Fungicide, Microclimate Control).

### 7. The 10-Dimension XAI Evaluation Framework
- Standardized academic assessment across: Predictive Performance, Interpretability, Faithfulness, Stability, Robustness, Fairness, Confidence, Actionability, Human Usefulness, and Domain Impact.

---

## 📁 Repository Structure

```
PhytoShield-AI/
├── api/                    # FastAPI routes, schemas & REST endpoints
├── app/                    # Main FastAPI app & Groq LLM explainer service
├── data/                   # Data loader, splits, and class mappings
├── evaluation/             # Model benchmarks, trustworthiness audits & decision support
│   ├── model_benchmarks.py
│   ├── trustworthiness.py
│   └── decision_support.py
├── explainability/         # 7 XAI engines, metrics, counterfactual & concept explainers
│   ├── grad_cam.py
│   ├── grad_cam_plus_plus.py
│   ├── integrated_gradients.py
│   ├── shap_explainer.py
│   ├── lime_explainer.py
│   ├── saliency.py
│   ├── metrics.py
│   ├── counterfactual.py
│   └── concept_explainer.py
├── frontend/               # React + Vite TypeScript SaaS web app
│   ├── src/
│   │   ├── pages/ (Home.tsx, Analyze.tsx, Benchmarks.tsx, Telemetry.tsx)
│   │   ├── components/analyze/ (extracted Analyze workspace components)
│   │   ├── App.tsx
│   │   └── index.css
│   └── vite.config.ts
├── models/                 # Model architectures (EfficientNet-B0) & weights
├── reports/                # Serialized benchmark, trustworthiness & XAI framework matrices
└── tests/                  # Automated integration & unit test suite
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- Groq API Key (Optional for LLM explanations, fallback knowledge base built-in)

### 1. Backend Setup

```bash
# Clone repository
git clone https://github.com/parthsharma8368/PhytoShield-AI.git
cd PhytoShield-AI

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Backend will run at `http://localhost:8001`. Swagger API docs available at `http://localhost:8001/docs`.

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install node dependencies
npm install

# Start Vite dev server
npm run dev
```

Frontend will run at `http://localhost:5174`.

---

## 📊 Model & Benchmark Metrics

| Metric | Score |
| :--- | :--- |
| **Test Accuracy** | **99.48%** |
| **Parameters** | **5.3 Million** |
| **Input Shape** | `224 × 224 × 3` |
| **Inference Latency** | `< 45ms` (MPS / GPU) |
| **Supported Classes** | **15 Plant Pathology Classes** |

---

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
GROQ_API_KEY=your_groq_api_key_here
PORT=8001
HOST=0.0.0.0
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
