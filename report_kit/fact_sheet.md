# Fact sheet (generated 2026-10-25) — numbers only, write the prose yourself

## Dataset and split

- Old split: 41,276 files (train 28,887 / val 6,186 / test 6,203).
- Clean split after content-hash deduplication: 20,624 unique images (train 14,430 / val 3,087 / test 3,107).
- Files removed as byte-identical copies: 20,652.

| Class                                       |   Train |   Validation |   Test |   Total |
|:--------------------------------------------|--------:|-------------:|-------:|--------:|
| Pepper bell Bacterial spot                  |     697 |          149 |    151 |     997 |
| Pepper bell healthy                         |    1034 |          221 |    223 |    1478 |
| Potato Early blight                         |     700 |          150 |    150 |    1000 |
| Potato Late blight                          |     700 |          150 |    150 |    1000 |
| Potato healthy                              |     106 |           22 |     24 |     152 |
| Tomato Bacterial spot                       |    1488 |          319 |    320 |    2127 |
| Tomato Early blight                         |     700 |          150 |    150 |    1000 |
| Tomato Late blight                          |    1330 |          285 |    286 |    1901 |
| Tomato Leaf Mold                            |     666 |          142 |    144 |     952 |
| Tomato Septoria leaf spot                   |    1239 |          265 |    267 |    1771 |
| Tomato Spider mites Two spotted spider mite |    1173 |          251 |    252 |    1676 |
| Tomato Target Spot                          |     982 |          210 |    212 |    1404 |
| Tomato Tomato YellowLeaf Curl Virus         |    2245 |          481 |    482 |    3208 |
| Tomato Tomato mosaic virus                  |     261 |           55 |     57 |     373 |
| Tomato healthy                              |    1109 |          237 |    239 |    1585 |
| TOTAL                                       |   14430 |         3087 |   3107 |   20624 |

## Base model (no XAI)

- Test images: 3,107; errors: 58.
- Accuracy: 98.13 %.
- Macro P/R/F1: 0.9765 / 0.9818 / 0.9790.
- Weighted P/R/F1: 0.9815 / 0.9813 / 0.9813.
- ECE 0.0160, MCE 0.7720, Brier 0.0294.
- Mean confidence: correct 0.972, wrong 0.65.
- Most frequent confusions (true → predicted: count): Tomato__Target_Spot → Tomato_Spider_mites_Two_spotted_spider_mite: 6; Tomato_Late_blight → Tomato_Early_blight: 5; Tomato_Bacterial_spot → Tomato_Early_blight: 4; Tomato_Early_blight → Tomato_Late_blight: 4; Tomato_Bacterial_spot → Tomato__Target_Spot: 3

| Metric          |     Value |
|:----------------|----------:|
| Test images     | 3107      |
| Accuracy (%)    |   98.13   |
| Macro precision |    0.9765 |
| Macro recall    |    0.9818 |
| Macro F1        |    0.979  |
| Weighted F1     |    0.9813 |
| ECE             |    0.016  |
| MCE             |    0.772  |
| Brier score     |    0.0294 |
| Misclassified   |   58      |

| class                                       |   precision |   recall |     f1 |   support |
|:--------------------------------------------|------------:|---------:|-------:|----------:|
| Pepper__bell___Bacterial_spot               |      0.9934 |   0.9934 | 0.9934 |       151 |
| Pepper__bell___healthy                      |      0.9867 |   1      | 0.9933 |       223 |
| Potato___Early_blight                       |      1      |   0.9933 | 0.9967 |       150 |
| Potato___Late_blight                        |      0.9865 |   0.9733 | 0.9799 |       150 |
| Potato___healthy                            |      0.9231 |   1      | 0.96   |        24 |
| Tomato_Bacterial_spot                       |      0.9905 |   0.975  | 0.9827 |       320 |
| Tomato_Early_blight                         |      0.9338 |   0.94   | 0.9369 |       150 |
| Tomato_Late_blight                          |      0.9789 |   0.972  | 0.9754 |       286 |
| Tomato_Leaf_Mold                            |      0.9789 |   0.9653 | 0.972  |       144 |
| Tomato_Septoria_leaf_spot                   |      0.985  |   0.9813 | 0.9831 |       267 |
| Tomato_Spider_mites_Two_spotted_spider_mite |      0.9544 |   0.996  | 0.9748 |       252 |
| Tomato__Target_Spot                         |      0.971  |   0.9481 | 0.9594 |       212 |
| Tomato__Tomato_YellowLeaf__Curl_Virus       |      0.9958 |   0.9896 | 0.9927 |       482 |
| Tomato__Tomato_mosaic_virus                 |      0.9828 |   1      | 0.9913 |        57 |
| Tomato_healthy                              |      0.9876 |   1      | 0.9938 |       239 |

