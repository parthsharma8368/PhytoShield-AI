import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { motion } from 'motion/react';
import {
  UploadCloud, Trash2, Sliders, Microscope,
  RefreshCw, XCircle, Activity, Sparkles,
  ChevronRight, Leaf, FolderOpen, FlaskConical, X,
} from 'lucide-react';

import DiagnosisCard from '../components/analyze/DiagnosisCard';
import HeatmapCard from '../components/analyze/HeatmapCard';
import ClinicalIntelligenceHub from '../components/analyze/ClinicalIntelligenceHub';
import DecisionSupportCard from '../components/analyze/DecisionSupportCard';
import ExplanationQualityCard from '../components/analyze/ExplanationQualityCard';
import CounterfactualAndConceptsCard from '../components/analyze/CounterfactualAndConceptsCard';
import CollapsibleSection from '../components/analyze/CollapsibleSection';
import { SkeletonCard } from '../components/analyze/Skeleton';
import PrintReport from '../components/analyze/PrintReport';
import InferencePipelineVisualizer from '../components/InferencePipelineVisualizer';
import type { QuickResult, ReportResult, InsightResult, XAIMethodKey, PipelineTimings } from '../components/analyze/types';

const HEATMAP_LAYERS: { id: XAIMethodKey; label: string; color: string }[] = [
  { id: 'gradcam_pp', label: 'Grad-CAM++',     color: '#00e599' },
  { id: 'gradcam',    label: 'Grad-CAM',   color: '#10b981' },
  { id: 'saliency',   label: 'Saliency',   color: '#ec4899' },
  { id: 'smoothgrad', label: 'SmoothGrad', color: '#3b82f6' },
  { id: 'ig',         label: 'Integrated Gradients', color: '#8b5cf6' },
  { id: 'shap',       label: 'SHAP', color: '#f59e0b' },
  { id: 'lime',       label: 'LIME', color: '#00c4cc' },
];

const EXPLANATION_TITLES: Record<string, { heading: string; label: string }> = {
  gradcam_pp:           { heading: 'WHAT THE AI SEES — GRAD-CAM++',            label: 'Grad-CAM++' },
  gradcam:              { heading: 'WHAT THE AI SEES — GRAD-CAM',              label: 'Grad-CAM' },
  saliency:             { heading: 'WHAT THE AI SEES — SALIENCY',              label: 'Saliency' },
  smoothgrad:           { heading: 'WHAT THE AI SEES — SMOOTHGRAD',            label: 'SmoothGrad' },
  integrated_gradients: { heading: 'WHAT THE AI SEES — INTEGRATED GRADIENTS',  label: 'Integrated Gradients' },
  shap:                 { heading: 'WHAT THE AI SEES — SHAP',                  label: 'SHAP' },
  lime:                 { heading: 'WHAT THE AI SEES — LIME',                  label: 'LIME' },
};

const VERIFIED_SAMPLES = [
  { id: 'tomato_early_blight', label: 'Tomato Early Blight' },
  { id: 'potato_late_blight', label: 'Potato Late Blight' },
  { id: 'pepper_bacterial_spot', label: 'Bell Pepper Bacterial Spot' },
  { id: 'tomato_healthy', label: 'Tomato Healthy Leaf' },
];

function toApiMethod(key: XAIMethodKey): string {
  return key === 'ig' ? 'integrated_gradients' : key;
}

