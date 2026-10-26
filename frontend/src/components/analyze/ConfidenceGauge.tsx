import { motion } from 'motion/react';

export default function ConfidenceGauge({ value, label = 'CONFIDENCE' }: { value: number; label?: string }) {
  const R = 43;
  const circ = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circ - (clamped / 100) * circ;
  const color = clamped >= 90 ? '#00b87c' : clamped >= 70 ? '#f59e0b' : '#ef4444';
  const isThreeDigits = clamped >= 99.5;

  return (
    <div className="neo-gauge-wrap">
      <div className="neo-gauge-well">
        <svg className="neo-gauge-svg" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="cg-neo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={color} />
              <stop offset="100%" stopColor="#00c4cc" />
            </linearGradient>
            <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={color} floodOpacity="0.45" />
            </filter>
          </defs>
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--bg-subtle)" strokeWidth="7.5" opacity="0.6" />
          <motion.circle
            cx="60" cy="60" r={R} fill="none"
            stroke="url(#cg-neo)" strokeWidth="7.5" strokeLinecap="round"
            strokeDasharray={circ}
            filter="url(#gauge-glow)"
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="neo-gauge-content">
          <div className="neo-gauge-number">
            <motion.span
              key={Math.round(clamped)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={isThreeDigits ? 'neo-num-100' : 'neo-num-normal'}
            >
              {clamped.toFixed(0)}
            </motion.span>
            <span className="neo-gauge-percent">%</span>
          </div>
          <span className="neo-gauge-pill">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
