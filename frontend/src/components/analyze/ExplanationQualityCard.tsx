import { Scale } from 'lucide-react';
import type { ExplanationQualityMetrics } from './types';

export default function ExplanationQualityCard({ metrics }: { metrics: ExplanationQualityMetrics }) {
  const items = [
    {
      name: 'Faithfulness',
      val: metrics.faithfulness?.faithfulness_score,
      desc: 'Pixel Deletion/Insertion AUC. Measures if heatmaps accurately reflect true model decision features.',
      color: '#00b87c',
    },
    {
      name: 'Stability',
      val: metrics.stability_score,
      desc: 'Lipschitz continuity under subtle Gaussian noise. High score means explanations do not jump erratically.',
      color: '#00c4cc',
    },
    {
      name: 'Consistency',
      val: metrics.consistency?.mean_consistency,
      desc: 'Cross-method Spearman correlation. Evaluates agreement across Grad-CAM++, IG, SHAP, and LIME.',
      color: '#8b5cf6',
    },
    {
      name: 'Robustness',
      val: metrics.robustness_score,
      desc: 'Photometric SSIM invariance under realistic lighting and contrast shifts.',
      color: '#f59e0b',
    },
    {
      name: 'Sparsity',
      val: metrics.sparsity?.sparsity_score,
      desc: 'Gini coefficient concentration. Highlights compact, focused lesion regions rather than diffuse noise.',
      color: '#ec4899',
    },
    {
      name: 'Localization',
      val: metrics.localization_score,
      desc: 'Pointing Game foliar energy ratio. Verifies attributions fall inside leaf boundaries.',
      color: '#10b981',
    },
  ];

  return (
    <div className="neo-quality-card">
      <div className="neo-quality-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Scale size={18} color="#00b87c" />
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Quantitative Explanation Quality Evaluation
          </span>
        </div>
        {metrics.composite_xai_quality !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>COMPOSITE QUALITY INDEX:</span>
            <span
              className="metric-time-badge"
              style={{
                fontSize: '0.82rem',
                padding: '4px 10px',
                background: 'rgba(0,184,124,0.15)',
                color: '#00b87c',
                border: '1px solid rgba(0,184,124,0.3)',
              }}
            >
              {(metrics.composite_xai_quality * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="neo-quality-grid">
        {items.map(it => {
          const hasVal = typeof it.val === 'number';
          const clampedVal = hasVal ? Math.min(1.0, Math.max(0.0, it.val as number)) : 0;
          return (
            <div key={it.name} className="neo-metric-box">
              <div className="neo-metric-top">
                <span className="neo-metric-name">{it.name}</span>
                <span className="neo-metric-val" style={{ color: hasVal ? it.color : 'var(--text-muted)' }}>
                  {hasVal ? `${(clampedVal * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="neo-bar-track" style={{ height: 4, margin: '4px 0' }}>
                <div className="neo-bar-fill" style={{ width: hasVal ? `${clampedVal * 100}%` : '0%', background: it.color }} />
              </div>
              <span className="neo-metric-sub">{it.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
