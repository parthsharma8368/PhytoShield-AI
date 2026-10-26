import { useState } from 'react';
import { Zap } from 'lucide-react';
import type { PipelineTimings } from './analyze/types';
import { formatDuration } from './analyze/utils';

interface PipelineProps {
  timings: PipelineTimings;
  className?: string;
}

export default function InferencePipelineVisualizer({ timings, className }: PipelineProps) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const PIPELINE_NODES = [
    {
      step: '01',
      title: 'Tensor Preprocessing',
      tag: 'Input Ingestion',
      timing: formatDuration(timings.preprocessing_seconds),
      summary: 'Leaf normalization, 224×224 tensor resize, ImageNet RGB standardization [0.485, 0.456, 0.406].',
      details: [
        'Color conversion to RGB 3-channel format',
        'Bilinear interpolation to 224×224 spatial resolution',
        'Standardization with ImageNet mean and variance: μ=[.485, .456, .406], σ=[.229, .224, .225]'
      ]
    },
    {
      step: '02',
      title: 'MBConv Feature Extraction',
      tag: 'EfficientNet-B0 Backbone',
      timing: formatDuration(timings.classification_seconds),
      summary: '16 Inverted Residual blocks with Squeeze-and-Excitation channel attention ratio = 0.25.',
      details: [
        'Stem convolution: 3×3 conv with stride 2',
        'Depthwise separable convolution layers isolating spatial foliar textures',
        'Final stage features[8] generating 7×7×1280 activation tensors'
      ]
    },
    {
      step: '03',
      title: 'Spatial Gradient Backprop',
      tag: 'Attribution Computation',
      timing: formatDuration(timings.gradcam_seconds),
      summary: 'Computing partial derivatives ∂y^c / ∂A^k of predicted class score with respect to feature maps.',
      details: [
        'Global-average pooled gradients α_k^c over width and height dimensions',
        'Rectified Linear Unit (ReLU) gating to isolate positive disease evidence',
        'Axiomatic baseline integration shared across Grad-CAM++, Integrated Gradients and SmoothGrad'
      ]
    },
    {
      step: '04',
      title: 'SHAP & LIME Surrogate Attribution',
      tag: 'Parallel Model-Agnostic Engines',
      timing: formatDuration((timings.shap_seconds ?? 0) + (timings.lime_seconds ?? 0)),
      summary: 'Batched occlusion sensitivity (SHAP) and SLIC superpixel surrogate fitting (LIME), run concurrently.',
      details: [
        'SHAP: single batched forward pass over an 8×8 occlusion grid',
        'LIME: SLIC superpixel segmentation + Ridge surrogate regression',
        'Both run on background worker threads alongside counterfactual and decision-support analysis'
      ]
    },
    {
      step: '05',
      title: 'Heatmap Fusion & Lesion Mask',
      tag: 'Clinical Localization',
      timing: formatDuration(timings.xai_wall_seconds),
      summary: 'Bilinear upsampling from 7×7 to 224×224, colormap alpha-blending, and contour extraction.',
      details: [
        'Colormap mapping (Jet) normalized to [0, 1] range',
        'Alpha-blended composite overlay on original RGB specimen leaf',
        'Total wall-clock time across the full attribution stage'
      ]
    },
    {
      step: '06',
      title: 'Agronomic Synthesis',
      tag: 'Groq LLM Reasoning',
      timing: formatDuration(timings.groq_seconds),
      summary: 'Pathology reasoning engine generating clinical prescription, biological cures, and triage.',
      details: [
        'Runs independently of the visual attribution suite via /predict/insight',
        'Pathogen etiology verification (Fungal, Bacterial, Viral, Arthropod)',
        'Three-tiered intervention plan: Immediate Curative, Biological Control, and Long-Term Prevention'
      ]
    }
  ];

  return (
    <div className={`inference-pipeline-container ${className || ''}`} style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="#10b981" />
            What Happened, Step by Step
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Click a step below to see exactly what the AI did, and how long it took
          </span>
        </div>

        {timings && (
          <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: 4 }}>
            Total time: {timings.total_seconds.toFixed(2)}s
          </span>
        )}
      </div>

      {/* PIPELINE CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {PIPELINE_NODES.map((node, index) => {
          const isExpanded = expandedStage === index;
          return (
            <div 
              key={node.step}
              onClick={() => setExpandedStage(isExpanded ? null : index)}
              className="card-minimal"
              style={{
                padding: 16,
                cursor: 'pointer',
                border: isExpanded ? '1px solid #10b981' : '1px solid var(--border-light)',
                background: isExpanded ? 'var(--bg-card)' : 'var(--bg-subtle)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '2px 6px',
                  borderRadius: 4
                }}>
                  STAGE {node.step}
                </span>

                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  {node.timing}
                </span>
              </div>

              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 2 }}>{node.title}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 6 }}>{node.tag}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-body)', lineHeight: 1.4 }}>{node.summary}</div>

              {isExpanded && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
                    {node.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
