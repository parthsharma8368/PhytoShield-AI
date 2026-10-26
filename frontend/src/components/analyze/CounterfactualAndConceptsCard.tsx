import { useState } from 'react';
import { motion } from 'motion/react';
import { Target, Layers, Gauge } from 'lucide-react';
import type { CounterfactualData, BotanicalConceptsResponse, UncertaintyData } from './types';

function metricOrDash(val: number | undefined, digits: number): string {
  return typeof val === 'number' ? val.toFixed(digits) : '—';
}

export default function CounterfactualAndConceptsCard({
  counterfactual,
  concepts,
  uncertainty,
  previewSrc,
}: {
  counterfactual?: CounterfactualData;
  concepts?: BotanicalConceptsResponse;
  uncertainty?: UncertaintyData;
  previewSrc: string | null;
}) {
  const [subTab, setSubTab] = useState<'counterfactual' | 'concepts' | 'uncertainty'>('counterfactual');

  const origConf = counterfactual?.original_disease_confidence ?? 0;
  const cfConf = counterfactual?.counterfactual_disease_confidence ?? 0;
  const confDrop = counterfactual?.confidence_drop ?? (origConf - cfConf);
  const lesionPct = counterfactual?.lesion_surface_percentage ?? 0;

  return (
    <div className="neo-cf-cbm-wrap">
      <div className="neo-cf-cbm-nav">
        <button
          className={`neo-cf-nav-btn ${subTab === 'counterfactual' ? 'active' : ''}`}
          onClick={() => setSubTab('counterfactual')}
        >
          <Target size={15} />
          <span>What If It Wasn't There?</span>
        </button>
        <button
          className={`neo-cf-nav-btn ${subTab === 'concepts' ? 'active' : ''}`}
          onClick={() => setSubTab('concepts')}
        >
          <Layers size={15} />
          <span>Symptoms It Detected</span>
        </button>
        <button
          className={`neo-cf-nav-btn ${subTab === 'uncertainty' ? 'active' : ''}`}
          onClick={() => setSubTab('uncertainty')}
        >
          <Gauge size={15} />
          <span>Uncertainty & Calibration</span>
        </button>
      </div>

      <div className="neo-cf-cbm-body">
        {subTab === 'counterfactual' && counterfactual && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                Testing Cause and Effect
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                {counterfactual.narrative_explanation}
              </p>
            </div>

            <div className="neo-cf-image-trio">
              <div className="neo-cf-img-card">
                <img src={previewSrc || ''} alt="Original Specimen" />
                <div className="neo-cf-img-label">
                  Original Photo ({origConf.toFixed(1)}% sure)
                </div>
              </div>

              <div className="neo-cf-img-card">
                <img src={counterfactual.difference_map_b64} alt="Difference Mask" />
                <div className="neo-cf-img-label">
                  What Changed
                </div>
              </div>

              <div className="neo-cf-img-card">
                <img src={counterfactual.counterfactual_image_b64} alt="Neutralized Leaf" />
                <div className="neo-cf-img-label">
                  With Disease Spots Erased ({cfConf.toFixed(1)}% sure)
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0, 184, 124, 0.08)',
              border: '1px solid rgba(0, 184, 124, 0.25)',
              padding: '12px 16px',
              borderRadius: 12,
              flexWrap: 'wrap',
              gap: 10
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Confidence Dropped By:
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: confDrop >= 0 ? '#ef4444' : '#10b981', marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                  {confDrop >= 0 ? '-' : '+'}{Math.abs(confDrop).toFixed(1)}%
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Disease Covers:
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#00b87c', marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                  {lesionPct.toFixed(1)}% of the leaf
                </span>
              </div>
            </div>
          </div>
        )}

        {subTab === 'concepts' && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                Symptoms the AI Detected
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                {concepts?.botanical_reasoning_summary}
              </p>
            </div>

            {(concepts?.concepts || []).map((c, i) => {
              const scoreVal = typeof c.score === 'number' ? Math.min(100, Math.max(0, c.score)) : 0;
              return (
                <motion.div
                  key={c.concept_id || c.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  className="neo-concept-item"
                >
                  <div className="neo-concept-head">
                    <span className="neo-concept-title">
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00b87c' }} />
                      {c.name}
                    </span>
                    <span className="neo-concept-score">{scoreVal.toFixed(1)}%</span>
                  </div>
                  <div className="neo-bar-track" style={{ height: 6 }}>
                    <motion.div
                      className="neo-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${scoreVal}%` }}
                      transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        background: c.name.includes('Healthy') ? '#10b981' : c.name.includes('Necrosis') ? '#8b5cf6' : '#f59e0b',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span className="neo-concept-desc">{c.pathology_significance || c.clinical_relevance}</span>
                    <span className="neo-concept-marker">Relevance: {c.clinical_relevance}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {subTab === 'uncertainty' && uncertainty && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                Bayesian Monte Carlo Dropout Uncertainty Quantification
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                We ran the analysis multiple times to see how consistent the AI's answer really is,
                not just how confident it sounds on a single try.
              </p>
            </div>

            <div className="neo-quality-grid" style={{ marginBottom: 14 }}>
              <div className="neo-metric-box">
                <span className="neo-metric-name">Epistemic Uncertainty</span>
                <span className="neo-metric-val" style={{ color: '#00b87c' }}>
                  {metricOrDash(uncertainty.epistemic_std, 4)}
                </span>
                <span className="neo-metric-sub">How much the AI's confidence wavered across repeated checks. Lower is better.</span>
              </div>
              <div className="neo-metric-box">
                <span className="neo-metric-name">Uncertainty Score</span>
                <span className="neo-metric-val" style={{ color: '#00c4cc' }}>
                  {metricOrDash(uncertainty.uncertainty_score, 4)}
                </span>
                <span className="neo-metric-sub">An overall score for how unsure the AI is. Lower is better.</span>
              </div>
              <div className="neo-metric-box">
                <span className="neo-metric-name">Predictive Entropy</span>
                <span className="neo-metric-val" style={{ color: '#8b5cf6' }}>
                  {metricOrDash(uncertainty.predictive_entropy, 3)}
                </span>
                <span className="neo-metric-sub">How spread out the AI's guesses were across all possible diseases.</span>
              </div>
              <div className="neo-metric-box">
                <span className="neo-metric-name">Reliability</span>
                <span className="neo-metric-val" style={{ color: '#10b981', fontSize: '0.95rem' }}>
                  {uncertainty.trust_tier ? uncertainty.trust_tier.toUpperCase() : '—'}
                </span>
                <span className="neo-metric-sub">Whether this result falls within a safe, trustworthy range.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
