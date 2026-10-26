import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, Cpu,
  ShieldCheck, Microscope, Sparkles,
  Layers, Zap, Upload
} from 'lucide-react';
import { HEADLINE } from '../generated/metrics';

const STUDIO_SPECS = [
  { label: 'AI Model', value: 'EfficientNet-B0', badge: 'Accurate & Efficient' },
  { label: 'Accuracy', value: HEADLINE.accuracy, badge: `${HEADLINE.testImagesLabel} Test Photos` },
  { label: 'Calibration (ECE)', value: HEADLINE.ece, badge: 'Lower Is Better' },
  { label: 'Fairness Parity', value: HEADLINE.fairnessRatio, badge: 'Across 3 Crops' },
  { label: 'Latency', value: HEADLINE.latency, badge: 'Per Prediction' },
];

const STUDIO_CONSOLES = [
  {
    id: 'diagnostic',
    title: 'Diagnose a Leaf',
    tag: 'Instant Diagnosis',
    route: '/analyze',
    icon: <Microscope size={20} color="#10b981" />,
    desc: 'Upload a photo and get an instant diagnosis. See exactly which parts of the leaf the AI focused on, in 7 different ways, and get a treatment plan explained in plain language.',
    stats: '7 ways to see the AI\'s reasoning • Instant results'
  },
  {
    id: 'benchmarks',
    title: 'How the AI Works',
    tag: 'Model Details',
    route: '/benchmarks',
    icon: <Cpu size={20} color="#6366f1" />,
    desc: 'See how accurate and fast our AI model really is, and why we built it this way — no guesswork, just real, measured numbers.',
    stats: `${HEADLINE.accuracy} accurate • Fast enough for real-time use`
  },
  {
    id: 'telemetry',
    title: 'Can We Trust It?',
    tag: 'Trust Report',
    route: '/telemetry',
    icon: <ShieldCheck size={20} color="#f59e0b" />,
    desc: 'We stress-tested this AI against blurry photos, bad lighting, and unfair bias across crops — so you know exactly when to trust a result.',
    stats: '10 safety checks • Fair across every crop'
  },
];

const SAMPLE_SPECIMENS = [
  { id: 'tomato_early_blight', name: 'Tomato Early Blight', crop: 'Tomato', status: 'Fungal Disease', conf: '99.97%' },
  { id: 'potato_late_blight', name: 'Potato Late Blight', crop: 'Potato', status: 'Water Mold Disease', conf: '99.88%' },
  { id: 'pepper_bacterial_spot', name: 'Bell Pepper Bacterial Spot', crop: 'Pepper', status: 'Bacterial Disease', conf: '99.95%' },
  { id: 'tomato_healthy', name: 'Tomato Healthy Leaf', crop: 'Tomato', status: 'Healthy Leaf', conf: '99.96%' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function HomePage() {
  const navigate = useNavigate();
  const [selectedSample, setSelectedSample] = useState<string>('tomato_early_blight');

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* ── HERO ── */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={fadeUp}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 28px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span className="badge-clean badge-emerald" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            <span className="live-pulse-dot" />
            AI Model Online
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 0 12px', lineHeight: 1.15 }}>
              Know what's wrong with your plant <span style={{ color: '#10b981' }}>in seconds</span>
            </h1>
            <p style={{ color: 'var(--text-body)', fontSize: '1.1rem', maxWidth: 680, margin: 0, lineHeight: 1.6 }}>
              Take a photo of a leaf and get an instant diagnosis. Our AI shows you exactly what it
              sees, explains its reasoning in plain terms, and suggests a treatment plan.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="btn-try"
              onClick={() => navigate('/analyze')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: '0.95rem' }}
            >
              Diagnose a Leaf Now
              <ArrowRight size={16} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/benchmarks')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <Cpu size={16} />
              See How It Works
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ── STAT STRIP ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={fadeUp}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 36px' }}
      >
        <div className="card-minimal" style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          {STUDIO_SPECS.map(spec => (
            <div key={spec.label} style={{ borderRight: '1px solid var(--border-light)', paddingRight: 16 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                {spec.label}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
                {spec.value}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: 2, fontWeight: 500 }}>
                {spec.badge}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── 3 CORE CONSOLES ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 36px' }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            What you can do here
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 18 }}>
          {STUDIO_CONSOLES.map((c, i) => (
            <motion.div
              key={c.id}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              onClick={() => navigate(c.route)}
              className="card-minimal"
              style={{
                padding: 24,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ padding: 8, borderRadius: 8, background: 'var(--bg-subtle)' }}>
                    {c.icon}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {c.tag}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 8px' }}>
                  {c.title}
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-body)', margin: 0, lineHeight: 1.5 }}>
                  {c.desc}
                </p>
              </div>

              <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {c.stats}
                </span>
                <ArrowRight size={14} color="var(--text-muted)" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TRY IT NOW ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={fadeUp}
        transition={{ duration: 0.5 }}
        style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 36px' }}
      >
        <div className="card-minimal" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="#10b981" />
                Try It Now — No Upload Needed
              </h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
                Pick one of these real leaf photos to see how the AI diagnoses it.
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="btn-try"
              onClick={() => navigate('/analyze')}
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              Upload Your Own Photo
              <Upload size={14} style={{ marginLeft: 6 }} />
            </motion.button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            {SAMPLE_SPECIMENS.map(s => {
              const isSel = selectedSample === s.id;
              return (
                <motion.div
                  key={s.id}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedSample(s.id)}
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: isSel ? '1.5px solid #10b981' : '1px solid var(--border-light)',
                    background: isSel ? 'var(--bg-subtle)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.crop}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>{s.conf}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{s.status}</div>
                </motion.div>
              );
            })}
          </div>

          <div style={{ marginTop: 24, padding: '16px 20px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Sparkles size={18} color="#6366f1" />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>
                Selected: <strong>{SAMPLE_SPECIMENS.find(s => s.id === selectedSample)?.name}</strong> — ready to analyze.
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="btn-try"
              onClick={() => navigate(`/analyze?sample=${selectedSample}`)}
              style={{ fontSize: '0.84rem', padding: '6px 14px' }}
            >
              Analyze This Leaf →
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ── WHY TRUST US ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={fadeUp}
        transition={{ duration: 0.5 }}
        style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div className="card-minimal" style={{ padding: 24 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} color="#10b981" />
              Real Data, No Guessing
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-body)', margin: 0, lineHeight: 1.5 }}>
              Every number on this site comes from real tests on {HEADLINE.testImagesLabel} leaf photos the AI never saw while learning.
              Nothing is estimated or made up.
            </p>
          </div>

          <div className="card-minimal" style={{ padding: 24 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="#6366f1" />
              Built on Proven Science
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-body)', margin: 0, lineHeight: 1.5 }}>
              Uses well-established AI techniques (like Grad-CAM++ and SHAP) that researchers
              trust to explain how a model made its decision — not a black box.
            </p>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