### Error detection from confidence / uncertainty

| signal             |   AUROC for detecting mistakes |   accuracy at 90% coverage |   accuracy at 95% coverage |
|:-------------------|-------------------------------:|---------------------------:|---------------------------:|
| softmax confidence |                         0.9642 |                      99.86 |                      99.59 |
| MC-dropout std     |                         0.9587 |                      99.79 |                      99.53 |
| MC-dropout entropy |                         0.9583 |                      99.86 |                      99.39 |

## Training run

- history keys: ['train_loss', 'train_acc', 'val_loss', 'val_acc', 'precision', 'recall', 'f1_score', 'learning_rate']

- train_loss: epochs run = 20, last = 0.0917
- train_acc: epochs run = 20, last = 97.3181
- val_loss: epochs run = 20, last = 0.0698
- val_acc: epochs run = 20, last = 97.7972
- precision: epochs run = 20, last = 97.8227
- recall: epochs run = 20, last = 97.7972
- f1_score: epochs run = 20, last = 97.7835
- learning_rate: epochs run = 20, last = 0.0000

## XAI study (stratified sample)

| Method               |   n images | Deletion AUC ↓   | Insertion AUC ↑   | Localization ↑   | Sparsity ↑    |   Time / image (s) | p (deletion < random)   |
|:---------------------|-----------:|:-----------------|:------------------|:-----------------|:--------------|-------------------:|:------------------------|
| Grad-CAM             |        300 | 0.207 ± 0.129    | 0.360 ± 0.172     | 0.723 ± 0.134    | 0.293 ± 0.055 |               0.06 | 8.42e-29                |
| Grad-CAM++           |        300 | 0.209 ± 0.130    | 0.373 ± 0.162     | 0.795 ± 0.131    | 0.346 ± 0.056 |               0.05 | 1.76e-28                |
| Saliency             |        300 | 0.318 ± 0.159    | 0.434 ± 0.135     | 0.459 ± 0.121    | 0.226 ± 0.021 |               0.05 | 1.02e-01                |
| SmoothGrad           |        300 | 0.312 ± 0.112    | 0.530 ± 0.145     | 0.537 ± 0.122    | 0.238 ± 0.045 |               0.57 | 4.02e-02                |
| Integrated Gradients |        300 | 0.376 ± 0.157    | 0.419 ± 0.151     | 0.351 ± 0.136    | 0.250 ± 0.022 |               0.58 | 1.00e+00                |
| SHAP (occlusion)     |        300 | 0.274 ± 0.158    | 0.391 ± 0.152     | 0.615 ± 0.194    | 0.439 ± 0.061 |               0.22 | 3.18e-08                |
| LIME                 |         75 | 0.304 ± 0.118    | 0.427 ± 0.167     | 0.445 ± 0.129    | 0.277 ± 0.056 |               0.28 | 1.64e-02                |
| Random (baseline)    |        300 | 0.326 ± 0.134    | 0.324 ± 0.134     | —                | —             |               0    | —                       |

- images explained: 300; rows: 2,775
- correct predictions in sample: 293 of 300

- agreement matrices computed on 300 images (see consistency figures)

## Input perturbations

| Scenario            |   Accuracy (%) |   Mean confidence |   Explanation ρ |   Explanation top-20% IoU |   Prediction flips (%) |
|:--------------------|---------------:|------------------:|----------------:|--------------------------:|-----------------------:|
| clean               |         98.133 |             0.966 |           1     |                     1     |                  0     |
| gaussian_noise_0.10 |         24.944 |             0.371 |           0.623 |                     0.358 |                 80.952 |
| gaussian_blur_r3    |         16.511 |             0.861 |           0.722 |                     0.437 |                 91.429 |
| brightness_x0.5     |         96.073 |             0.934 |           0.965 |                     0.825 |                  4.762 |
| brightness_x1.5     |         94.046 |             0.929 |           0.947 |                     0.825 |                  6.667 |
| jpeg_q15            |         87.802 |             0.838 |           0.939 |                     0.786 |                  9.524 |
| occlusion_25pct     |         86.933 |             0.804 |           0.737 |                     0.283 |                 17.143 |
| background_removed  |         74.831 |             0.802 |           0.916 |                     0.744 |                 25.714 |

## Failure cases

