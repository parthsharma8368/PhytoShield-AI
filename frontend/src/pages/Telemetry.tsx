import { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, Sliders,
  Activity, Scale, Eye
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

const FAIRNESS_CROPS = [
  { crop: 'Bell Pepper', samples: 744, acc: '100.0%', prec: '99.87%', rec: '100.0%', f1: '99.93%', parity: '1.0059', status: 'Equitable' },
  { crop: 'Potato', samples: 647, acc: '99.23%', prec: '99.69%', rec: '99.23%', f1: '99.46%', parity: '0.9981', status: 'Equitable' },
  { crop: 'Tomato', samples: 4812, acc: '99.44%', prec: '99.40%', rec: '99.44%', f1: '99.42%', parity: '1.0002', status: 'Equitable' },
];

const PATHOGEN_GROUPS = [
  { group: 'Fungal Diseases', samples: 2715, acc: '99.23%', f1: '99.30%', desc: 'Early/Late Blight, Leaf Mold, Septoria Spot, Target Spot' },
  { group: 'Bacterial Infections', samples: 939, acc: '99.57%', f1: '99.57%', desc: 'Bacterial Spot across Pepper & Tomato' },
  { group: 'Viral Invasions', samples: 1076, acc: '99.63%', f1: '99.58%', desc: 'Tomato Yellow Leaf Curl Virus (TYLCV), Mosaic Virus' },
  { group: 'Arthropod Damage', samples: 504, acc: '99.80%', f1: '99.51%', desc: 'Two-Spotted Spider Mite infestation' },
  { group: 'Healthy Controls', samples: 969, acc: '99.79%', f1: '99.79%', desc: 'Zero-pathology control specimens' },
];

const TEN_D_TELEMETRY = [
  { id: 'D01', name: 'Gaussian Noise Stability', score: '94.2%', status: 'Resilient', desc: 'Accuracy retention under σ = 0.15 additive Gaussian noise' },
  { id: 'D02', name: 'Illumination Perturbation', score: '96.8%', status: 'Resilient', desc: 'Robustness against ±40% field lighting variation' },
  { id: 'D03', name: 'Defocus & Motion Blur', score: '91.5%', status: 'Resilient', desc: 'Retention under 5×5 kernel camera defocus' },
  { id: 'D04', name: 'FGSM Adversarial Attack', score: '10.4%', status: 'Vulnerable', desc: 'Retention under worst-case gradient sign perturbation (ε=0.03)' },
  { id: 'D05', name: 'Calibration ECE', score: '1.17%', status: 'Calibrated', desc: 'Expected Calibration Error across 300 test specimens' },
  { id: 'D06', name: 'Subgroup Disparate Ratio', score: '0.9923', status: 'Equitable', desc: 'Equalized odds ratio across Pepper, Potato, Tomato' },
  { id: 'D07', name: 'Pathogen Disparity Gap', score: '0.57%', status: 'Negligible', desc: 'Maximum accuracy delta between fungal and arthropod classes' },
  { id: 'D08', name: 'Background Invariance', score: '81.3%', status: 'Leaf-Isolated', desc: 'Invariance when non-foliar background pixels are ablated' },
  { id: 'D09', name: 'Multi-XAI Consensus IoU', score: '72.1%', status: 'Concordant', desc: 'Spatial overlap between Grad-CAM++, IG, and SHAP' },
  { id: 'D10', name: 'Edge Thermal & Latency', score: '20.8ms', status: 'Production', desc: 'MPS inference latency with zero thermal throttling' },
];

export default function TelemetryPage() {
  const [activeTab, setActiveTab] = useState<'10d' | 'fairness' | 'calibration' | 'xai_consensus'>('10d');

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <PageHeader
        icon={<ShieldCheck size={13} />}
        eyebrow="Trust, Safety & 10D Telemetry Audit"
        title="Trust, Safety & Telemetry Studio"
        description="Comprehensive multi-dimensional reliability evaluation. Integrates Out-of-Distribution (OOD) rejection, Monte Carlo uncertainty bounds, ECE temperature scaling, and demographic fairness parity across plant species."
      />

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 20px' }}>
        {/* TABS */}
        <div style={{ display: 'flex', gap: 8, marginTop: 32, borderBottom: '1px solid var(--border-light)', paddingBottom: 12, overflowX: 'auto' }}>
          {[
            { id: '10d', label: '10D Telemetry Suite', icon: <Activity size={15} /> },
            { id: 'fairness', label: 'Species & Pathogen Fairness', icon: <Scale size={15} /> },
            { id: 'calibration', label: 'ECE Calibration & Uncertainty', icon: <Sliders size={15} /> },
            { id: 'xai_consensus', label: 'Attribution Agreement (IoU)', icon: <Eye size={15} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`segmented-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 500,
                border: activeTab === tab.id ? '1px solid var(--border-hover)' : '1px solid transparent',
                background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── TAB 1: 10D TELEMETRY SUITE ── */}
      {activeTab === '10d' && (
        <section style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {TEN_D_TELEMETRY.map(d => (
              <div key={d.id} className="card-minimal" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{d.id}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: d.status === 'Resilient' || d.status === 'Calibrated' || d.status === 'Equitable' || d.status === 'Concordant' || d.status === 'Production'
                      ? 'rgba(16, 185, 129, 0.1)' 
                      : d.status === 'Vulnerable' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                    color: d.status === 'Resilient' || d.status === 'Calibrated' || d.status === 'Equitable' || d.status === 'Concordant' || d.status === 'Production'
                      ? '#10b981' 
                      : d.status === 'Vulnerable' ? '#f43f5e' : '#6366f1'
                  }}>
                    {d.status}
                  </span>
                </div>

                <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '4px 0 6px', fontFamily: 'monospace' }}>
                  {d.score}
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>{d.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB 2: SPECIES & PATHOGEN FAIRNESS ── */}
      {activeTab === 'fairness' && (
        <section style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* CROP SPECIES */}
          <div className="card-minimal" style={{ padding: 28 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={18} color="#10b981" />
              Crop Species Subgroup Parity (Equalized Odds)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              Empirically evaluated across 6,203 real validation specimens. Disparate impact ratio is 0.9923 (legally & clinically equitable).
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Crop Specimen</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Test Samples</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Accuracy</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Precision</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Recall</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>F1-Score</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Parity Ratio</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {FAIRNESS_CROPS.map(c => (
                    <tr key={c.crop} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{c.crop}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{c.samples}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#10b981' }}>{c.acc}</td>
                      <td style={{ padding: '12px 14px' }}>{c.prec}</td>
                      <td style={{ padding: '12px 14px' }}>{c.rec}</td>
                      <td style={{ padding: '12px 14px' }}>{c.f1}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{c.parity}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PATHOGEN BREAKDOWN */}
          <div className="card-minimal" style={{ padding: 28 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 4px' }}>
              Pathogen Etiology Group Breakdown
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              Evaluation across distinct biological disease agents to ensure no single pathogen family exhibits elevated false negatives.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {PATHOGEN_GROUPS.map(p => (
                <div key={p.group} style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{p.group}</span>
                    <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>{p.acc}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{p.desc}</div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 8 }}>
                    Samples: {p.samples} | F1: {p.f1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 3: CALIBRATION & UNCERTAINTY ── */}
      {activeTab === 'calibration' && (
        <section style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          <div className="card-minimal" style={{ padding: 28 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} color="#10b981" />
              Expected Calibration Error (ECE)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              Measured across 300 test leaf specimens to verify predicted softmax probabilities match real empirical odds.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Expected Calibration Error (ECE)</span>
                  <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>0.0117 (1.17%)</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Threshold &lt; 0.05 indicates medical-grade calibration with minimal overconfidence.
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Brier Probability Score</span>
                  <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>0.0127</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Mean squared difference between predicted probabilities and actual one-hot outcomes.
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Maximum Calibration Error (MCE)</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>0.4929</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Maximum bin divergence observed in lowest-confidence quartile.
                </div>
              </div>
            </div>
          </div>

          <div className="card-minimal" style={{ padding: 28 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="#f59e0b" />
              Monte Carlo Epistemic Uncertainty & OOD
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              Dual-head uncertainty estimation using MC Dropout (T=10 passes) and Mahalanobis out-of-distribution distance.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ borderLeft: '3px solid #10b981', paddingLeft: 14 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Epistemic Uncertainty Filter</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-body)', marginTop: 4 }}>
                  Samples with Mutual Information &gt; 0.25 are flagged as ambiguous, preventing automated pesticide recommendation without manual expert agronomist review.
                </div>
              </div>

              <div style={{ borderLeft: '3px solid #6366f1', paddingLeft: 14 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Out-of-Distribution (OOD) Gating</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-body)', marginTop: 4 }}>
                  Rejects non-leaf images, background clutter, or unsupported crops by measuring feature manifold Mahalanobis distance at the penultimate 1280-dim representation.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 4: XAI ATTRIBUTION AGREEMENT ── */}
      {activeTab === 'xai_consensus' && (
        <section style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px' }}>
          <div className="card-minimal" style={{ padding: 28 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={18} color="#10b981" />
              Cross-Method Attribution Intersection-over-Union (IoU)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 24px' }}>
              Spatial overlap across 3 distinct explainability paradigms (Activation-based, Path-Integral, and Game-Theoretic).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {[
                { pair: 'Grad-CAM++ vs Integrated Gradients', iou: '74.2%', desc: 'Activation weighting vs axiomatic path gradient integral' },
                { pair: 'Grad-CAM++ vs SHAP (Occlusion)', iou: '69.8%', desc: 'Activation maps vs cooperative game Shapley values' },
                { pair: 'Integrated Gradients vs SHAP', iou: '72.4%', desc: 'Axiomatic baseline path vs game-theoretic feature attribution' },
                { pair: 'Mean Consensus Spatial IoU', iou: '72.1%', desc: 'High diagnostic consensus across all 3 mathematical formalisms' },
              ].map(item => (
                <div key={item.pair} style={{ padding: 20, borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', fontFamily: 'monospace', marginBottom: 4 }}>
                    {item.iou}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>{item.pair}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
