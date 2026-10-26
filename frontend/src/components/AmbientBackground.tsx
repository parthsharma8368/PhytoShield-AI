import React, { memo } from 'react';

/**
 * AmbientBackground — Minimalist, low-noise studio atmosphere.
 *
 * Replaces noisy drifting colored orbs with a calm, high-precision technical dot matrix
 * and subtle ambient vignette engineered for clinical and scientific clarity.
 */
export const AmbientBackground: React.FC = memo(() => {
  return (
    <div className="ambient-background-mesh" aria-hidden="true">
      {/* Precision Micro-Dot Matrix */}
      <div className="ambient-dot-grid" />
      {/* Subtle Top Zenith Vignette */}
      <div className="ambient-zenith-glow" />
      {/* Slow-drifting ambient glow orbs for depth */}
      <div className="ambient-orb ambient-orb-a" />
      <div className="ambient-orb ambient-orb-b" />
    </div>
  );
});

AmbientBackground.displayName = 'AmbientBackground';
export default AmbientBackground;