|   id | true                                        | pred                                        |   conf | second                                      |   second_conf |   mc_std |   gradcam_pp_localization |   cf_confidence_drop |
|-----:|:--------------------------------------------|:--------------------------------------------|-------:|:--------------------------------------------|--------------:|---------:|--------------------------:|---------------------:|
|    0 | Tomato Late blight                          | Tomato healthy                              |  0.997 | Tomato Late blight                          |         0.001 |    0.002 |                     0.768 |                 1.69 |
|    1 | Tomato Target Spot                          | Tomato Spider mites Two spotted spider mite |  0.977 | Tomato Target Spot                          |         0.021 |    0.01  |                     0.903 |                15.78 |
|    2 | Tomato Target Spot                          | Tomato Early blight                         |  0.971 | Tomato Leaf Mold                            |         0.016 |    0.015 |                     0.882 |                55.69 |
|    3 | Tomato Target Spot                          | Tomato Spider mites Two spotted spider mite |  0.926 | Tomato Target Spot                          |         0.067 |    0.027 |                     0.876 |                 3.43 |
|    4 | Tomato Tomato YellowLeaf Curl Virus         | Tomato Spider mites Two spotted spider mite |  0.905 | Tomato Leaf Mold                            |         0.087 |    0.087 |                     0.881 |                11.31 |
|    5 | Tomato Target Spot                          | Tomato Spider mites Two spotted spider mite |  0.898 | Tomato Target Spot                          |         0.062 |    0.042 |                     0.854 |                75.31 |
|    6 | Tomato Early blight                         | Tomato Late blight                          |  0.87  | Tomato Early blight                         |         0.087 |    0.037 |                     0.76  |                34.82 |
|    7 | Tomato Early blight                         | Tomato Bacterial spot                       |  0.832 | Tomato Early blight                         |         0.142 |    0.045 |                     0.606 |                50.58 |
|    8 | Tomato Bacterial spot                       | Tomato Early blight                         |  0.83  | Tomato Bacterial spot                       |         0.159 |    0.046 |                     0.804 |                14.2  |
|    9 | Tomato Target Spot                          | Pepper bell healthy                         |  0.83  | Tomato Target Spot                          |         0.154 |    0.055 |                     0.873 |                64.19 |
|   10 | Tomato Late blight                          | Tomato Early blight                         |  0.83  | Tomato Late blight                          |         0.103 |    0.046 |                     0.825 |                36.3  |
|   11 | Tomato Leaf Mold                            | Tomato Spider mites Two spotted spider mite |  0.798 | Tomato Leaf Mold                            |         0.169 |    0.127 |                     0.724 |                40.64 |
|   12 | Tomato Leaf Mold                            | Tomato Septoria leaf spot                   |  0.79  | Tomato Leaf Mold                            |         0.209 |    0.09  |                     0.796 |                55.79 |
|   13 | Pepper bell Bacterial spot                  | Pepper bell healthy                         |  0.787 | Pepper bell Bacterial spot                  |         0.204 |    0.089 |                     0.878 |                73.67 |
|   14 | Potato Late blight                          | Tomato Late blight                          |  0.773 | Potato Late blight                          |         0.108 |    0.083 |                     0.701 |                11.31 |
|   15 | Tomato Target Spot                          | Tomato Spider mites Two spotted spider mite |  0.772 | Tomato Target Spot                          |         0.217 |    0.101 |                     0.917 |                -0.58 |
|   16 | Tomato Target Spot                          | Tomato Septoria leaf spot                   |  0.771 | Tomato Target Spot                          |         0.18  |    0.08  |                     0.879 |                71.19 |
|   17 | Tomato Leaf Mold                            | Tomato Spider mites Two spotted spider mite |  0.748 | Tomato Leaf Mold                            |         0.219 |    0.091 |                     0.875 |                38.9  |
|   18 | Tomato Late blight                          | Pepper bell healthy                         |  0.715 | Tomato Late blight                          |         0.281 |    0.109 |                     0.665 |                47.99 |
|   19 | Tomato Target Spot                          | Tomato Spider mites Two spotted spider mite |  0.711 | Tomato Target Spot                          |         0.268 |    0.106 |                     0.858 |                60.22 |
|   20 | Tomato Tomato YellowLeaf Curl Virus         | Tomato Bacterial spot                       |  0.696 | Tomato Tomato YellowLeaf Curl Virus         |         0.29  |    0.095 |                     0.866 |                57.31 |
|   21 | Tomato Late blight                          | Tomato Early blight                         |  0.695 | Tomato Late blight                          |         0.264 |    0.144 |                     0.514 |                64.33 |
|   22 | Tomato Septoria leaf spot                   | Tomato Bacterial spot                       |  0.687 | Tomato Septoria leaf spot                   |         0.29  |    0.081 |                     0.872 |                 5.16 |
|   23 | Tomato Tomato YellowLeaf Curl Virus         | Tomato Spider mites Two spotted spider mite |  0.67  | Tomato Tomato YellowLeaf Curl Virus         |         0.291 |    0.091 |                     0.918 |               -15.86 |
|   24 | Tomato Spider mites Two spotted spider mite | Tomato Tomato YellowLeaf Curl Virus         |  0.655 | Tomato Spider mites Two spotted spider mite |         0.289 |    0.15  |                     0.894 |                60    |
|   25 | Tomato Late blight                          | Tomato Early blight                         |  0.641 | Tomato Late blight                          |         0.3   |    0.091 |                     0.32  |                11.71 |
|   26 | Tomato Bacterial spot                       | Tomato Early blight                         |  0.631 | Tomato Bacterial spot                       |         0.358 |    0.152 |                     0.885 |                61    |
|   27 | Tomato Tomato YellowLeaf Curl Virus         | Tomato Spider mites Two spotted spider mite |  0.629 | Tomato Tomato YellowLeaf Curl Virus         |         0.273 |    0.089 |                     0.869 |                43.12 |
|   28 | Tomato Early blight                         | Tomato Late blight                          |  0.619 | Tomato Early blight                         |         0.291 |    0.141 |                     0.862 |                49.98 |
|   29 | Potato Late blight                          | Tomato Late blight                          |  0.615 | Potato Late blight                          |         0.382 |    0.12  |                     0.411 |               -13.85 |
|   30 | Tomato Bacterial spot                       | Tomato Early blight                         |  0.602 | Tomato Bacterial spot                       |         0.243 |    0.091 |                     0.886 |                47.85 |
|   31 | Tomato Bacterial spot                       | Tomato Tomato YellowLeaf Curl Virus         |  0.601 | Tomato Bacterial spot                       |         0.373 |    0.12  |                     0.976 |                56.87 |
|   32 | Tomato Target Spot                          | Tomato Spider mites Two spotted spider mite |  0.595 | Tomato Target Spot                          |         0.195 |    0.095 |                     0.914 |                31.64 |
|   33 | Tomato Late blight                          | Tomato Early blight                         |  0.586 | Tomato Late blight                          |         0.412 |    0.141 |                     0.497 |                52.6  |
|   34 | Tomato Target Spot                          | Tomato healthy                              |  0.585 | Tomato Target Spot                          |         0.241 |    0.119 |                     0.794 |                32.03 |
|   35 | Tomato Early blight                         | Tomato Septoria leaf spot                   |  0.581 | Tomato Early blight                         |         0.234 |    0.116 |                     0.828 |                34.6  |
|   36 | Tomato Bacterial spot                       | Tomato Target Spot                          |  0.575 | Tomato Bacterial spot                       |         0.408 |    0.114 |                     0.919 |                37    |
|   37 | Potato Late blight                          | Potato healthy                              |  0.569 | Potato Late blight                          |         0.427 |    0.065 |                     0.948 |                55.08 |
|   38 | Potato Early blight                         | Potato Late blight                          |  0.567 | Potato Early blight                         |         0.429 |    0.062 |                     0.841 |                26.91 |
|   39 | Tomato Septoria leaf spot                   | Tomato Leaf Mold                            |  0.566 | Tomato Septoria leaf spot                   |         0.433 |    0.153 |                     0.752 |                51.78 |
|   40 | Tomato Early blight                         | Pepper bell Bacterial spot                  |  0.563 | Tomato Early blight                         |         0.402 |    0.112 |                     0.809 |                53.68 |
|   41 | Tomato Early blight                         | Tomato Septoria leaf spot                   |  0.56  | Tomato Early blight                         |         0.314 |    0.108 |                     0.765 |                17.62 |
|   42 | Tomato Early blight                         | Tomato Target Spot                          |  0.546 | Tomato Spider mites Two spotted spider mite |         0.381 |    0.131 |                     0.832 |               -29.97 |
|   43 | Tomato Leaf Mold                            | Tomato Spider mites Two spotted spider mite |  0.539 | Tomato Leaf Mold                            |         0.406 |    0.108 |                     0.872 |               -29.01 |
|   44 | Tomato Bacterial spot                       | Tomato Target Spot                          |  0.537 | Tomato Bacterial spot                       |         0.447 |    0.123 |                     0.956 |                43.61 |
|   45 | Potato Late blight                          | Potato healthy                              |  0.516 | Potato Late blight                          |         0.483 |    0.067 |                     0.925 |                 5.29 |
|   46 | Tomato Late blight                          | Tomato Early blight                         |  0.508 | Tomato Late blight                          |         0.361 |    0.105 |                     0.557 |                35.11 |
|   47 | Tomato Septoria leaf spot                   | Tomato Target Spot                          |  0.498 | Tomato Septoria leaf spot                   |         0.402 |    0.17  |                     0.872 |                18.49 |
|   48 | Tomato Bacterial spot                       | Tomato Target Spot                          |  0.476 | Tomato Bacterial spot                       |         0.435 |    0.105 |                     0.869 |                17.97 |
|   49 | Tomato Septoria leaf spot                   | Tomato Leaf Mold                            |  0.469 | Tomato Septoria leaf spot                   |         0.431 |    0.122 |                     0.468 |                43.73 |
|   50 | Tomato Tomato YellowLeaf Curl Virus         | Tomato Leaf Mold                            |  0.459 | Tomato Spider mites Two spotted spider mite |         0.301 |    0.082 |                     0.829 |                44.83 |
|   51 | Tomato Septoria leaf spot                   | Tomato Tomato mosaic virus                  |  0.453 | Tomato Septoria leaf spot                   |         0.397 |    0.085 |                     0.66  |                44.49 |
|   52 | Tomato Early blight                         | Tomato Late blight                          |  0.443 | Tomato Early blight                         |         0.383 |    0.081 |                     0.641 |                 2.22 |
|   53 | Tomato Bacterial spot                       | Tomato Early blight                         |  0.437 | Tomato Bacterial spot                       |         0.329 |    0.106 |                     0.873 |               -12.92 |
|   54 | Tomato Leaf Mold                            | Tomato Target Spot                          |  0.435 | Tomato Septoria leaf spot                   |         0.177 |    0.1   |                     0.777 |                20.28 |
|   55 | Tomato Target Spot                          | Tomato healthy                              |  0.411 | Tomato Target Spot                          |         0.372 |    0.164 |                     0.849 |                24.36 |
|   56 | Tomato Early blight                         | Tomato Late blight                          |  0.383 | Tomato Early blight                         |         0.307 |    0.128 |                     0.8   |                35.95 |
|   57 | Tomato Late blight                          | Potato Late blight                          |  0.379 | Tomato Late blight                          |         0.339 |    0.061 |                     0.87  |                35.7  |

