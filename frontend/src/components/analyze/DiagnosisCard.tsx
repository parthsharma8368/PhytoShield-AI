import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import ConfidenceGauge from './ConfidenceGauge';
import { StatChip } from './MiniStats';
import type { QuickResult } from './types';

export default function DiagnosisCard({ quick }: { quick: QuickResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="card-light neo-elevated"
      style={{ borderLeft: '4px solid #00b87c', width: '100%', minWidth: 0 }}
    >
      <div className="card-light-body" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
        <ConfidenceGauge value={quick.confidence} />

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            borderRadius: 99, background: 'var(--green-light)', color: 'var(--green-main)',
            fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8
          }}>
            <CheckCircle2 size={12} /> Diagnosis Confirmed
          </div>
          <h2 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', marginBottom: 4, overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.25 }}>
            {quick.disease_title}
          </h2>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 14, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            Technical name: {quick.class_name}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatChip label="Confidence" value={`${quick.confidence.toFixed(1)}%`} color="#00b87c" />
            <StatChip label="Diagnosis Time" value={`${Math.round(quick.timings.total_seconds * 1000)} ms`} color="#00c4cc" />
            <StatChip label="AI Model" value="EfficientNet-B0" color="#8b5cf6" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
