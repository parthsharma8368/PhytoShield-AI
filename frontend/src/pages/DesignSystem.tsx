import { useState } from 'react';
import {
  Palette, Type, Layers, CheckCircle2, AlertTriangle,
  Flame, Sliders, Cpu, Compass
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState<'tokens' | 'components' | 'xai' | 'elevation'>('tokens');

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <PageHeader
        icon={<Compass size={13} />}
        eyebrow="Internal Design Reference"
        title="Pathology Studio Design System"
        description="A minimalist, low-noise visual language designed for clinical plant pathology intelligence. Combines high-density data legibility, calm neutral surfaces, and precise chromatic accents for explainable AI attributions."
      />
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 20px' }}>

        {/* SUB-NAV TABS */}
        <div style={{ display: 'flex', gap: 8, marginTop: 32, borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
          {[
            { id: 'tokens', label: 'Color & Typography Tokens', icon: <Palette size={15} /> },
            { id: 'components', label: 'Clinical Primitives', icon: <Sliders size={15} /> },
            { id: 'xai', label: 'Explainability & Attribution Tokens', icon: <Flame size={15} /> },
            { id: 'elevation', label: 'Surfaces & Elevation', icon: <Layers size={15} /> },
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
                transition: 'all 0.15s ease'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── TAB 1: COLOR & TYPOGRAPHY TOKENS ── */}
      {activeTab === 'tokens' && (
        <section style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* COLOR HARMONY */}
          <div className="card-minimal" style={{ padding: 28 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Palette size={18} color="#10b981" />
              Chromatic Calibration Palette
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 24px' }}>
              Functional, semantic color tokens engineered to avoid visual noise while providing high contrast on lesion heatmaps.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { name: 'Emerald (Primary)', hex: '#10b981', role: 'Healthy control & confirmed diagnosis', contrast: 'AAA' },
                { name: 'Indigo (Cognitive)', hex: '#6366f1', role: 'Neural backbone & feature maps', contrast: 'AAA' },
                { name: 'Amber (Uncertainty)', hex: '#f59e0b', role: 'Epistemic caution & OOD detection', contrast: 'AA' },
                { name: 'Rose (Critical)', hex: '#f43f5e', role: 'Severe foliar necrosis & blights', contrast: 'AAA' },
                { name: 'Slate Canvas', hex: '#090d16', role: 'Deep matte dark workspace', contrast: 'Base' },
                { name: 'Slate Surface', hex: '#111827', role: 'Elevated clinical instrument card', contrast: 'Elevated' }
              ].map(c => (
                <div key={c.name} style={{ borderRadius: 10, border: '1px solid var(--border-light)', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
                  <div style={{ height: 60, background: c.hex }} />
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.hex}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-body)', marginTop: 6, lineHeight: 1.4 }}>{c.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TYPOGRAPHY */}
          <div className="card-minimal" style={{ padding: 28 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Type size={18} color="#6366f1" />
              Pathology Studio Typographic Hierarchy
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
              Plus Jakarta Sans with tabular numerical lining for scientific accuracy in latency, FLOPs, and confidence metrics.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, border: '1px solid var(--border-light)', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Display Headline</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4 }}>
                  99.48% Empirical Validation on 18,609 Test Leaves
                </div>
              </div>

              <div style={{ padding: 16, border: '1px solid var(--border-light)', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Section Tracker Label</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981', marginTop: 4 }}>
                  04 • Monte Carlo Uncertainty & Out-of-Distribution Calibration
                </div>
              </div>

              <div style={{ padding: 16, border: '1px solid var(--border-light)', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Scientific Body & Tabular Numeric</span>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-body)', marginTop: 4, lineHeight: 1.6, fontFamily: 'monospace' }}>
                  Latency: 20.8ms ± 1.2ms (MPS) | ECE: 0.0117 | Params: 4,034,703 | Batch: 32
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 2: CLINICAL PRIMITIVES ── */}
      {activeTab === 'components' && (
        <section style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {/* BADGES & PILLS */}
          <div className="card-minimal" style={{ padding: 24 }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 600 }}>Status & Decision Badges</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <span className="badge-clean badge-emerald">
                <CheckCircle2 size={12} style={{ marginRight: 4 }} />
                Empirically Verified
              </span>
              <span className="badge-clean badge-amber">
                <AlertTriangle size={12} style={{ marginRight: 4 }} />
                High Uncertainty (&gt;0.25 MI)
              </span>
              <span className="badge-clean badge-indigo">
                <Cpu size={12} style={{ marginRight: 4 }} />
                EfficientNet-B0
              </span>
              <span className="badge-clean badge-rose">
                Late Blight (Severe)
              </span>
            </div>
          </div>

          {/* GAUGES */}
          <div className="card-minimal" style={{ padding: 24 }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 600 }}>Calibration Metric Bar</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                  <span>Confidence Likelihood</span>
                  <span style={{ fontWeight: 600 }}>99.82%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '99.82%', height: '100%', background: '#10b981' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                  <span>Epistemic Uncertainty</span>
                  <span style={{ fontWeight: 600 }}>0.014 MI</span>
                </div>
                <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '8%', height: '100%', background: '#6366f1' }} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 3: EXPLAINABILITY TOKENS ── */}
      {activeTab === 'xai' && (
        <section style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px' }}>
          <div className="card-minimal" style={{ padding: 28 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={18} color="#f59e0b" />
              7-Engine Attribution Suite Tokens
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 24px' }}>
              Standardized colormaps and attribution metrics satisfying axiomatic completeness, sensitivity, and implementation invariance.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {[
                { name: 'Grad-CAM', engine: 'Convolutional Activation', colormap: 'Jet / Turbo', speed: '~18ms', axiom: 'Class Discriminative' },
                { name: 'Grad-CAM++', engine: 'Second-Order Taylor', colormap: 'Turbo Enhanced', speed: '~24ms', axiom: 'Multiple Lesion Sensitivity' },
                { name: 'Integrated Gradients', engine: 'Axiomatic Path Integral', colormap: 'Bipolar Diverging', speed: '~95ms', axiom: 'Completeness & Invariance' },
                { name: 'SHAP (Occlusion)', engine: 'Shapley Cooperative Game', colormap: 'Viridis', speed: '~180ms', axiom: 'Fair Feature Allocation' }
              ].map(x => (
                <div key={x.name} style={{ padding: 18, border: '1px solid var(--border-light)', borderRadius: 10, background: 'var(--bg-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{x.name}</span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#10b981' }}>{x.speed}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Algorithm: {x.engine}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Colormap: {x.colormap}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-body)', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 4, marginTop: 8 }}>
                    Axiom: {x.axiom}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 4: SURFACES & ELEVATION ── */}
      {activeTab === 'elevation' && (
        <section style={{ maxWidth: 1200, margin: '24px auto 0', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          <div style={{ padding: 24, borderRadius: 12, border: '1px solid var(--border-light)', background: 'var(--bg-page)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Surface 0: Base Canvas</span>
            <div style={{ fontWeight: 600, marginTop: 4 }}>Canvas Background</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-body)', marginTop: 8 }}>
              Neutral non-reflective surface designed for zero glare during microscopic leaf lesion inspection.
            </p>
          </div>

          <div style={{ padding: 24, borderRadius: 12, border: '1px solid var(--border-light)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ fontSize: '0.75rem', color: '#10b981', textTransform: 'uppercase' }}>Surface 1: Instrument Card</span>
            <div style={{ fontWeight: 600, marginTop: 4 }}>Elevated Card Surface</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-body)', marginTop: 8 }}>
              Clean, hairline-bordered container for clinical readouts, confusion matrix cells, and prescription cards.
            </p>
          </div>

          <div style={{ padding: 24, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(17, 24, 39, 0.75)', backdropFilter: 'blur(16px)' }}>
            <span style={{ fontSize: '0.75rem', color: '#6366f1', textTransform: 'uppercase' }}>Surface 2: Glass Overlay</span>
            <div style={{ fontWeight: 600, marginTop: 4, color: '#f8fafc' }}>Glassmorphic Attribution View</div>
            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: 8 }}>
              Translucent floating layer for Grad-CAM alpha blending and spatial bounding contour overlays.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