### Failures vs correct predictions (means)

```json
{
  "gradcam_pp_localization": {
    "correct_mean": 0.7966392491467577,
    "failure_mean": 0.7984948275862069,
    "mann_whitney_p": 0.5943455352661636
  },
  "gradcam_pp_sparsity": {
    "correct_mean": 0.3456443686006826,
    "failure_mean": 0.3688379310344828,
    "mann_whitney_p": 0.0027968866710180733
  },
  "mc_std": {
    "correct_mean": 0.011174887951155824,
    "failure_mean": 0.09442875702496101,
    "mann_whitney_p": 4.188130816434942e-33
  },
  "confidence": {
    "correct_mean": 0.9716776232908655,
    "failure_mean": 0.650106312899754,
    "mann_whitney_p": 7.377767321725692e-34
  }
}
```

## Human expert feedback

```json
{
  "status": "PENDING \u2014 no expert sheets collected yet"
}
```

## Figures available

- `reports/study/figures/fig_architecture_protocol.png`
- `reports/study/figures/fig_architecture_system.png`
- `reports/study/figures/fig_confusion_matrix.png`
- `reports/study/figures/fig_dataset_distribution.png`
- `reports/study/figures/fig_dataset_samples.png`
- `reports/study/figures/fig_failures_summary.png`
- `reports/study/figures/fig_per_class_f1.png`
- `reports/study/figures/fig_perturbation.png`
- `reports/study/figures/fig_reliability.png`
- `reports/study/figures/fig_selective_prediction.png`
- `reports/study/figures/fig_training_curves.png`
- `reports/study/figures/fig_xai_consistency.png`
- `reports/study/figures/fig_xai_faithfulness_curves.png`
- `reports/study/figures/fig_xai_metric_boxplots.png`
- `reports/study/figures/fig_xai_per_class_faithfulness.png`
- `reports/study/figures/fig_xai_qualitative.png`
- `reports/study/figures/fig_xai_runtime.png`
