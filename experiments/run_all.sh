#!/usr/bin/env bash
# Regenerates every number, table and figure used in the report from the CURRENT models/best_model.pth.
# Usage: bash experiments/run_all.sh   (about 30-40 min on Apple-silicon MPS)
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-.venv/bin/python}"
step() { echo; echo "=== $1 ==="; }

step "1/11 base model evaluation";  $PY -m experiments.run_base_eval
step "2/11 XAI study";              $PY -m experiments.run_xai_study --per-class 20 --lime-per-class 5
step "3/11 perturbation study";     $PY -m experiments.run_perturbation_study
step "4/11 failure analysis";       $PY -m experiments.run_failure_analysis
step "5/11 expert packet";          $PY -m experiments.expert_packet
step "6/11 expert feedback status"; $PY -m experiments.analyze_expert_feedback
step "7/11 figures and tables";     $PY -m experiments.make_figures
step "8/11 app trustworthiness audit"; $PY -m evaluation.trustworthiness
step "9/11 fact sheet";            $PY -m experiments.build_fact_sheet
step "10/11 website numbers";      $PY -m experiments.export_frontend_metrics
step "11/11 3D showcase data";     $PY -m experiments.export_showcase_data
echo; echo "done. outputs: reports/study/  and  report_kit/fact_sheet.md"