/** Measured facts about this image, sent to the LLM so its answers describe this leaf and not the disease in general. */
function buildFindings(report: ReportResult | null): Record<string, unknown> {
  if (!report) return {};
  const q = report.explanation_quality;
  const cf = report.counterfactual;
  return {
    uncertainty: report.uncertainty && {
      trust_tier: report.uncertainty.trust_tier,
      predictive_entropy_bits: report.uncertainty.predictive_entropy,
      mc_dropout_confidence_pct: report.uncertainty.mean_confidence,
    },
    leaf_damage_pct_measured_from_colour: report.decision_support?.affected_leaf_percentage,
    severity_stage: report.decision_support?.staging?.stage_name,
    top_concept_scores: report.botanical_concepts?.concepts
      ?.slice().sort((a, b) => b.score - a.score).slice(0, 3).map(c => ({ concept: c.name, score: c.score })),
    counterfactual: cf && {
      confidence_in_diagnosis_after_removing_lesions_pct: cf.counterfactual_disease_confidence,
      confidence_drop_pct: cf.confidence_drop,
    },
    explanation_quality: q && {
      faithfulness: q.faithfulness?.faithfulness_score,
      random_heatmap_faithfulness_baseline: q.faithfulness?.random_baseline_score,
      localization_on_leaf: q.localization_score,
      stability: q.stability_score,
    },
  };
}

