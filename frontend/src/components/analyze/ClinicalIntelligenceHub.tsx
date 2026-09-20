import { useState } from 'react';
import { Dna, Activity, Check, Pill, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { ClinicalTab, InsightResult } from './types';
import { parseBulletPoints } from './utils';

export default function ClinicalIntelligenceHub({
  insight,
}: {
  insight: InsightResult;
}) {
  const [activeTab, setActiveTab] = useState<ClinicalTab>('pathology');

  const tabs: { id: ClinicalTab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'pathology',   label: 'Pathology & Biology', icon: <Dna size={14} />,         color: '#00c4cc' },
    { id: 'treatment',   label: 'Treatment & Rx',      icon: <Pill size={14} />,        color: '#8b5cf6' },
    { id: 'prevention',  label: 'Prevention',          icon: <ShieldCheck size={14} />, color: '#10b981' },
    { id: 'precautions', label: 'Field Precautions',   icon: <AlertTriangle size={14} />, color: '#f59e0b' },
  ];

  const treatmentBullets  = parseBulletPoints(insight.cure);
  const preventionBullets = parseBulletPoints(insight.prevention);
  const precautionBullets = parseBulletPoints(insight.precautions);
  const pathologyBullets  = parseBulletPoints(insight.explanation);

  return (
    <div className="neo-hub-card">
      <div className="neo-hub-header">
        <div className="neo-hub-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="neo-hub-badge-icon">
              <Pill size={15} />
            </div>
            <div>
              <h3 className="neo-hub-title">Pathology & Agronomic Intelligence</h3>
              <p className="neo-hub-subtitle">Botanical disease mechanism, treatment protocols & prevention strategies</p>
            </div>
          </div>
        </div>

        <div className="neo-tab-bar">
          {tabs.map(t => {
            const isAct = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`neo-tab-btn ${isAct ? 'active' : ''}`}
                style={{
                  color: isAct ? t.color : 'var(--text-muted)',
                  borderColor: isAct ? `${t.color}40` : 'transparent',
                }}
              >
                <span className="neo-tab-icon" style={{ color: isAct ? t.color : 'inherit' }}>
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="neo-tab-body">
        {activeTab === 'pathology' && (
          <div className="neo-tab-pane">
            <div className="neo-pane-head">
              <span className="neo-pane-pill" style={{ background: 'rgba(0,196,204,0.12)', color: '#00c4cc' }}>
                Biological Disease Pathology
              </span>
            </div>

            <div className="neo-grid-2col">
              <div className="neo-card-sub">
                <div className="neo-card-sub-title" style={{ color: '#00c4cc' }}>
                  <Dna size={14} /> Pathogen & Biology Overview
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: 1.65 }}>
                  {insight.explanation}
                </p>
              </div>

              <div className="neo-card-sub">
                <div className="neo-card-sub-title" style={{ color: '#00b87c' }}>
                  <Activity size={14} /> Diagnostic Symptoms & Markers
                </div>
                <div className="neo-bullet-list">
                  {pathologyBullets.map((b, i) => (
                    <div key={i} className="neo-bullet-item">
                      <Check size={13} color="#00b87c" style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'treatment' && (
          <div className="neo-tab-pane">
            <div className="neo-pane-head">
              <span className="neo-pane-pill" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                Agronomic Treatment & Cure Protocol
              </span>
            </div>

            <div className="neo-bullet-list">
              {treatmentBullets.map((t, idx) => (
                <div key={idx} className="neo-step-card">
                  <div className="neo-step-num" style={{ background: '#8b5cf6' }}>
                    {idx + 1}
                  </div>
                  <div className="neo-step-content">
                    <div className="neo-step-title">Actionable Recommendation #{idx + 1}</div>
                    <div className="neo-step-desc">{t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'prevention' && (
          <div className="neo-tab-pane">
            <div className="neo-pane-head">
              <span className="neo-pane-pill" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                Long-Term Prevention Strategies
              </span>
            </div>

            <div className="neo-bullet-list">
              {preventionBullets.map((p, idx) => (
                <div key={idx} className="neo-step-card">
                  <div className="neo-step-num" style={{ background: '#10b981' }}>
                    <ShieldCheck size={14} />
                  </div>
                  <div className="neo-step-content">
                    <div className="neo-step-title">Defense Strategy #{idx + 1}</div>
                    <div className="neo-step-desc">{p}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'precautions' && (
          <div className="neo-tab-pane">
            <div className="neo-pane-head">
              <span className="neo-pane-pill" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                Immediate Field Precautions
              </span>
            </div>

            <div className="neo-bullet-list">
              {precautionBullets.map((item, idx) => (
                <div key={idx} className="neo-step-card neo-step-warning">
                  <div className="neo-step-num" style={{ background: '#f59e0b' }}>
                    <AlertTriangle size={14} />
                  </div>
                  <div className="neo-step-content">
                    <div className="neo-step-title" style={{ color: '#f59e0b' }}>Precautionary Rule #{idx + 1}</div>
                    <div className="neo-step-desc">{item}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
