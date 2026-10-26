# Related-work comparison — DRAFT rows

Seed rows only. Every cell was filled from memory and **must be checked against the paper** before it goes in the report
(cells marked *verify* are the ones most likely to be wrong). Replace or extend with papers you have actually read.

## Research works on plant-disease recognition

| Work | Data | Model | Explanation method | Explanation measured quantitatively? | Duplicate leakage discussed? |
|---|---|---|---|---|---|
| Mohanty et al. 2016 `mohanty2016plant` | PlantVillage, 38 classes (*verify size*) | AlexNet, GoogLeNet | none (*verify*) | no | *verify* |
| Ferentinos 2018 `ferentinos2018plant` | ~87k images, 25 plants, 58 classes (*verify*) | several CNNs | none (*verify*) | no | *verify* |
| Brahimi et al. 2017 `brahimi2017tomato` | tomato leaves, 9 diseases (*verify*) | AlexNet, GoogLeNet | saliency-style symptom visualization | qualitative (*verify*) | *verify* |
| Toda & Okura 2019 `toda2019cnn` | PlantVillage (*verify*) | CNN | several visualization methods | qualitative (*verify*) | *verify* |
| **This work** | PlantVillage, 15 classes, content-hash deduplicated | EfficientNet-B0, two-stage fine-tuning | 7 engines + counterfactual + rule-based concepts | **yes** — 6 metrics, random baseline, Wilcoxon tests | **yes** — audited and fixed |

## Explanation tools and libraries

| Tool | What it offers | What it does not offer for this problem (*verify against its docs*) |
|---|---|---|
| Captum `kokhlikyan2020captum` | many attribution algorithms for PyTorch | no plant-disease pipeline, no end-user app, metrics left to the user |
| SHAP library `lundberg2017shap` | Shapley-value explanations | slow on images; no leaf-specific evaluation |
| LIME library `ribeiro2016lime` | local surrogate explanations | unstable between runs; slow |
| Quantus `hedstrom2023quantus` | many explanation-quality metrics | toolkit only; no model, no UI, no domain study |
| Grad-CAM family implementations | class-activation heatmaps | one method family only |
| **This work** | one pipeline: classifier + 7 engines + 6 metrics + UI + failure study | scope limited to 15 PlantVillage classes |

## Method papers behind the engines (cite in the method section, not the comparison table)
`selvaraju2017gradcam`, `chattopadhay2018gradcampp`, `simonyan2014saliency`, `smilkov2017smoothgrad`, `sundararajan2017ig`, `lundberg2017shap`, `ribeiro2016lime`; evaluation: `petsiuk2018rise`, `hooker2019roar`, `adebayo2018sanity`.

Reminder: the table compares **capabilities**, so avoid claiming other works are "worse". Say what they do and what this project adds.
