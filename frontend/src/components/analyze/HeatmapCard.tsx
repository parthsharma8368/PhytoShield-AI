import { motion } from 'motion/react';
import { Eye } from 'lucide-react';

export default function HeatmapCard({ src, label, color, active, onClick }: {
  src: string; label: string; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={`neo-hmap-card ${active ? 'active' : ''}`}
      style={{
        border:`1.5px solid ${active ? color : 'var(--border-light)'}`,
        boxShadow: active ? `0 8px 24px ${color}35, var(--neo-shadow-soft)` : 'var(--neo-shadow-soft)',
      }}
    >
      <div className="neo-hmap-head" style={{
        background: active ? `${color}18` : 'var(--bg-subtle)',
        borderBottom: `1px solid ${active ? `${color}35` : 'var(--border-light)'}`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{
            width:7, height:7, borderRadius:'50%', background:color,
            boxShadow: active ? `0 0 8px ${color}` : 'none'
          }} />
          <span style={{ fontSize:'0.75rem', fontWeight:800, color: active ? color : 'var(--text-main)' }}>{label}</span>
        </div>
        {active ? (
          <span style={{ fontSize:'0.62rem', fontWeight:800, color:color, background:`${color}25`, padding:'2px 7px', borderRadius:99 }}>
            Active
          </span>
        ) : (
          <Eye size={12} color="var(--text-muted)" />
        )}
      </div>
      <img src={src} alt={label} className="neo-hmap-img" />
    </motion.div>
  );
}
