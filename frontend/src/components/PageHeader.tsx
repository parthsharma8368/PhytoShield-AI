import type { ReactNode } from 'react';
import { motion } from 'motion/react';

export default function PageHeader({
  icon,
  eyebrow,
  title,
  description,
  accentColor = '#10b981',
  actions,
  maxWidth = 1200,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
  accentColor?: string;
  actions?: ReactNode;
  maxWidth?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ maxWidth, margin: '0 auto', padding: '40px 24px 24px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span
          className="badge-tech"
          style={{ background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}33` }}
        >
          <span style={{ display: 'inline-flex', marginRight: 5 }}>{icon}</span>
          {eyebrow}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 10px' }}>
            {title}
          </h1>
          {description && (
            <p style={{ color: 'var(--text-body)', fontSize: '1.05rem', maxWidth: 780, margin: 0, lineHeight: 1.6 }}>
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
    </motion.section>
  );
}
