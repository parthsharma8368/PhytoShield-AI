---
trigger: always_on
---

# Strict Prohibition of False or Synthetic Data

1. **Zero Tolerance for Fake/Placeholder/Mock Data**:
   - NEVER create, hardcode, simulate, or mock any metrics, benchmarks, evaluations, or test figures to satisfy user or academic requirements.
   - All benchmark figures (accuracy, precision, recall, F1, latency, parameter counts, calibration ECE, fairness parity, adversarial retention) MUST be empirically computed from real runs on real data or active model checkpoints.
   - If a model or pipeline has NOT been trained or evaluated yet, explicitly report it as `null`, `None`, `"Untrained"`, or `"Pending Train"`. Never guess or copy literature numbers as project results.

2. **Real Model Training & Empirical Audit**:
   - When figures are required for candidate architectures or newly introduced features, execute actual training scripts (`training/train_benchmarks.py`) and empirical evaluation pipelines (`evaluation/evaluator.py`, `evaluation/trustworthiness.py`) directly on the dataset (`DATASET/PlantVillage`).
   - If training requires substantial compute or user confirmation, present the execution command and ask to run real training rather than inventing placeholder numbers.

3. **Data Authenticity Verification**:
   - Every report (`reports/classification_report.json`, `reports/model_benchmarks.json`, `reports/trustworthiness_audit.json`, `reports/xai_framework_evaluation.json`) and API response must directly trace to reproducible artifacts and real test samples.
