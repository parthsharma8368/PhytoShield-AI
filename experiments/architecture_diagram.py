"""Draws the proposed framework (system + experimental protocol) as report-ready figures."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from experiments.common import FIG_DIR

INK, GREEN, INDIGO, AMBER, PINK, GREY = "#0f172a", "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#e2e8f0"


def box(ax, x, y, w, h, text, fc, ec=None, fs=8.5, bold=False, tc=INK):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08", fc=fc, ec=ec or fc, lw=1.4))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs, color=tc, fontweight="bold" if bold else "normal", linespacing=1.25)


def arrow(ax, a, b, color=INK):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=11, lw=1.3, color=color))


def system_diagram() -> None:
    fig, ax = plt.subplots(figsize=(13, 6.4))
    ax.set_xlim(0, 13); ax.set_ylim(0, 6.4); ax.axis("off")
    box(ax, 0.2, 2.7, 1.6, 1.0, "Leaf photo\n(upload)", GREY, INK, bold=True)
    box(ax, 2.2, 2.7, 1.7, 1.0, "Pre-processing\nresize 224×224\nImageNet normalise", "#d1fae5", GREEN)
    box(ax, 4.3, 2.7, 1.9, 1.0, "EfficientNet-B0\n(base classifier)\n15 classes", GREEN, GREEN, bold=True, tc="white")
    box(ax, 6.7, 4.6, 2.3, 1.1, "STAGE 1 · quick answer\nDisease + confidence\n+ Grad-CAM++ (~0.1 s)", "#d1fae5", GREEN, bold=True)
    box(ax, 6.7, 2.7, 2.3, 1.5, "STAGE 2 · XAI layer\nGrad-CAM · Grad-CAM++\nSaliency · SmoothGrad\nIntegrated Gradients\nSHAP · LIME", "#e0e7ff", INDIGO, bold=True)
    box(ax, 6.7, 0.5, 2.3, 1.7, "Beyond heat-maps\nCounterfactual (erase lesion)\nConcept scoring (rule-based)\nMC-dropout uncertainty\n6 explanation-quality metrics", "#fef3c7", AMBER, bold=True)
    box(ax, 9.5, 4.6, 2.0, 1.1, "STAGE 3 · narrative\nLLM text: cause, cure,\nprevention (from findings)", "#fce7f3", PINK, bold=True)
    box(ax, 9.5, 2.7, 2.0, 1.5, "Decision support\nSeverity staging (% leaf)\nTriage priorities\nChecklist", "#fef3c7", AMBER, bold=True)
    box(ax, 9.5, 0.5, 2.0, 1.7, "Trust audit\nECE · fairness · noise/blur\nFGSM · background test\nfailure analysis", GREY, INK, bold=True)
    box(ax, 11.9, 2.4, 1.0, 1.6, "Web UI\n(React)", INK, INK, bold=True, tc="white")
    for a, b in (((1.8, 3.2), (2.2, 3.2)), ((3.9, 3.2), (4.3, 3.2)), ((6.2, 3.45), (6.7, 3.45)), ((6.2, 3.7), (6.7, 5.0)),
                 ((6.2, 2.9), (6.7, 1.7)), ((9.0, 3.45), (9.5, 3.45)), ((9.0, 5.15), (9.5, 5.15)), ((9.0, 1.4), (9.5, 1.4)),
                 ((11.5, 5.0), (11.9, 3.7)), ((11.5, 3.45), (11.9, 3.2)), ((11.5, 1.4), (11.9, 2.7))):
        arrow(ax, a, b)
    ax.text(6.5, 6.15, "Proposed framework — explainable plant-disease diagnosis", ha="center", fontsize=12, fontweight="bold", color=INK)
    fig.tight_layout(); fig.savefig(FIG_DIR / "fig_architecture_system.png", dpi=220); plt.close(fig)


def protocol_diagram() -> None:
    fig, ax = plt.subplots(figsize=(13, 3.0))
    ax.set_xlim(0, 13.4); ax.set_ylim(0.6, 3.5); ax.axis("off")
    steps = [("1  Audit & de-duplicate\n20,624 unique images\n(MD5 content hash)", GREY), ("2  Stratified split\n70 / 15 / 15\nseed = 42", "#d1fae5"),
             ("3  Train base model\nEfficientNet-B0\n2-stage fine-tuning", GREEN), ("4  Base evaluation\nacc · P · R · F1\nECE · confusion", "#d1fae5"),
             ("5  XAI study\n7 engines vs random\nfaithfulness etc.", "#e0e7ff"), ("6  Scenarios\nnoise · blur · light\nJPEG · occlusion", "#fef3c7"),
             ("7  Failure analysis\nevery misclassified\nimage explained", "#fee2e2"), ("8  Expert feedback\nblinded agronomist\nrating packet", "#fce7f3")]
    w, g = 1.45, 0.17
    for i, (t, c) in enumerate(steps):
        x = 0.2 + i * (w + g)
        box(ax, x, 1.0, w, 1.7, t, c, INK, fs=7.8, tc="white" if c == GREEN else INK)
        if i:
            arrow(ax, (x - g, 1.85), (x, 1.85))
    ax.text(6.7, 3.2, "Experimental protocol (all numbers in the report come from steps 4–8)", ha="center", fontsize=11, fontweight="bold")
    fig.tight_layout(); fig.savefig(FIG_DIR / "fig_architecture_protocol.png", dpi=220); plt.close(fig)


if __name__ == "__main__":
    system_diagram(); protocol_diagram(); print("diagrams written")
