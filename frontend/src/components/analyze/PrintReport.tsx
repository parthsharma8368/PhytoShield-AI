import type { InsightResult, QuickResult, ReportResult, XAIMethodKey } from './types';
import { parseBulletPoints } from './utils';
import { HEADLINE } from '../../generated/metrics';

const METHODS: { id: XAIMethodKey; label: string }[] = [
  { id: 'gradcam_pp', label: 'Grad-CAM++' }, { id: 'gradcam', label: 'Grad-CAM' }, { id: 'saliency', label: 'Saliency' },
  { id: 'smoothgrad', label: 'SmoothGrad' }, { id: 'ig', label: 'Integrated Gradients' }, { id: 'shap', label: 'SHAP' }, { id: 'lime', label: 'LIME' },
];

const pct = (v: number | null | undefined, scale = 1) => (v == null ? 'Not available' : `${(v * scale).toFixed(1)}%`);

/** Paper version of the analysis. Hidden on screen; index.css shows it (and hides the app) when printing. */
export default function PrintReport({ preview, fileName, quick, report, insight, insightLoading }: {
  preview: string | null; fileName: string | null; quick: QuickResult | null; report: ReportResult | null;
  insight: InsightResult | null; insightLoading: boolean;
}) {
  if (!quick) {
    return <div className="print-report"><h1>PhytoShield AI report</h1><p>No analysis to export yet. Upload a leaf photo, run the analysis, then export.</p></div>;
  }
  const ds = report?.decision_support;
  const q = report?.explanation_quality;
  const cf = report?.counterfactual;
  const concepts = report?.botanical_concepts?.concepts?.slice().sort((a, b) => b.score - a.score);
  const hm = (id: XAIMethodKey) => (id === 'gradcam_pp' ? report?.gradcam_pp_heatmap_b64 ?? quick.primary_heatmap_b64 : report?.[`${id}_heatmap_b64`]);
  const guidance: [string, string | undefined][] = [
    ['About the disease', insight?.explanation], ['Signs to look for', insight?.signs], ['Treatment', insight?.cure],
    ['Prevention', insight?.prevention], ['Precautions (next 24–48 hours)', insight?.precautions],
  ];

  return (
    <div className="print-report">
      <header>
        <h1>PhytoShield AI — Leaf Diagnosis Report</h1>
        <p className="pr-meta">
          {new Date().toLocaleString()} · Photo: {fileName ?? 'uploaded leaf'} · Model: EfficientNet-B0 (test accuracy {HEADLINE.accuracy} on {HEADLINE.testImagesLabel} photos)
        </p>
      </header>

      <section className="pr-section">
        <h2>1. Diagnosis</h2>
        <div className="pr-row">
          {preview && <figure><img src={preview} alt="Leaf photo" /><figcaption>Leaf photo</figcaption></figure>}
          <figure><img src={quick.primary_heatmap_b64} alt="Grad-CAM++ heatmap" /><figcaption>Where the AI looked (Grad-CAM++)</figcaption></figure>
          <div className="pr-grow">
            <p className="pr-big">{insight?.disease_title ?? quick.disease_title}</p>
            <table><tbody>
              <tr><th>Confidence (calibrated)</th><td>{quick.confidence.toFixed(1)}%</td></tr>
              {report?.uncertainty && <>
                <tr><th>Trust level</th><td>{report.uncertainty.trust_tier}</td></tr>
                <tr><th>Predictive entropy</th><td>{report.uncertainty.predictive_entropy?.toFixed(2)} bits</td></tr>
              </>}
            </tbody></table>
          </div>
        </div>
      </section>

      {ds && (
        <section className="pr-section">
          <h2>2. How severe is it?</h2>
          <table><tbody>
            <tr><th>Leaf damage (measured from colour)</th><td>{ds.affected_leaf_percentage == null ? 'Not measurable' : `${ds.affected_leaf_percentage.toFixed(1)}% of the leaf`}</td></tr>
            <tr><th>Stage</th><td>{ds.staging.stage_name} — {ds.staging.severity_tag}</td></tr>
            <tr><th>Urgency</th><td>{ds.staging.urgency}</td></tr>
            <tr><th>Outlook</th><td>{ds.staging.prognosis}</td></tr>
          </tbody></table>
          <h3>Checks computed from this photo</h3>
          <ul className="pr-checks">
            {ds.validation_checklist.map(c => <li key={c.id}><b>{c.verified ? '✔ Passed' : '✘ Not met'}</b> — {c.title}: {c.description}</li>)}
          </ul>
          <h3>Suggested actions</h3>
          <ul>{ds.triage_actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      )}

      {report && (
        <section className="pr-section">
          <h2>3. What the AI looked at</h2>
          <div className="pr-grid">
            {METHODS.map(({ id, label }) => { const src = hm(id); return src ? <figure key={id}><img src={src} alt={label} /><figcaption>{label}</figcaption></figure> : null; })}
          </div>
        </section>
      )}

      {q && (
        <section className="pr-section">
          <h2>4. How far to trust the explanation</h2>
          <table><tbody>
            <tr><th>Faithfulness</th><td>{pct(q.faithfulness?.faithfulness_score, 100)} (a random heatmap scores {pct(q.faithfulness?.random_baseline_score, 100)})</td></tr>
            <tr><th>Stability</th><td>{pct(q.stability_score, 100)}</td></tr>
            <tr><th>Consistency</th><td>{pct(q.consistency?.mean_consistency, 100)}</td></tr>
            <tr><th>Robustness</th><td>{pct(q.robustness_score, 100)}</td></tr>
            <tr><th>Sparsity</th><td>{pct(q.sparsity?.sparsity_score, 100)}</td></tr>
            <tr><th>Localization on leaf</th><td>{pct(q.localization_score, 100)}</td></tr>
          </tbody></table>
        </section>
      )}

      {(cf || concepts?.length) && (
        <section className="pr-section">
          <h2>5. Supporting evidence</h2>
          {cf && <p><b>Counterfactual test:</b> with the suspected lesions painted out, confidence in this diagnosis fell from {cf.original_disease_confidence.toFixed(1)}% to {cf.counterfactual_disease_confidence.toFixed(1)}% (a drop of {cf.confidence_drop.toFixed(1)} points).</p>}
          {!!concepts?.length && (
            <table><thead><tr><th>Visual concept</th><th>Score</th></tr></thead>
              <tbody>{concepts.map(c => <tr key={c.concept_id}><td>{c.name}</td><td>{c.score.toFixed(1)}</td></tr>)}</tbody></table>
          )}
        </section>
      )}

      <section className="pr-section">
        <h2>6. Guidance</h2>
        {!insight && <p>{insightLoading ? 'The written guidance was still loading when this report was printed. Print again once it appears.' : 'Written guidance is not available for this analysis.'}</p>}
        {insight?.source === 'unavailable' && <p>{insight.explanation}</p>}
        {insight && insight.source !== 'unavailable' && guidance.map(([title, text]) => text ? (
          <div key={title}><h3>{title}</h3><ul>{parseBulletPoints(text).map((b, i) => <li key={i}>{b}</li>)}</ul></div>
        ) : null)}
      </section>

      <footer className="pr-note">
        This report is decision support, not a laboratory result. Leaf damage is measured from pixel colour and is most reliable on a single leaf against a plain background.
        Heatmaps show where the model looked, not proof of cause. Follow product labels and local rules for any treatment, and confirm with a local agronomist before large-scale action.
      </footer>
    </div>
  );
}
