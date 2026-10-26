import { Scale } from 'lucide-react';
import { motion } from 'motion/react';
import type { ExplanationQualityMetrics } from './types';

export default function ExplanationQualityCard({ metrics }: { metrics: ExplanationQualityMetrics }) {
  const items = [
    {
      name: 'Faithfulness',
      val: metrics.faithfulness?.faithfulness_score,
      desc: metrics.faithfulness?.random_baseline_score != null
        ? `Does hiding the highlighted regions change the AI's answer? A random highlight scores about ${Math.round(metrics.faithfulness.random_baseline_score * 100)}%.`
        : 'Does hiding the highlighted regions change the AI\'s answer?',
      color: '#00b87c',
    },
    {
      name: 'Stability',
      val: metrics.stability_score,
      desc: 'Does the explanation stay consistent if the photo has slight grain or noise?',
      color: '#00c4cc',
    },
    {
      name: 'Consistency',
      val: metrics.consistency?.mean_consistency,
      desc: 'Do all 4 explanation methods agree on where the disease actually is?',
      color: '#8b5cf6',
    },
    {
      name: 'Robustness',
      val: metrics.robustness_score,
      desc: 'Does the explanation still hold up under different lighting conditions?',
      color: '#f59e0b',
    },
    {
      name: 'Sparsity',
      val: metrics.sparsity?.sparsity_score,
      desc: 'Does the AI point to a few focused disease spots, rather than the whole leaf?',
      color: '#ec4899',
    },
    {
      name: 'Localization',
      val: metrics.localization_score,
      desc: 'Does the AI\'s attention actually stay on the leaf, not the background?',
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
        {items.map((it, i) => {
          const hasVal = typeof it.val === 'number';
          const clampedVal = hasVal ? Math.min(1.0, Math.max(0.0, it.val as number)) : 0;
          return (
            <motion.div
              key={it.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="neo-metric-box"
            >
              <div className="neo-metric-top">
                <span className="neo-metric-name">{it.name}</span>
                <span className="neo-metric-val" style={{ color: hasVal ? it.color : 'var(--text-muted)' }}>
                  {hasVal ? `${(clampedVal * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="neo-bar-track" style={{ height: 4, margin: '4px 0' }}>
                <motion.div
                  className="neo-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: hasVal ? `${clampedVal * 100}%` : '0%' }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: it.color }}
                />
              </div>
              <span className="neo-metric-sub">{it.desc}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
