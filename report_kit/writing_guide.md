# Writing guide — one block per heading the professor requires

For each heading: **what to cover**, **evidence to use**, **pitfalls**. Write the prose yourself.
Numbers: copy from `fact_sheet.md` / `reports/study/`. Run the originality checker after each section.

## 1. Abstract (150–200 words)
Cover, in this order: the problem (farmers need a diagnosis they can trust, not only a label) → what was built (EfficientNet-B0 classifier + 7 explanation engines + quality metrics) → data (PlantVillage, 15 classes, clean split) → headline results (accuracy, macro-F1, best explanation method vs random) → one sentence on limits.
Pitfall: do not use the old 99.48 % figure — it came from a leaky split.

## 2. Introduction
Cover: why plant disease matters; why a black-box label is not enough; what "explainable" means to a non-expert; the gap (most works report accuracy, few measure explanation quality, and many ignore duplicate leakage); the objectives; report outline.
Cite: `mohanty2016plant`, `ferentinos2018plant`, `hughes2015plantvillage`, `doshivelez2017rigorous` — only after reading them.

## 3. Related work and comparison table
Use `comparison_table.md` as the skeleton. Columns: work, data, model, explanation method, explanation measured?, leakage handled?, gap. Verify every cell in the original paper. Add 2–3 papers you actually read beyond the seed list.

## 4. Proposed architecture / framework
Figures: `fig_architecture_system.png` (system), `fig_architecture_protocol.png` (experimental protocol).
Procedural steps to describe: (1) collect and deduplicate images → (2) stratified 70/15/15 split → (3) two-stage transfer learning → (4) predict + MC-dropout uncertainty → (5) run seven explanation engines → (6) score explanations with six metrics → (7) counterfactual check and concept scores → (8) show result progressively in the UI.
Pitfall: the diagram must match what the code does; if you change one, change the other.

## 5. Dataset description
Use `table_dataset`, `fig_dataset_distribution.png`, `fig_dataset_samples.png`, `dataset_audit.json`.
Cover: source and citation, number of classes/images before and after deduplication, class imbalance, image properties, the split sizes, how leakage was found and fixed, what could still leak.

## 6. Experimental setup
Cover: hardware (Apple-silicon MPS), library versions (`requirements.txt`), seed 42, two-stage schedule, optimizer/learning rates, batch size, augmentation, early stopping, evaluation protocol for each study (sample sizes, number of MC passes, perturbation list, explanation sample per class, random baseline).
Evidence: `config/config.py`, `models/training_history.json`.

## 7. Results and discussion — base model (separately, before any XAI)
Tables/figures: `table_base_model`, `table_per_class`, training curves, confusion matrix, per-class F1, reliability diagram, `table_error_detection`, selective-prediction curve.
Discuss: where it is strong/weak, most confused class pairs and why (visual similarity), calibration (over/under-confident), whether uncertainty detects mistakes. Compare with the leaky-split result as a short "what leakage hid" paragraph (data in `*/legacy_leaky_split/`).

## 8. Model with XAI — various scenarios
Scenarios to report: (a) clean test images, all seven methods; (b) the six input perturbations; (c) correct vs wrong predictions; (d) per-class behaviour; (e) agreement between methods.
Evidence: `table_xai_summary` (with Wilcoxon p vs random), faithfulness curves, boxplots, per-class heatmap, runtime figure, consistency matrices, `table_perturbation`, qualitative grid.
Discuss: which method is most faithful, which is fastest, the speed/faithfulness trade-off, whether methods agree.

## 9. Plots and analysis wrt features and metrics
Tie each figure to one question ("does highlighting more pixels hurt the prediction faster than random?"). Say what the axes mean in plain words before showing numbers. Feature-level view: concept scores (rule-based) and per-class results.

## 10. Human expert feedback (required because IML is involved)
Evidence: `reports/study/expert_packet/` (cases, form, instructions) and `analyze_expert_feedback.py`.
**Status: pending until a real expert fills the form.** If no expert response arrives before submission, write that plainly and present the protocol only. Never fabricate ratings. A teacher or agriculture-department contact can serve if their qualification is stated.

## 11. Failure cases with XAI results and discussion
Evidence: `table_failures`, `failure_cases.csv`, `failures/failure_XX.png`, `failure_stats.json`.
Cover: how many errors, which class pairs, what the heatmaps show in wrong predictions (focus on background, on wrong lesion, on a lookalike symptom), whether confidence/uncertainty warned about them, what would fix them (more data, better labels, background-robust training).

## 12. Novel contributions (pointwise)
Use `novel_contributions.md`. One short bullet each, with its evidence file. Keep the scope notes.

## 13. Conclusion and future work
Three or four sentences of findings, the limitations list below, and concrete next steps (field images, expert-annotated lesion masks, near-duplicate detection, trained concept model).

## 14. References
Only works you read. IEEE or APA, consistent. Verify author list, year, venue, DOI for every `.bib` entry.

---

### Limitations to state honestly
- Only byte-identical duplicates were removed; near-duplicate / same-leaf photos can still sit in train and test, so accuracy is optimistic.
- PlantVillage images are lab-style with plain backgrounds; field performance is untested.
- XAI study uses a stratified sample, not the full test set.
- Localization uses a colour-based leaf mask, not expert lesion masks.
- Composite quality index weights are a design choice.
- Severity staging and concept scores are heuristics and not clinically validated.
- Expert evaluation is pending / limited to the raters stated.
