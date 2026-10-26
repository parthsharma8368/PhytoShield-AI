import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Cpu, ArrowRight, Layers, Sparkles, Boxes, Zap, FlaskConical
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ConfidenceGauge from '../components/analyze/ConfidenceGauge';
import CollapsibleSection from '../components/analyze/CollapsibleSection';
import { HEADLINE } from '../generated/metrics';

const ACTIVE_MODEL = {
  name: 'EfficientNet-B0',
  accuracy: HEADLINE.accuracyValue,
  params: HEADLINE.params,
  gflops: HEADLINE.gflops,
  latency: HEADLINE.latency,
  size: HEADLINE.size,
};

const WHY_THIS_MODEL = [
  {
    title: 'Sees disease clearly',
    color: '#10b981',
    icon: <Layers size={18} color="#10b981" />,
    desc: 'The way this model processes an image keeps enough visual detail to spot small spots and lesions on a leaf — not just a blurry overall impression.',
  },
  {
    title: 'Small and fast',
    color: '#6366f1',
    icon: <Zap size={18} color="#6366f1" />,
    desc: 'With only 4 million internal parameters, it runs in about 20 milliseconds — fast enough to feel instant, and light enough to run on a phone or a small field device with no internet connection.',
  },
  {
    title: 'Its reasoning holds up',
    color: '#f59e0b',
    icon: <Sparkles size={18} color="#f59e0b" />,
    desc: 'When we check the model\'s reasoning with 3 different explanation methods, they agree with each other 72% of the time — a strong sign the AI is looking at the actual disease, not something irrelevant in the background.',
  },
];

const CANDIDATE_MODELS = [
  {
    name: 'MobileNetV3-Large',
    note: 'Built for speed on mobile devices',
    params: '3.97M',
    gflops: '0.22',
    latency: '16.8 ms',
  },
  {
    name: 'ResNet-50',
    note: 'A larger, well-known design',
    params: '23.54M',
    gflops: '4.09',
    latency: '16.5 ms',
  },
  {
    name: 'DenseNet-121',
    note: 'Reuses features across layers',
    params: '6.97M',
    gflops: '2.83',
    latency: '52.1 ms',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function BenchmarksPage() {
  const navigate = useNavigate();

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <PageHeader
        icon={<Cpu size={13} />}
        eyebrow="The AI Model"
        title="How the AI Works"
        description="Everything below is measured on the exact model running in the app right now — not a lab estimate."
        accentColor="#6366f1"
        actions={
          <motion.button
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="btn-try"
            onClick={() => navigate('/analyze')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            Try It Yourself
            <ArrowRight size={15} />
          </motion.button>
        }
      />

      {/* ── ACTIVE MODEL SHOWCASE ── */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={fadeUp}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px' }}
      >
        <div className="card-minimal" style={{ padding: 32 }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            <ConfidenceGauge value={ACTIVE_MODEL.accuracy} label="ACCURACY" />

            <div style={{ flex: 1, minWidth: 260 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 700,
                color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 10px', borderRadius: 99,
                marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <Sparkles size={12} /> Currently Running
              </span>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                {ACTIVE_MODEL.name}
              </h2>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-body)', lineHeight: 1.6, margin: 0, maxWidth: 520 }}>
                This is the one AI model that powers every diagnosis in this app. It correctly identifies the
                disease <strong>{HEADLINE.accuracy} of the time</strong>, tested on {HEADLINE.testImagesLabel} real leaf photos it had never seen before.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minWidth: 220 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latency</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{ACTIVE_MODEL.latency}</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Model Size</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{ACTIVE_MODEL.size}</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parameters</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{ACTIVE_MODEL.params}</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>GFLOPs</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{ACTIVE_MODEL.gflops} GFLOPs</div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── WHY THIS MODEL ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={fadeUp}
        transition={{ duration: 0.45 }}
        style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px' }}
      >
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Why we chose this model</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {WHY_THIS_MODEL.map((item, i) => (
            <motion.div
              key={item.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="card-minimal"
              style={{ padding: 22, borderTop: `3px solid ${item.color}` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {item.icon}
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.title}</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-body)', lineHeight: 1.55, margin: 0 }}>
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── OTHER ARCHITECTURES WE CONSIDERED (collapsed by default) ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-40px' }}
        variants={fadeUp}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}
      >
        <CollapsibleSection
          icon={<FlaskConical size={16} color="#8b5cf6" />}
          title="Other Designs We Considered"
          subtitle="3 alternative architectures we benchmarked but haven't trained for production — kept here for the curious"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 4px', lineHeight: 1.55 }}>
              Before settling on {ACTIVE_MODEL.name}, we measured the real speed and size of these alternatives
              on the same hardware. None of them have been trained on our disease dataset yet, so we can't compare
              their accuracy — only their raw speed and footprint.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {CANDIDATE_MODELS.map(m => (
                <div key={m.name} style={{ padding: 16, borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Boxes size={14} color="var(--text-muted)" />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.name}</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 10 }}>{m.note}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Latency </span>
                      <strong>{m.latency}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Parameters </span>
                      <strong>{m.params}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      </motion.section>
    </div>
  );
}
