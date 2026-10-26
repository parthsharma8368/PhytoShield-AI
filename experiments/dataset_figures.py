"""Dataset description figures/tables: class distribution per split, sample gallery, dedup audit."""

from __future__ import annotations

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from experiments.common import CONFIG, FIG_DIR, OUT_DIR, class_names, load_rgb
from experiments.make_figures import md_table, short


def main() -> None:
    names = class_names()
    sp = {s: json.loads((CONFIG.DATA_DIR / f"{s}_split.json").read_text()) for s in ("train", "val", "test")}
    legacy = {s: json.loads((CONFIG.DATA_DIR / "legacy_leaky_split" / f"{s}_split.json").read_text()) for s in ("train", "val", "test")}
    tab = pd.DataFrame({"Class": [short(n) for n in names],
                        "Train": [len(sp["train"][n]) for n in names], "Validation": [len(sp["val"][n]) for n in names],
                        "Test": [len(sp["test"][n]) for n in names]})
    tab["Total"] = tab[["Train", "Validation", "Test"]].sum(axis=1)
    tab.loc[len(tab)] = ["TOTAL", *tab[["Train", "Validation", "Test", "Total"]].sum().tolist()]
    md_table(tab, "table_dataset")

    fig, ax = plt.subplots(figsize=(8, 4.5))
    body = tab.iloc[:-1].sort_values("Total")
    ax.barh(body.Class, body.Train, color="#10b981", label="train")
    ax.barh(body.Class, body.Validation, left=body.Train, color="#6366f1", label="validation")
    ax.barh(body.Class, body.Test, left=body.Train + body.Validation, color="#f59e0b", label="test")
    ax.set(xlabel="images", title="Images per class and split (after de-duplication)"); ax.legend()
    fig.tight_layout(); fig.savefig(FIG_DIR / "fig_dataset_distribution.png", dpi=200); plt.close(fig)

    rng = np.random.default_rng(0)
    fig, ax = plt.subplots(3, 5, figsize=(12, 7.6))
    for a, n in zip(ax.ravel(), names):
        a.imshow(load_rgb(sp["test"][n][int(rng.integers(len(sp["test"][n])))])); a.set_title(short(n), fontsize=7.5); a.axis("off")
    fig.tight_layout(); fig.savefig(FIG_DIR / "fig_dataset_samples.png", dpi=170); plt.close(fig)

    audit = {"legacy_split_sizes": {s: sum(map(len, v.values())) for s, v in legacy.items()},
             "clean_split_sizes": {s: sum(map(len, v.values())) for s, v in sp.items()}}
    (OUT_DIR / "dataset_audit.json").write_text(json.dumps(audit, indent=2))
    print(audit)


if __name__ == "__main__":
    main()
