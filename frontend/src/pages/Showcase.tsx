import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { CHAPTERS } from '../showcase/chapters';
import { ShowcaseScene } from '../showcase/scene';
import { STAGES } from '../showcase/stages';
import { SAMPLE_KEYS, type SampleKey } from '../showcase/core';

const SECTION_VH = 1.15;

function webglOk(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export default function ShowcasePage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ShowcaseScene | null>(null);
  const [sample, setSample] = useState<SampleKey>(SAMPLE_KEYS[0]);
  const [active, setActive] = useState(0);
  const [ok] = useState(webglOk);
  const sides = useMemo(() => CHAPTERS.map(c => (c.side === 'left' ? -1 : c.side === 'right' ? 1 : 0)), []);
  const lifts = useMemo(() => CHAPTERS.map(c => (c.side === 'bottom' ? 1 : 0)), []);

  useEffect(() => {
    if (!ok || !canvasRef.current) return;
    const scene = new ShowcaseScene(canvasRef.current, STAGES, SAMPLE_KEYS[0]);
    sceneRef.current = scene;
    if (import.meta.env.DEV) (window as unknown as { __showcase: ShowcaseScene }).__showcase = scene;
    const onScroll = () => {
      const h = window.innerHeight * SECTION_VH;
      const pos = Math.min(CHAPTERS.length - 1, Math.max(0, (window.scrollY + window.innerHeight / 2) / h - 0.5));
      const i = Math.floor(pos), f = pos - i;
      const side = sides[i] * (1 - f) + sides[Math.min(i + 1, sides.length - 1)] * f;
      const lift = lifts[i] * (1 - f) + lifts[Math.min(i + 1, lifts.length - 1)] * f;
      scene.setPos(pos, side, lift);
      setActive(Math.round(pos));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); scene.dispose(); sceneRef.current = null; };
  }, [ok, sides, lifts]);

  const pick = useCallback((k: SampleKey) => { setSample(k); sceneRef.current?.setSample(k); }, []);
  const jump = (i: number) => window.scrollTo({ top: i * window.innerHeight * SECTION_VH + window.innerHeight * (SECTION_VH / 2 - 0.5), behavior: 'smooth' });

  if (!ok) {
    return <div className="sc-fallback"><h2>The 3D showcase needs WebGL</h2><p>Your browser or device has WebGL turned off. Open the live analyzer instead.</p><button className="btn-try" onClick={() => navigate('/analyze')}><span>Open live analyzer</span><ArrowRight size={13} /></button></div>;
  }

  return (
    <div className="showcase">
      <canvas ref={canvasRef} className="showcase-canvas" />
      <div className="showcase-vignette" />

      <nav className="sc-rail" aria-label="Showcase chapters">
        {CHAPTERS.map((c, i) => (
          <button key={c.kicker} className={`sc-dot ${i === active ? 'on' : ''} ${i < active ? 'done' : ''}`} onClick={() => jump(i)} aria-label={c.kicker}>
            <span className="sc-dot-label">{c.kicker}</span>
          </button>
        ))}
      </nav>

      <div className="sc-samples" role="group" aria-label="Choose a test photo">
        <span>Test photo</span>
        {SAMPLE_KEYS.map(k => (
          <button key={k} className={k === sample ? 'on' : ''} onClick={() => pick(k)} aria-label={`Use the ${k} sample`}>
            <img src={`/showcase/${k}/photo.jpg`} alt="" />
          </button>
        ))}
      </div>

      <main className="sc-main">
        {CHAPTERS.map((c, i) => (
          <section key={c.kicker} className={`sc-section side-${c.side}`} style={{ height: `${SECTION_VH * 100}vh` }}>
            <motion.div className="sc-card" initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.55, margin: '0px 0px -8% 0px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
              <div className="sc-kicker">{c.kicker}</div>
              <h2>{c.title}</h2>
              <p>{typeof c.body === 'function' ? c.body(sample) : c.body}</p>
              {c.chips && <div className="sc-chips">{(typeof c.chips === 'function' ? c.chips(sample) : c.chips).map(([v, l]) => <div key={l} className="sc-chip"><b>{v}</b><span>{l}</span></div>)}</div>}
              {i === 0 && <div className="sc-hint"><ChevronDown size={16} /> Scroll to begin</div>}
              {i === CHAPTERS.length - 1 && (
                <div className="sc-cta">
                  <button className="btn-try" onClick={() => navigate('/analyze')}><span>Open the live analyzer</span><ArrowRight size={13} /></button>
                  <button className="sc-ghost" onClick={() => jump(0)}>Replay from the start</button>
                </div>
              )}
            </motion.div>
          </section>
        ))}
      </main>
    </div>
  );
}
