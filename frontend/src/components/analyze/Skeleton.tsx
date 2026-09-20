import { motion } from 'motion/react';

export function SkeletonBlock({ height = 16, width = '100%', radius = 8 }: { height?: number | string; width?: number | string; radius?: number }) {
  return <div className="skeleton-block" style={{ height, width, borderRadius: radius }} />;
}

export function SkeletonCard({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card-light neo-elevated"
      style={{ width: '100%', minWidth: 0 }}
    >
      <div className="card-light-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="skeleton-spinner" />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>{label}</span>
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} width={i === lines - 1 ? '60%' : '100%'} />
        ))}
      </div>
    </motion.div>
  );
}
