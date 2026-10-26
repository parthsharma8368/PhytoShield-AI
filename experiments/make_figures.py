"""Builds every report figure and table from the study outputs (reports/study/*.json|csv|npz).

Usage: python -m experiments.make_figures
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import mannwhitneyu, wilcoxon
from sklearn.metrics import roc_auc_score, roc_curve

from experiments.common import CONFIG, FIG_DIR, METHOD_LABELS, METHODS, OUT_DIR, load_rgb, overlay

plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False, "figure.dpi": 120})
GREEN, INDIGO, AMBER, RED, GREY = "#10b981", "#6366f1", "#f59e0b", "#ef4444", "#94a3b8"
PALETTE = {"gradcam": "#10b981", "gradcam_pp": "#059669", "saliency": "#6366f1", "smoothgrad": "#818cf8",
           "ig": "#f59e0b", "shap": "#ef4444", "lime": "#ec4899", "random": "#94a3b8"}


def short(n: str) -> str:
    return n.replace("___", " ").replace("__", " ").replace("_", " ").strip()


def save(fig, name: str) -> None:
    fig.tight_layout()
    fig.savefig(FIG_DIR / name, dpi=200)
    plt.close(fig)
    print("figure", name)


def md_table(df: pd.DataFrame, name: str) -> None:
    df.to_csv(OUT_DIR / f"{name}.csv", index=False)
    (OUT_DIR / f"{name}.md").write_text(df.to_markdown(index=False), encoding="utf-8")


def load_json(name: str):
    p = OUT_DIR / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


# ---------------------------------------------------------------- base model
def base_model_figures() -> None:
    res, preds = load_json("base_model_results.json"), pd.read_csv(OUT_DIR / "predictions.csv")
    hist_path = CONFIG.MODELS_DIR / CONFIG.HISTORY_FILE
    if hist_path.exists():
        h = json.loads(hist_path.read_text())
        ep = np.arange(1, len(h["train_acc"]) + 1)
        fig, ax = plt.subplots(1, 2, figsize=(8, 3.2))
        ax[0].plot(ep, h["train_acc"], color=INDIGO, label="train"); ax[0].plot(ep, h["val_acc"], color=GREEN, label="validation")
        ax[0].set(xlabel="epoch", ylabel="accuracy (%)", title="Accuracy"); ax[0].legend()
        ax[1].plot(ep, h["train_loss"], color=INDIGO, label="train"); ax[1].plot(ep, h["val_loss"], color=GREEN, label="validation")
        ax[1].set(xlabel="epoch", ylabel="loss", title="Loss"); ax[1].legend()
        save(fig, "fig_training_curves.png")

    names = [short(n) for n in res["class_names"]]
    cm = np.array(res["confusion_matrix"], dtype=float)
    cmn = cm / cm.sum(1, keepdims=True)
    fig, ax = plt.subplots(figsize=(8, 7))
    im = ax.imshow(cmn, cmap="Greens", vmin=0, vmax=1)
    ax.set_xticks(range(len(names)), names, rotation=70, ha="right", fontsize=7); ax.set_yticks(range(len(names)), names, fontsize=7)
    for i in range(len(names)):
        for j in range(len(names)):
            if cm[i, j] > 0:
                ax.text(j, i, int(cm[i, j]), ha="center", va="center", fontsize=6, color="white" if cmn[i, j] > 0.6 else "black")
    ax.set(xlabel="predicted", ylabel="true", title="Confusion matrix (test set, counts; colour = row-normalised)")
    fig.colorbar(im, ax=ax, fraction=0.04)
    save(fig, "fig_confusion_matrix.png")

    pc = pd.DataFrame(res["per_class"]).T
    pc["name"] = [short(n) for n in pc.index]
    pc = pc.sort_values("f1")
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.barh(pc["name"], pc["f1"] * 100, color=GREEN)
    ax.set_xlim(max(0, pc["f1"].min() * 100 - 3), 100.2); ax.set(xlabel="F1 (%)", title="Per-class F1 on the test set")
    for y, (v, s) in enumerate(zip(pc["f1"] * 100, pc["support"])):
        ax.text(v + 0.05, y, f"{v:.1f}  (n={s})", va="center", fontsize=7)
    save(fig, "fig_per_class_f1.png")

    # reliability + confidence split
    rel = pd.DataFrame(res["reliability_bins"])
    fig, ax = plt.subplots(1, 2, figsize=(8, 3.4))
    ax[0].plot([0, 1], [0, 1], "--", color=GREY, label="perfect calibration")
    ax[0].plot(rel["confidence"], rel["accuracy"], "o-", color=GREEN, label=f"model (ECE={res['ece']:.4f})")
    ax[0].set(xlabel="mean confidence", ylabel="accuracy", title="Reliability diagram"); ax[0].legend()
    ax[1].hist(preds[preds.correct == 1].conf, bins=30, range=(0.2, 1), alpha=0.8, color=GREEN, label="correct")
    if (preds.correct == 0).any():
        ax[1].hist(preds[preds.correct == 0].conf, bins=30, range=(0.2, 1), alpha=0.8, color=RED, label="wrong")
    ax[1].set_yscale("log"); ax[1].set(xlabel="confidence", ylabel="images (log)", title="Confidence: correct vs wrong"); ax[1].legend()
    save(fig, "fig_reliability.png")

    # selective prediction: does uncertainty/XAI signal help the base model abstain on its own mistakes?
    fig, ax = plt.subplots(1, 2, figsize=(8.5, 3.4))
    scores = {"softmax confidence": -preds.conf, "MC-dropout std": preds.mc_std, "MC-dropout entropy": preds.mc_entropy}
    rows = []
    for (name, s), c in zip(scores.items(), (GREEN, INDIGO, AMBER)):
        order = np.argsort(s.to_numpy())  # most certain first
        acc = np.cumsum(preds.correct.to_numpy()[order]) / np.arange(1, len(order) + 1)
        cov = np.arange(1, len(order) + 1) / len(order)
        ax[0].plot(cov * 100, acc * 100, color=c, label=name)
        wrong = (preds.correct == 0).to_numpy()
        if wrong.any():
            fpr, tpr, _ = roc_curve(wrong, s)
            ax[1].plot(fpr, tpr, color=c, label=f"{name} (AUROC {roc_auc_score(wrong, s):.3f})")
            rows.append({"signal": name, "AUROC for detecting mistakes": round(roc_auc_score(wrong, s), 4),
                         "accuracy at 90% coverage": round(float(acc[int(0.9 * len(acc)) - 1] * 100), 2),
                         "accuracy at 95% coverage": round(float(acc[int(0.95 * len(acc)) - 1] * 100), 2)})
    ax[0].set(xlabel="coverage (% of images answered)", ylabel="accuracy on answered (%)", title="Selective prediction"); ax[0].legend(fontsize=7)
    ax[1].plot([0, 1], [0, 1], "--", color=GREY); ax[1].set(xlabel="false-positive rate", ylabel="true-positive rate", title="Detecting the model's mistakes"); ax[1].legend(fontsize=7)
    save(fig, "fig_selective_prediction.png")
    if rows:
        md_table(pd.DataFrame(rows), "table_error_detection")

    t = pd.DataFrame({"Metric": ["Test images", "Accuracy (%)", "Macro precision", "Macro recall", "Macro F1", "Weighted F1",
                                 "ECE", "MCE", "Brier score", "Misclassified"],
                      "Value": [res["n_test"], round(res["accuracy"], 2), round(res["macro"]["precision"], 4),
                                round(res["macro"]["recall"], 4), round(res["macro"]["f1"], 4), round(res["weighted"]["f1"], 4),
                                round(res["ece"], 4), round(res["mce"], 4), round(res["brier"], 4), res["n_failures"]]})
    md_table(t, "table_base_model")
    pcm = pd.DataFrame(res["per_class"]).T.reset_index().rename(columns={"index": "class"})
    md_table(pcm.round(4), "table_per_class")


# ---------------------------------------------------------------- XAI study
def xai_figures() -> None:
    df = pd.read_csv(OUT_DIR / "xai_metrics.csv")
    cur = np.load(OUT_DIR / "xai_curves.npz")
    fr = cur["fracs"]
    order = [m for m in [*METHODS, "random"] if f"{m}_del" in cur.files]

    fig, ax = plt.subplots(1, 2, figsize=(9, 3.6))
    for m in order:
        for a, k, title in ((ax[0], "del", "Deletion (lower is better)"), (ax[1], "ins", "Insertion (higher is better)")):
            c = cur[f"{m}_{k}"]
            a.plot(fr, c.mean(0), color=PALETTE[m], lw=2 if m == "random" else 1.5, ls="--" if m == "random" else "-", label=METHOD_LABELS[m])
            a.set(xlabel="fraction of pixels removed / revealed", ylabel="P(predicted class)", title=title)
    ax[1].legend(fontsize=7)
    save(fig, "fig_xai_faithfulness_curves.png")

    sub = df.copy()
    sub["method_label"] = sub["method"].map(METHOD_LABELS)
    fig, ax = plt.subplots(2, 2, figsize=(9.5, 6))
    for a, (col, title) in zip(ax.ravel(), (("del_auc", "Deletion AUC (lower = better)"), ("ins_auc", "Insertion AUC (higher = better)"),
                                            ("localization", "Localization: share of attribution on leaf"), ("sparsity", "Sparsity (higher = more focused)"))):
        ms = [m for m in order if sub[sub.method == m][col].notna().any()]
        a.boxplot([sub[sub.method == m][col].dropna() for m in ms], tick_labels=[METHOD_LABELS[m].replace(" (", "\n(") for m in ms],
                  patch_artist=True, boxprops=dict(facecolor="#d1fae5"), medianprops=dict(color="black"), flierprops=dict(markersize=2))
        a.set_title(title, fontsize=9); a.tick_params(axis="x", labelsize=6.5)
    save(fig, "fig_xai_metric_boxplots.png")

    # summary table with paired Wilcoxon vs random (per-image mean over 3 random draws)
    rnd = sub[sub.method == "random"].groupby("path")[["del_auc", "ins_auc"]].mean()
    rows = []
    for m in [*METHODS, "random"]:
        g = sub[sub.method == m]
        if g.empty:
            continue
        per_img = g.groupby("path")[["del_auc", "ins_auc"]].mean()
        common = per_img.join(rnd, lsuffix="", rsuffix="_rnd", how="inner")
        p_del = wilcoxon(common.del_auc, common.del_auc_rnd, alternative="less").pvalue if m != "random" and len(common) > 5 else np.nan
        rows.append({"Method": METHOD_LABELS[m], "n images": per_img.shape[0],
                     "Deletion AUC ↓": f"{g.del_auc.mean():.3f} ± {g.del_auc.std():.3f}",
                     "Insertion AUC ↑": f"{g.ins_auc.mean():.3f} ± {g.ins_auc.std():.3f}",
                     "Localization ↑": "—" if g.localization.isna().all() else f"{g.localization.mean():.3f} ± {g.localization.std():.3f}",
                     "Sparsity ↑": "—" if g.sparsity.isna().all() else f"{g.sparsity.mean():.3f} ± {g.sparsity.std():.3f}",
                     "Time / image (s)": f"{g.seconds.mean():.2f}",
                     "p (deletion < random)": "—" if np.isnan(p_del) else f"{p_del:.2e}"})
    md_table(pd.DataFrame(rows), "table_xai_summary")

    # per-class faithfulness gain (random deletion AUC minus method deletion AUC)
    gain = []
    for m in METHODS:
        g = sub[sub.method == m].groupby("label")["del_auc"].mean()
        gain.append(g)
    class_names = json.loads((CONFIG.MODELS_DIR / CONFIG.CLASS_NAMES_FILE).read_text())
    rnd_c = sub[sub.method == "random"].groupby("label")["del_auc"].mean()
    mat = pd.DataFrame({METHOD_LABELS[m]: rnd_c - g for m, g in zip(METHODS, gain)})
    fig, ax = plt.subplots(figsize=(7, 5.5))
    im = ax.imshow(mat.values, cmap="RdYlGn", vmin=-0.15, vmax=0.35, aspect="auto")
    ax.set_xticks(range(mat.shape[1]), mat.columns, rotation=40, ha="right", fontsize=7)
    ax.set_yticks(range(mat.shape[0]), [short(class_names[i]) for i in mat.index], fontsize=7)
    for i in range(mat.shape[0]):
        for j in range(mat.shape[1]):
            if not np.isnan(mat.values[i, j]):
                ax.text(j, i, f"{mat.values[i, j]:.2f}", ha="center", va="center", fontsize=6)
    ax.set_title("Faithfulness gain per class\n(random deletion AUC − method deletion AUC; higher = better)", fontsize=9)
    fig.colorbar(im, ax=ax, fraction=0.04)
    save(fig, "fig_xai_per_class_faithfulness.png")

    # runtime
    t = sub[sub.method != "random"].groupby("method").seconds.mean().reindex([m for m in METHODS])
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.bar([METHOD_LABELS[m] for m in t.index], t.values, color=[PALETTE[m] for m in t.index])
    ax.set(ylabel="seconds per image", title="Explanation cost per method"); ax.tick_params(axis="x", rotation=30, labelsize=7)
    save(fig, "fig_xai_runtime.png")

    # consistency matrices
    cons = load_json("xai_consistency.json")
    fig, ax = plt.subplots(1, 2, figsize=(10, 4.2))
    for a, key, title in ((ax[0], "spearman", "Rank correlation (Spearman)"), (ax[1], "top20_iou", "Overlap of top-20% regions (IoU)")):
        M = np.eye(len(METHODS))
        for pair, v in cons[key].items():
            i, j = (METHODS.index(x) for x in pair.split("|"))
            M[i, j] = M[j, i] = v
        im = a.imshow(M, cmap="Greens", vmin=0, vmax=1)
        a.set_xticks(range(len(METHODS)), [METHOD_LABELS[m].split(" (")[0] for m in METHODS], rotation=45, ha="right", fontsize=7)
        a.set_yticks(range(len(METHODS)), [METHOD_LABELS[m].split(" (")[0] for m in METHODS], fontsize=7)
        for i in range(len(METHODS)):
            for j in range(len(METHODS)):
                a.text(j, i, f"{M[i, j]:.2f}", ha="center", va="center", fontsize=6.5)
        a.set_title(title, fontsize=9)
    save(fig, "fig_xai_consistency.png")

    # qualitative grid
    ex = np.load(OUT_DIR / "xai_examples.npz", allow_pickle=False)
    meta = json.loads(str(ex["meta"]))
    pick = [k for k in meta][:: max(1, len(meta) // 6)][:6]
    fig, ax = plt.subplots(len(pick), 1 + len(METHODS), figsize=(1.7 * (1 + len(METHODS)), 1.8 * len(pick)))
    for r, k in enumerate(pick):
        img = load_rgb(meta[k]["path"])
        ax[r, 0].imshow(img.resize((224, 224))); ax[r, 0].set_ylabel(short(class_names[int(k)])[:22], fontsize=6.5, rotation=0, ha="right", va="center")
        for c, m in enumerate(METHODS, start=1):
            ax[r, c].imshow(overlay(img, ex[f"{k}__{m}"]))
            if r == 0:
                ax[r, c].set_title(METHOD_LABELS[m].split(" (")[0], fontsize=7)
    for a in ax.ravel():
        a.set_xticks([]); a.set_yticks([])
        for s in a.spines.values():
            s.set_visible(False)
    ax[0, 0].set_title("input", fontsize=7)
    save(fig, "fig_xai_qualitative.png")


# ---------------------------------------------------------------- scenarios / failures
def scenario_figures() -> None:
    res = load_json("perturbation_results.json")
    if not res:
        return
    sc = pd.DataFrame(res["scenarios"]).T.reset_index().rename(columns={"index": "scenario"})
    fig, ax = plt.subplots(1, 2, figsize=(9.5, 3.6))
    ax[0].barh(sc.scenario, sc.accuracy, color=[GREEN if s == "clean" else AMBER for s in sc.scenario])
    ax[0].set(xlabel="accuracy (%)", title=f"Accuracy under input corruption (n={res['n_accuracy']})"); ax[0].invert_yaxis()
    for y, v in enumerate(sc.accuracy):
        ax[0].text(v + 0.3, y, f"{v:.1f}", va="center", fontsize=7)
    ax[1].barh(sc.scenario, sc.explanation_spearman, color=INDIGO)
    ax[1].set(xlabel="Spearman ρ (clean vs corrupted Grad-CAM++)", title=f"Explanation stability (n={res['n_stability']})", xlim=(0, 1)); ax[1].invert_yaxis()
    ax[1].set_yticklabels([])
    save(fig, "fig_perturbation.png")
    out = sc.copy()
    out.columns = ["Scenario", "Accuracy (%)", "Mean confidence", "Explanation ρ", "Explanation top-20% IoU", "Prediction flips (%)"]
    md_table(out.round(3), "table_perturbation")


def failure_figures() -> None:
    p = OUT_DIR / "failure_cases.csv"
    if not p.exists():
        return
    f, preds = pd.read_csv(p), pd.read_csv(OUT_DIR / "predictions.csv")
    x = pd.read_csv(OUT_DIR / "xai_metrics.csv")
    ok = x[(x.method == "gradcam_pp") & (x.correct == 1)]
    fig, ax = plt.subplots(1, 3, figsize=(10, 3.4))
    pairs = f.assign(pair=f.true.map(short) + "\n→ " + f.pred.map(short)).pair.value_counts().head(8)
    ax[0].barh(pairs.index[::-1], pairs.values[::-1], color=RED); ax[0].set(xlabel="failures", title="Most frequent confusions"); ax[0].tick_params(axis="y", labelsize=6)
    ax[1].boxplot([ok.localization.dropna(), f.gradcam_pp_localization.dropna()], tick_labels=["correct", "failures"], patch_artist=True, boxprops=dict(facecolor="#d1fae5"))
    ax[1].set_title("Grad-CAM++ localization", fontsize=9)
    ax[2].boxplot([preds[preds.correct == 1].mc_std, preds[preds.correct == 0].mc_std], tick_labels=["correct", "failures"], patch_artist=True, boxprops=dict(facecolor="#d1fae5"))
    ax[2].set_title("MC-dropout std (epistemic)", fontsize=9); ax[2].set_yscale("symlog", linthresh=1e-3)
    save(fig, "fig_failures_summary.png")

    stats = {}
    for name, a, b in (("gradcam_pp_localization", ok.localization.dropna(), f.gradcam_pp_localization.dropna()),
                       ("gradcam_pp_sparsity", ok.sparsity.dropna(), f.gradcam_pp_sparsity.dropna()),
                       ("mc_std", preds[preds.correct == 1].mc_std, preds[preds.correct == 0].mc_std),
                       ("confidence", preds[preds.correct == 1].conf, preds[preds.correct == 0].conf)):
        stats[name] = {"correct_mean": float(a.mean()), "failure_mean": float(b.mean()),
                       "mann_whitney_p": float(mannwhitneyu(a, b).pvalue) if len(b) > 2 else None}
    (OUT_DIR / "failure_stats.json").write_text(json.dumps(stats, indent=2))
    cols = ["id", "true", "pred", "conf", "second", "second_conf", "mc_std", "gradcam_pp_localization", "cf_confidence_drop"]
    t = f[cols].copy()
    t["true"], t["pred"], t["second"] = t.true.map(short), t.pred.map(short), t.second.map(short)
    md_table(t.round(3), "table_failures")


if __name__ == "__main__":
    for fn in (base_model_figures, xai_figures, scenario_figures, failure_figures):
        try:
            fn()
        except FileNotFoundError as e:
            print("skipped", fn.__name__, "-", e)
