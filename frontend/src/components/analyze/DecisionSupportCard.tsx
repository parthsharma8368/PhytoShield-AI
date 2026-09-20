import { useState } from 'react';
import { ShieldAlert, Check } from 'lucide-react';
import type { DecisionSupportItem } from './types';

export default function DecisionSupportCard({ decision }: { decision: DecisionSupportItem }) {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const staging = decision.staging;
  const checklist = decision.validation_checklist || [];
  const totalChecks = checklist.length;
  const passedChecks = checklist.filter(item => checkedIds[item.id] !== undefined ? checkedIds[item.id] : item.verified).length;
  const validationPct = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
  const triageActions = decision.triage_actions || [];

  return (
    <div className="neo-decision-card">
      <div className="neo-decision-head">
        <div className="neo-decision-title">
          <ShieldAlert size={18} color={staging?.color || '#00b87c'} />
          <span>Foliar Staging & Agronomist Decision-Support</span>
        </div>
        {staging && (
          <div
            className="neo-decision-stage-badge"
            style={{
              background: `${staging.color || '#00b87c'}18`,
              color: staging.color || '#00b87c',
              border: `1.5px solid ${staging.color || '#00b87c'}40`,
            }}
          >
            {staging.stage_name} • {staging.severity_tag}
          </div>
        )}
      </div>

      <div className="neo-decision-grid">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Foliar Necrosis / Lesion Area
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: staging?.color || '#00b87c', fontFamily: "'JetBrains Mono', monospace" }}>
              {(decision.affected_leaf_percentage ?? 0).toFixed(1)}% of Leaf
            </span>
          </div>

          <div className="neo-bar-track" style={{ height: 8, marginBottom: 20 }}>
            <div
              className="neo-bar-fill"
              style={{
                width: `${Math.min(100, decision.affected_leaf_percentage ?? 0)}%`,
                background: staging?.color || '#00b87c',
                boxShadow: `0 0 10px ${(staging?.color || '#00b87c')}60`,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Agronomist Validation Checklist
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#00b87c' }}>
              {passedChecks}/{totalChecks} Criteria Verified ({validationPct}%)
            </span>
          </div>

          <div className="neo-checklist-container">
            {checklist.map(item => {
              const isChecked = checkedIds[item.id] !== undefined ? checkedIds[item.id] : item.verified;
              return (
                <div
                  key={item.id}
                  className={`neo-check-item ${isChecked ? 'checked' : ''}`}
                  onClick={() => toggleCheck(item.id)}
                >
                  <div className="neo-check-box">
                    {isChecked ? <Check size={14} /> : null}
                  </div>
                  <div className="neo-check-content">
                    <div className="neo-check-question">{item.title}</div>
                    <div className="neo-check-guide">{item.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
            Actionable Precision Triage Protocols
          </div>

          <div className="neo-triage-list">
            {triageActions.map((actionText, idx) => {
              const priority = idx + 1;
              const category = priority === 1 ? 'Curative Intervention' : priority === 2 ? 'Spread Isolation' : 'Sanitation & Prevention';
              return (
                <div key={idx} className={`neo-triage-item priority-${priority}`}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        className="neo-triage-badge"
                        style={{
                          background: priority === 1 ? '#fee2e2' : priority === 2 ? '#fef3c7' : '#e0f2fe',
                          color: priority === 1 ? '#ef4444' : priority === 2 ? '#b45309' : '#0284c7',
                        }}
                      >
                        Priority {priority} • {category}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 2 }}>
                      {actionText}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {staging?.urgency || 'Field agronomist standard procedure.'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {decision.decision_impact_summary && (
            <div style={{ marginTop: 14, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
              {decision.decision_impact_summary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