export default function AnalyzePage({ apiBase }: { apiBase: string }) {
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [opacity, setOpacity]   = useState(0.70);
  const [activeHm, setActiveHm] = useState<XAIMethodKey>('gradcam_pp');

  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [quick, setQuick]                 = useState<QuickResult | null>(null);
  const [report, setReport]               = useState<ReportResult | null>(null);
  const [insight, setInsight]             = useState<InsightResult | null>(null);
  const [reportLoading, setReportLoading]   = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [reportError, setReportError]       = useState<string | null>(null);

  const [explanationState, setExplanationState] = useState<{
    heading: string; methodLabel: string; text: string; loading: boolean;
  }>({ heading: 'WHAT THE AI SEES — GRAD-CAM++', methodLabel: 'Grad-CAM++', text: '', loading: false });

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const explanationCacheRef = useRef<Record<string, { heading: string; methodLabel: string; text: string }>>({});
  const activeReqIdRef = useRef<number>(0);

  const accept = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) { setError('Please upload a valid image (JPEG / PNG / WEBP).'); return; }
    setError(null);
    setQuick(null); setReport(null); setInsight(null); setReportError(null);
    setFile(f); setPreview(URL.createObjectURL(f));
  }, []);

  const onInput  = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) accept(e.target.files[0]); };
  const onDragOv = (e: DragEvent<HTMLDivElement>)      => { e.preventDefault(); setDragging(true); };
  const onDragLv = ()                                  => setDragging(false);
  const onDrop   = (e: DragEvent<HTMLDivElement>)      => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) accept(e.dataTransfer.files[0]); };
  const reset    = () => {
    setFile(null); setPreview(null);
    setQuick(null); setReport(null); setInsight(null); setError(null); setReportError(null);
    explanationCacheRef.current = {};
  };

  const loadSample = useCallback(async (sampleId: string) => {
    try {
      setError(null);
      const res = await fetch(`${apiBase}/sample-image/${sampleId}`);
      if (!res.ok) throw new Error('Failed to load specimen image');
      const blob = await res.blob();
      const f = new File([blob], `${sampleId}.jpg`, { type: 'image/jpeg' });
      accept(f);
    } catch (err) {
      console.error(err);
      setError('Could not load sample specimen.');
    }
  }, [accept, apiBase]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sampleParam = params.get('sample');
    if (sampleParam) {
      loadSample(sampleParam);
    }
  }, [loadSample]);

  const heatmapSrc = (id: XAIMethodKey): string | null =>
    id === 'gradcam_pp'
      ? (report?.gradcam_pp_heatmap_b64 ?? report?.gradcam_heatmap_b64 ?? quick?.primary_heatmap_b64 ?? null)
      : (report?.[`${id}_heatmap_b64`] ?? null);
  const hmSrc = heatmapSrc(activeHm);

  const selectXAIMethod = useCallback(async (methodKey: XAIMethodKey) => {
    setActiveHm(methodKey);
    if (!quick) return;

    const apiMethod = toApiMethod(methodKey);
    const cached = explanationCacheRef.current[apiMethod];
    if (cached) { setExplanationState({ ...cached, loading: false }); return; }

    const meta = EXPLANATION_TITLES[apiMethod] || EXPLANATION_TITLES.gradcam_pp;
    setExplanationState({ heading: meta.heading, methodLabel: meta.label, text: '', loading: true });

    const reqId = ++activeReqIdRef.current;
    try {
      const resp = await fetch(`${apiBase}/explain-xai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: quick.class_name, confidence: quick.confidence, xai_method: apiMethod, findings: buildFindings(report) }),
      });
      if (!resp.ok) throw new Error('Explanation request failed');
      const data = await resp.json();
      if (activeReqIdRef.current === reqId) {
        const entry = { heading: data.heading, methodLabel: data.method_label, text: data.explanation };
        explanationCacheRef.current[apiMethod] = entry;
        setExplanationState({ ...entry, loading: false });
      }
    } catch {
      if (activeReqIdRef.current === reqId) {
        setExplanationState(prev => ({
          ...prev,
          text: insight?.xai_feature_explanation || 'Detailed visual feature explanation available once the full report loads.',
          loading: false,
        }));
      }
    }
  }, [quick, apiBase, insight]);

  const analyze = async () => {
    if (!file) return;

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setError(null);
    setReportError(null);
    setQuick(null); setReport(null); setInsight(null);
    setReportLoading(true);
    explanationCacheRef.current = {};
    setActiveHm('gradcam_pp');

    const fdQuick = new FormData(); fdQuick.append('file', file);
    const fdReport = new FormData(); fdReport.append('file', file);

    // Quick and full-report fetches fire together — report doesn't depend on quick's result.
    const reportPromise = fetch(`${apiBase}/predict/report`, { method: 'POST', body: fdReport, signal })
      .then(async res => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e?.detail ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ReportResult>;
      });

    let quickDone: QuickResult | null = null;
    try {
      const quickRes = await fetch(`${apiBase}/predict/quick`, { method: 'POST', body: fdQuick, signal });
      if (!quickRes.ok) {
        const e = await quickRes.json().catch(() => ({}));
        throw new Error(e?.detail ?? `HTTP ${quickRes.status}`);
      }
      const quickData: QuickResult = await quickRes.json();
      setQuick(quickData);
      setLoading(false);

      setInsightLoading(true);
      quickDone = quickData;
    } catch (e: unknown) {
      setLoading(false);
      setReportLoading(false);
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : 'Analysis failed. Please try again.');
      }
      return;
    }

    let reportData: ReportResult | null = null;
    try {
      reportData = await reportPromise;
      setReport(reportData);
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setReportError(e instanceof Error ? e.message : 'Full research report failed to load.');
      }
    } finally {
      setReportLoading(false);
    }

    // The LLM runs last so its answer can use what the report measured for this image.
    try {
      const res = await fetch(`${apiBase}/predict/insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: quickDone.class_name, confidence: quickDone.confidence, findings: buildFindings(reportData) }),
        signal,
      });
      if (!res.ok) throw new Error('Insight request failed');
      const data: InsightResult = await res.json();
      setInsight(data);
      const entry = { heading: EXPLANATION_TITLES.gradcam_pp.heading, methodLabel: 'Grad-CAM++', text: data.xai_feature_explanation };
      explanationCacheRef.current['gradcam_pp'] = entry;
      setExplanationState({ ...entry, loading: false });
    } catch { /* narrative unavailable; diagnosis and heatmaps stay usable */ } finally {
      setInsightLoading(false);
    }
  };

  const cancelAnalysis = () => {
    abortRef.current?.abort();
    setLoading(false);
    setReportLoading(false);
    setInsightLoading(false);
  };

  const mergedTimings: PipelineTimings | null = report ? {
    preprocessing_seconds: quick?.timings.preprocessing_seconds ?? report.timings.preprocessing_seconds,
    classification_seconds: quick?.timings.classification_seconds ?? 0,
    gradcam_seconds: report.timings.gradcam_seconds,
    gradcam_pp_seconds: report.timings.gradcam_pp_seconds,
    saliency_seconds: report.timings.saliency_seconds,
    smoothgrad_seconds: report.timings.smoothgrad_seconds,
    ig_seconds: report.timings.ig_seconds,
    shap_seconds: report.timings.shap_seconds,
    lime_seconds: report.timings.lime_seconds,
    xai_wall_seconds: report.timings.xai_wall_seconds,
    groq_seconds: insight?.groq_seconds ?? null,
    total_seconds: report.timings.total_seconds,
  } : null;

  return (
    <div className="page analyze-page">
      <div className="ctr" style={{ paddingTop: 32 }}>

        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border-light)',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', margin: '0 0 4px 0', overflowWrap: 'anywhere' }}>
              Diagnose a Leaf
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, overflowWrap: 'anywhere' }}>
              Upload a photo for an instant diagnosis. A more detailed report loads in right behind it.
            </p>
          </div>

          {file && (
            <button className="btn-clear-workspace-glass" onClick={reset}>
              <Trash2 size={14} />
              <span>Clear Workspace</span>
            </button>
          )}
        </div>

        <div className="analyze-grid">

          {/* ════ LEFT COLUMN: UPLOAD & CONTROLS ════ */}
          <div className="analyze-left-col">
            <div className="card-light neo-elevated">
              <div className="card-light-head">
                <div className="card-light-title">
                  <Leaf size={18} color="#00b87c" />
                  <span>Leaf Specimen</span>
                </div>
                {file && (
                  <span style={{ fontSize:'0.72rem', color:'var(--green-main)', fontWeight:700, background:'var(--green-light)', padding:'2px 8px', borderRadius:99, flexShrink: 0 }}>
                    Loaded
                  </span>
                )}
              </div>

              <div className="card-light-body">
                {!preview ? (
                  <>
                    <div
                      className={`dropzone-box ${dragging ? 'drag-over' : ''}`}
                      onClick={() => inputRef.current?.click()}
                      onDragOver={onDragOv}
                      onDragLeave={onDragLv}
                      onDrop={onDrop}
                    >
                      <input ref={inputRef} type="file" accept="image/*" onChange={onInput} style={{ display:'none' }} />
                      <div className="dropzone-icon-well">
                        <UploadCloud size={26} strokeWidth={2.2} />
                      </div>
                      <div className="dropzone-content">
                        <div className="dropzone-title">Upload Leaf Specimen</div>
                        <div className="dropzone-sub">Drag & drop your leaf photo here, or</div>
                      </div>
                      <button
                        type="button"
                        className="btn-browse-file"
                        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                      >
                        <FolderOpen size={15} /> Browse from Device
                      </button>
                      <div className="dropzone-meta-pill">
                        JPEG · PNG · WEBP (Max 10MB)
                      </div>
                    </div>

                    <div style={{ marginTop: 18, borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Or Test With Verified Dataset Specimens (99%+ Accuracy):
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {VERIFIED_SAMPLES.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className="btn-browse-file"
                            style={{
                              fontSize: '0.75rem',
                              padding: '8px 10px',
                              textAlign: 'left',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border-light)',
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                            onClick={() => loadSample(s.id)}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.78rem' }}>🌿 {s.label}</span>
                            <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>Verified sample</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      position:'relative', borderRadius:14, overflow:'hidden',
                      background:'#090d18', aspectRatio:'4/3', marginBottom:16,
                      boxShadow:'var(--neo-shadow-soft)', width: '100%',
                    }}>
                      <img src={preview} alt="leaf" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
                      {quick && hmSrc && (
                        <img src={hmSrc} alt="heatmap" style={{
                          position:'absolute', inset:0, width:'100%', height:'100%',
                          objectFit:'contain', opacity, transition:'opacity 0.2s',
                        }} />
                      )}
                    </div>

                    {quick && (
                      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        <div>
                          <div style={{ fontSize:'0.72rem', fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                            Choose a View
                          </div>
                          <div className="layer-select-grid">
                            {HEATMAP_LAYERS.map(({ id, label, color }) => {
                              const available = !!heatmapSrc(id);
                              if (!available) return null;
                              const isAct = activeHm === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => selectXAIMethod(id)}
                                  className={`layer-select-btn ${isAct ? 'active' : ''}`}
                                  style={{ borderColor: isAct ? color : 'var(--border-light)' }}
                                >
                                  <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }} />
                                  <span className="layer-label" style={{ color: isAct ? color : 'var(--text-main)' }}>{label}</span>
                                </button>
                              );
                            })}
                            {reportLoading && !report && (
                              <span className="layer-select-btn" style={{ opacity: 0.5, cursor: 'default' }}>
                                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                                <span className="layer-label">More loading…</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg-subtle)', padding:'8px 12px', borderRadius:10, boxShadow:'var(--neo-shadow-pressed)' }}>
                          <Sliders size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', flexShrink: 0 }}>Opacity</span>
                          <input type="range" min={0} max={1} step={0.05} value={opacity}
                            onChange={e => setOpacity(parseFloat(e.target.value))}
                            style={{ flex:1, minWidth: 0 }} />
                          <span style={{ fontSize:'0.75rem', fontWeight:800, color:'#00b87c', minWidth:32, textAlign:'right', flexShrink: 0 }}>
                            {Math.round(opacity*100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {file && (
              <div className="card-light neo-elevated">
                <div className="card-light-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {error && (
                    <div style={{
                      display:'flex', alignItems:'center', gap:8, padding:'12px',
                      background:'rgba(239, 68, 68, 0.12)', border:'1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius:10, color:'#ef4444', fontSize:'0.85rem', fontWeight:600,
                      overflowWrap: 'anywhere',
                    }}>
                      <XCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{error}</span>
                    </div>
                  )}

                  {(loading || reportLoading) ? (
                    <button className="btn-upload-leaf" onClick={cancelAnalysis} style={{ width:'100%', justifyContent:'center' }}>
                      <X size={18} style={{ flexShrink: 0 }} />
                      {loading ? 'Diagnosing…' : 'Cancel — loading full report…'}
                    </button>
                  ) : (
                    <button className="btn-upload-leaf" onClick={analyze} style={{ width:'100%', justifyContent:'center' }}>
                      <Microscope size={18} style={{ flexShrink: 0 }} /> Run Pathology Analysis <ChevronRight size={16} style={{ flexShrink: 0 }} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ════ RIGHT COLUMN: DIAGNOSIS & HEATMAPS ════ */}
          <div className="analyze-right-col">
            {!quick && !loading ? (
              <div className="card-light neo-elevated" style={{
                padding:'60px 24px', textAlign:'center',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:420,
                width: '100%', minWidth: 0
              }}>
                <div style={{
                  width:64, height:64, borderRadius:'50%', background:'var(--green-light)',
                  color:'var(--green-main)', display:'flex', alignItems:'center', justifyContent:'center',
                  marginBottom:16, boxShadow:'var(--neo-shadow-soft)', flexShrink: 0
                }}>
                  <Sparkles size={28} />
                </div>
                <h3 style={{ fontSize:'1.2rem', fontWeight:800, color:'var(--text-main)', marginBottom:8, overflowWrap: 'anywhere' }}>
                  Ready When You Are
                </h3>
                <p style={{ fontSize:'0.9rem', color:'var(--text-muted)', maxWidth:360, lineHeight:1.6, marginBottom:24, overflowWrap: 'anywhere' }}>
                  Drop a leaf photo on the left, then click Analyze. Your diagnosis appears in under a second.
                </p>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
                  <span className="step-pill-item pill-green" style={{ width:'auto', padding:'6px 14px', fontSize:'0.8rem' }}>1. Upload Photo</span>
                  <span className="step-pill-item pill-blue" style={{ width:'auto', padding:'6px 14px', fontSize:'0.8rem' }}>2. Instant Diagnosis</span>
                  <span className="step-pill-item pill-yellow" style={{ width:'auto', padding:'6px 14px', fontSize:'0.8rem' }}>3. Full Report Loads</span>
                </div>
              </div>
            ) : !quick && loading ? (
              <SkeletonCard label="Diagnosing your leaf…" lines={3} />
            ) : quick ? (
              <>
                <DiagnosisCard quick={quick} />

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  className="card-light neo-elevated"
                  style={{ width: '100%', minWidth: 0 }}
                >
                  <div className="card-light-head">
                    <div className="card-light-title">
                      <Activity size={18} color="#8b5cf6" style={{ flexShrink: 0 }} />
                      <span>How the AI Sees It</span>
                    </div>
                    <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600 }}>
                      Click any card for more detail
                    </span>
                  </div>
                  <div className="card-light-body" style={{ display:'flex', flexDirection:'column', gap:16, minWidth: 0 }}>
                    <div className="xai-maps-grid">
                      {HEATMAP_LAYERS.map(({ id, label, color }) => {
                        const src = heatmapSrc(id);
                        return src ? (
                          <HeatmapCard key={id} src={src} label={label} color={color} active={activeHm === id} onClick={() => selectXAIMethod(id)} />
                        ) : null;
                      })}
                      {reportLoading && !report && [1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="neo-hmap-card skeleton-hmap" />
                      ))}
                    </div>

                    <div className="neo-groq-live-card">
                      <div className="neo-groq-live-head">
                        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth: 0 }}>
                          <Sparkles size={16} color="#00b87c" style={{ flexShrink: 0 }} />
                          <span className="neo-groq-live-title">{explanationState.heading}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span className="neo-live-method-pill">
                            <span className="neo-live-dot" />
                            Analyzing: {explanationState.methodLabel}
                          </span>
                        </div>
                      </div>

                      {(explanationState.loading || (!explanationState.text && insightLoading)) ? (
                        <div className="neo-loading-box">
                          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', color: '#00b87c' }} />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                              Synthesizing {explanationState.methodLabel} interpretation…
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Reasoning over highlighted leaf regions and model decision features
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="neo-groq-live-body">
                          <p className="neo-groq-live-text">{explanationState.text}</p>
                          <div className="neo-chips-row" style={{ marginTop: 10 }}>
                            <span className="neo-mini-tag">AI Model: EfficientNet-B0</span>
                            <span className="neo-mini-tag">Confidence: {quick.confidence.toFixed(1)}%</span>
                            <span className="neo-mini-tag">Focused on: Disease Spots</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {insight ? (
                  <ClinicalIntelligenceHub insight={insight} />
                ) : insightLoading ? (
                  <SkeletonCard label="Writing up the disease details and treatment plan…" lines={4} />
                ) : null}

                {report?.decision_support ? (
                  <DecisionSupportCard decision={report.decision_support} />
                ) : reportLoading ? (
                  <SkeletonCard label="Checking how severe it is…" lines={3} />
                ) : null}

                {reportError && !report && (
                  <div className="card-light neo-elevated" style={{ borderLeft: '4px solid #ef4444' }}>
                    <div className="card-light-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                        <XCircle size={16} />
                        <span>{reportError}</span>
                      </div>
                      <button className="btn-browse-file" onClick={analyze}>
                        <RefreshCw size={14} /> Retry Full Report
                      </button>
                    </div>
                  </div>
                )}

                {report && (
                  <CollapsibleSection
                    icon={<FlaskConical size={16} color="#8b5cf6" />}
                    title="Deeper Research Details"
                    subtitle="For the curious: explanation quality checks, cause-and-effect testing, symptom detection, confidence testing, and full timing breakdown"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {report.explanation_quality && (
                        <ExplanationQualityCard metrics={report.explanation_quality} />
                      )}
                      {(report.counterfactual || report.botanical_concepts || report.uncertainty) && (
                        <CounterfactualAndConceptsCard
                          counterfactual={report.counterfactual}
                          concepts={report.botanical_concepts}
                          uncertainty={report.uncertainty}
                          previewSrc={preview}
                        />
                      )}
                      {mergedTimings && <InferencePipelineVisualizer timings={mergedTimings} />}
                    </div>
                  </CollapsibleSection>
                )}
              </>
            ) : null}
          </div>

        </div>
      </div>
      <PrintReport preview={preview} fileName={file?.name ?? null} quick={quick} report={report} insight={insight} insightLoading={insightLoading} />
    </div>
  );
}
