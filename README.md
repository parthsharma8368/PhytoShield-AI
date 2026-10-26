# PhytoShield AI — Explainable Plant Disease Detection

[![Python 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React + Vite](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://vitejs.dev/)
[![PyTorch](https://img.shields.io/badge/ML%20Framework-PyTorch-EE4C2C.svg)](https://pytorch.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

PhytoShield AI looks at a photo of a leaf, names the disease (15 classes from the PlantVillage dataset) and shows **where on the leaf the model looked** and **whether that explanation can be trusted**. A fine-tuned EfficientNet-B0 makes the diagnosis, seven explanation methods draw heat-maps, and six quality metrics score those heat-maps.

All numbers below were measured on a **de-duplicated** test set of 3,107 images and can be regenerated with one command (see [Reproduce](#reproduce-every-number)).

> **Data-leakage note.** The original dataset folder held byte-identical copies of the same photos, and the first random split put the same file in both training and test sets, which produced an inflated 99.48 % accuracy. The splitter now removes identical files (MD5 content hash) before splitting, and `tests/test_dataset_integrity.py` fails if any file appears in two splits. Near-duplicates (different photos of the same leaf) are **not** detected, so real-world accuracy is likely lower than reported. The old artefacts are kept in `*/legacy_leaky_split/` for comparison.

---

## Results at a glance

| Item | Value | Source |
|---|---|---|
| Test images (unique) | 3,107 (train 14,430 / val 3,087) | `reports/study/dataset_audit.json` |
| Test accuracy | 98.13 % (58 mistakes) | `reports/study/base_model_results.json` |
| Macro precision / recall / F1 | 0.9765 / 0.9818 / 0.9790 | same |
| Calibration: ECE / MCE / Brier | 0.016 / 0.772 / 0.0294 | same |
| Mistake detection from confidence | AUROC 0.964 | `reports/study/table_error_detection.md` |
| Most common confusion | Target Spot → Spider mites (6), Late ↔ Early blight (5 + 4) | `base_model_results.json` |
| Model size | 4.03 M parameters, 0.39 GFLOPs | `reports/model_benchmarks.json` |

**Explanation quality** (stratified sample, 300 images; LIME 75; lower deletion AUC = more faithful; random baseline = 0.326):

| Method | Deletion AUC ↓ | Insertion AUC ↑ | Localization ↑ | Seconds / image |
|---|---|---|---|---|
| Grad-CAM | 0.207 | 0.360 | 0.723 | 0.06 |
| Grad-CAM++ | 0.209 | 0.373 | 0.795 | 0.05 |
| SHAP (occlusion) | 0.274 | 0.391 | 0.615 | 0.22 |
| SmoothGrad | 0.312 | 0.530 | 0.537 | 0.57 |
| LIME | 0.304 | 0.427 | 0.445 | 0.28 |
| Saliency | 0.318 | 0.434 | 0.459 | 0.05 |
| Integrated Gradients | 0.376 | 0.419 | 0.351 | 0.58 |

Grad-CAM, Grad-CAM++ and SHAP are significantly better than random (Wilcoxon p < 1e-7). **Integrated Gradients is worse than random on the deletion test** in this setup, and the three attribution families agree only weakly on their top-20 % regions. Full tables, curves and statistics: `reports/study/`.

**Robustness** (accuracy on the full test set after changing every image): brightness ×0.5 → 96.1 %, ×1.5 → 94.0 %, JPEG quality 15 → 87.8 %, 25 % occlusion → 86.9 %, background removed → 74.8 %. The model is **fragile to noise and blur**: Gaussian noise σ = 0.10 → 24.9 %, Gaussian blur radius 3 → 16.5 %.

---

## How it works

1. **Diagnosis in one step** — `POST /api/predict/quick` returns the label, confidence and the first heat-map almost immediately.
2. **Detail loads behind it** — `POST /api/predict/report` runs all seven explanation methods plus the extras; `POST /api/predict/insight` asks a Groq-hosted LLM (default `openai/gpt-oss-120b`, set `GROQ_MODEL` to change) for guidance written from this image's measured findings (needs a Groq key; there is no canned fallback text).
3. **Explanation methods** — Grad-CAM, Grad-CAM++, Saliency, SmoothGrad, Integrated Gradients, SHAP (occlusion) and LIME.
4. **Extras** — a counterfactual check (paint over the suspected lesion and re-run the model), rule-based concept scores (colour/texture rules for chlorosis, necrosis, rings, mould; heuristics, **not** a trained concept-bottleneck model) and Monte-Carlo-dropout uncertainty.
5. **Explanation quality metrics** — faithfulness (deletion/insertion), stability, consistency, robustness, sparsity, localization (`explainability/metrics.py`). The weights of the composite index are a design choice and have not been validated.
6. **Leaf damage** — the share of the leaf that is discoloured, measured from pixel colour inside a GrabCut leaf mask (`evaluation/decision_support.py`), not from the heatmap. `python -m experiments.validate_severity` checks it: healthy test leaves read a median 0.1 % (93 % below 5 %), and on healthy leaves with painted lesions of known area the mean error is 1.6 percentage points (r = 0.97, stage agreement 94 %). That test is synthetic; there are no expert lesion masks, so accuracy on real lesions is not measured.
7. **Confidence** is temperature-scaled (T = 0.778, fitted on the validation set, `python -m evaluation.calibration`): test ECE 0.016 → 0.0056 with accuracy unchanged.

Training: two-stage transfer learning (head only, then the last blocks), AdamW-style settings in `config/config.py`, seed 42, stratified 70/15/15 split, early stopping.

---

## Reproduce every number

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m pytest tests/test_dataset_integrity.py     # confirms train/val/test share no file
python training/train_main.py                        # ~45 min on Apple-silicon MPS
bash experiments/run_all.sh                          # ~40 min: base eval, XAI study, perturbations,
                                                     #   failure cases, figures, fact sheet, website numbers
```

Outputs land in `reports/study/` (tables, figures, JSON/CSV) and `report_kit/fact_sheet.md`. The website reads its numbers from `frontend/src/generated/metrics.ts`, which `experiments/export_frontend_metrics.py` writes from those results, so nothing on the site is typed by hand.

Human-expert evaluation: `reports/study/expert_packet/` contains 16 blinded cases and a rating form. **Results are pending** until an expert fills in `expert_form.csv`; then run `python -m experiments.analyze_expert_feedback`.

---

## Run the app

```bash
# backend (http://localhost:8001, API docs at /docs)
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# frontend (http://localhost:5174)
cd frontend && npm install && npm run dev
```

Optional `.env` in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here   # LLM guidance; without it the panel says the guidance is unavailable
PORT=8001
HOST=0.0.0.0
```

---

## Repository layout

```
api/ app/            FastAPI routes, schemas, LLM explainer service
data/                dataset splitter (with content-hash de-duplication) and split manifests
models/              EfficientNet-B0 definition, weights, training history
explainability/      7 attribution engines, metrics, counterfactual, concept scoring
evaluation/          benchmarks, trustworthiness audit, decision support
experiments/         reproducible study scripts, report generator (generate_report.py), originality checker
reports/             academic research report (DOCX & PDF), study tables, figures and result files
report_kit/          fact sheet, writing guide, bibliography references
frontend/            React + Vite TypeScript app
tests/               unit, API and dataset-integrity tests
```

---

## Known limitations

- Only byte-identical duplicates were removed; near-duplicate photos can still sit in both train and test, so the accuracy is optimistic.
- PlantVillage photos are lab-style on plain backgrounds; field performance is untested.
- The explanation study uses a stratified sample of the test set, not all images; localization uses a green-pixel leaf mask rather than expert lesion masks.
- Accuracy collapses under Gaussian noise and blur (see Robustness) and under a gradient attack (FGSM ε = 0.03 retained 13.5 % on 300 images).
- Severity staging and concept scores are heuristics, not clinically validated.
- Expert feedback is pending.

## License

Distributed under the MIT License. See `LICENSE` for details.
