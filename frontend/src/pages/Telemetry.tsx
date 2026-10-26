import { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, Sliders,
  Activity, Scale, Eye
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { CROP_FAIRNESS, EXPLANATION_AGREEMENT, HEADLINE, PATHOGEN_GROUPS, TELEMETRY_10D } from '../generated/metrics';

const FAIRNESS_CROPS = CROP_FAIRNESS;
const TEN_D_TELEMETRY = TELEMETRY_10D;

const GOOD = ['Resilient', 'Calibrated', 'Equitable', 'Concordant', 'Real-time', 'Robust', 'Negligible', 'Leaf-focused'];
const BAD = ['Fragile', 'Vulnerable', 'Divergent', 'Overconfident', 'Uneven', 'Notable', 'Slow'];

function statusTone(status: string) {
  if (GOOD.includes(status)) return { bg: 'rgba(16, 185, 129, 0.1)', fg: '#10b981' };
  if (BAD.includes(status)) return { bg: 'rgba(244, 63, 94, 0.1)', fg: '#f43f5e' };
  return { bg: 'rgba(99, 102, 241, 0.1)', fg: '#6366f1' };
}

export default function TelemetryPage() {
  const [activeTab, setActiveTab] = useState<'10d' | 'fairness' | 'calibration' | 'xai_consensus'>('10d');

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <PageHeader
        icon={<ShieldCheck size={13} />}
        eyebrow="Trust, Safety & 10D Telemetry Audit"
        title="Can We Trust It?"
        description="We stress-tested this AI against blurry photos, bad lighting, deliberate tampering, and unfair bias across different crops — covering Calibration (ECE), Fairness Parity, and Out-of-Distribution (OOD) rejection — so you know exactly when to trust a result."
      />

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 20px' }}>
        {/* TABS */}
        <div style={{ display: 'flex', gap: 8, marginTop: 32, borderBottom: '1px solid var(--border-light)', paddingBottom: 12, overflowX: 'auto' }}>
          {[
            { id: '10d', label: '10D Telemetry Suite', icon: <Activity size={15} /> },
            { id: 'fairness', label: 'Fairness Parity', icon: <Scale size={15} /> },
            { id: 'calibration', label: 'Calibration (ECE)', icon: <Sliders size={15} /> },
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
                    background: statusTone(d.status).bg,
                    color: statusTone(d.status).fg,
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
              Fairness Parity — Crop Species Subgroup Parity (Equalized Odds)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              Tested on {HEADLINE.testImagesLabel} real leaf photos across different crops. The lowest-to-highest crop accuracy ratio is {HEADLINE.fairnessRatio}; the closer to 1, the more evenly the AI performs across crops.
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
              Accuracy by Disease Type
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              We checked that the AI doesn't miss certain types of disease more than others — fungal, bacterial, viral, or pest damage.
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
              Measured on all {HEADLINE.testImagesLabel} test photos to check that the AI's stated confidence matches how often it is really right.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Expected Calibration Error (ECE)</span>
                  <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>{HEADLINE.eceValue} ({HEADLINE.ece})</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Below 0.05 means the confidence the AI states is close to how often it is really right.
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Brier Probability Score</span>
                  <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>{HEADLINE.brier}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Mean squared difference between predicted probabilities and actual one-hot outcomes.
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Maximum Calibration Error (MCE)</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>{HEADLINE.mce}</span>
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
              Attribution Agreement — Cross-Method Intersection-over-Union (IoU)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 24px' }}>
              We compare where 3 different explanation methods point to on the same leaf. High overlap is a good sign
              they're all picking up on the real disease, not something irrelevant.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {EXPLANATION_AGREEMENT.map(item => (
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
