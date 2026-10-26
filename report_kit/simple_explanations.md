# Explain it simply — and viva questions

Use these as memory aids. Say them in your own words; examiners notice recited answers.

## The project in three sentences
1. We trained a computer to look at a leaf photo and say which of 15 conditions it has.
2. A label alone is hard to trust, so the program also draws a heat-map on the leaf showing *where it looked*.
3. We then tested whether those heat-maps are honest, using fair tests with numbers, and we studied where the program fails.

## Each term, in plain words
| Term | One-line explanation | Everyday analogy |
|---|---|---|
| Transfer learning | Start from a network that already learned to see shapes and textures in millions of photos, then teach it leaves | Hiring a trained photographer and teaching them plants, instead of teaching someone who has never seen a camera |
| EfficientNet-B0 | A small, fast image network | A light backpack that still carries what you need |
| Grad-CAM / Grad-CAM++ | Heat-map from the last convolution layer showing which areas pushed the answer up | Highlighting the sentences a student underlined to justify an answer |
| Saliency | Which individual pixels, if changed slightly, change the answer most | Pressing every spot on a mattress to find the springs |
| SmoothGrad | Saliency averaged over noisy copies to remove speckle | Taking several blurry photos and averaging |
| Integrated Gradients | Adds up the effect of each pixel while slowly "turning on" the image from blank | Turning the volume up slowly and noting which instrument you hear first |
| SHAP (occlusion) | Hide patches one by one; patches whose hiding hurts most matter most | Covering parts of a puzzle |
| LIME | Fit a tiny simple model around one photo using many altered copies | Asking a simple model to imitate the complex one nearby |
| Faithfulness (deletion/insertion) | Remove the "important" pixels: confidence should crash fast. Add them first: confidence should rise fast. Better than random = honest | Take the supposedly key ingredients out of a recipe and see if the dish fails |
| Random baseline | A heat-map made of noise, used to prove a method is better than chance | A coin-flip control |
| Wilcoxon test | A statistical check that the difference from random is not luck | — |
| Localization | Share of the highlighted area that lies on the leaf rather than background | Is the student pointing at the paper or the desk? |
| Sparsity | Whether attention is concentrated on a few spots or smeared everywhere | Spotlight vs floodlight |
| Stability / robustness | Does the heat-map stay the same if the photo is slightly noisy/blurred | Same answer when asked twice |
| ECE (calibration) | When the model says "90 % sure", is it right 90 % of the time? | A weather forecaster's reliability |
| MC-Dropout | Run the model several times with parts randomly switched off; if answers vary, it is unsure | Asking a panel and noting disagreement |
| Counterfactual | Paint over the suspicious spot and see if the answer changes | "Would you still say sick if this spot weren't there?" |
| Data leakage | The same photo ends up in both training and test, so the test is too easy | Seeing the exam questions in advance |

## Likely viva questions (prepare short answers from your own experience)
1. Why did accuracy fall after you cleaned the data, and which number should we trust? *(leakage; the clean one)*
2. What exactly did the deduplication remove, and what might still leak? *(identical files only; near-duplicates remain)*
3. Why EfficientNet-B0 and not a larger network? *(size/speed trade-off; ask yourself what you measured)*
4. Which explanation method was most faithful, and how do you know it's not luck? *(metric + random baseline + Wilcoxon)*
5. Why do the methods disagree with each other? Is that a problem?
6. A heat-map looks convincing but deletion barely hurts the prediction — what does that tell you?
7. Is your concept scoring a Concept Bottleneck Model? *(No — rule-based heuristics.)*
8. How did you check explanations are useful to a real expert? *(protocol; state honestly what is done or pending)*
9. Show a failure case: what did the model look at and why was it wrong?
10. What happens on a real field photo with soil, hands, shadows? *(untested; PlantVillage is lab-style)*
11. How is the composite index weighted, and is that justified? *(design choice, not validated)*
12. How do you know the heat-map reflects the model and not just edges in the image? *(sanity checks, `adebayo2018sanity`; say if you ran a check or not)*
13. What would you do next?

## Demo script (3 minutes)
1. Upload a leaf → instant diagnosis with confidence (point out time).
2. Open the heat-map; explain red = pushed the decision.
3. Show the faithfulness curve vs random for the best method (figure from `reports/study/figures`).
4. Show one failure case and what the heat-map reveals.
5. State the main limit (lab images; near-duplicates) before the examiner asks.
