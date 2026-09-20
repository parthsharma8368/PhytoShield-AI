export function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="neo-stat-chip">
      <div style={{ fontSize:'1.05rem', fontWeight:800, color, lineHeight:1, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
        {value}
      </div>
      <div style={{ fontSize:'0.62rem', color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:3 }}>
        {label}
      </div>
    </div>
  );
}

export function SymptomBar({ name, pct, color }: { name: string; pct: number; color: string }) {
  return (
    <div className="neo-symptom-item">
      <div className="neo-symptom-head">
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}80` }} />
          <span className="neo-symptom-name">{name}</span>
        </div>
        <span className="neo-symptom-val" style={{ color }}>{pct}%</span>
      </div>
      <div className="neo-bar-track">
        <div className="neo-bar-fill" style={{ width: `${pct}%`, background: color, boxShadow:`0 0 8px ${color}50` }} />
      </div>
    </div>
  );
}
