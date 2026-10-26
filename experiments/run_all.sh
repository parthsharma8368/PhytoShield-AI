#!/usr/bin/env bash
# Regenerates every number, table and figure used in the report from the CURRENT models/best_model.pth.
# Usage: bash experiments/run_all.sh   (about 30-40 min on Apple-silicon MPS)
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-.venv/bin/python}"
step() { echo; echo "=== $1 ==="; }

step "1/10 base model evaluation";  $PY -m experiments.run_base_eval
step "2/10 XAI study";              $PY -m experiments.run_xai_study --per-class 20 --lime-per-class 5
step "3/10 perturbation study";     $PY -m experiments.run_perturbation_study
step "4/10 failure analysis";       $PY -m experiments.run_failure_analysis
step "5/10 expert packet";          $PY -m experiments.expert_packet
step "6/10 expert feedback status"; $PY -m experiments.analyze_expert_feedback
step "7/10 figures and tables";     $PY -m experiments.make_figures
step "8/10 app trustworthiness audit"; $PY -m evaluation.trustworthiness
step "9/10 fact sheet";            $PY -m experiments.build_fact_sheet
step "10/10 website numbers";      $PY -m experiments.export_frontend_metrics
echo; echo "done. outputs: reports/study/  and  report_kit/fact_sheet.md"
