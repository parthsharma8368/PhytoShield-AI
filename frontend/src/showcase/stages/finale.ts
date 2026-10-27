import * as THREE from 'three';
import { SHOWCASE as S } from '../../generated/showcase';
import { COLORS, label, setLocal, smooth, type Stage } from '../core';

/** Closing scene: the network as a living torus of particles with the headline numbers orbiting it. */
export function createFinale(): Stage {
  const group = new THREE.Group();
  const N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * Math.PI * 2, v = Math.random() * Math.PI * 2, R = 3.4, r = 1.0 + Math.random() * 0.5;
    pos.set([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v) * 1.0, (R + r * Math.cos(v)) * Math.sin(u)], i * 3);
    const c = new THREE.Color().setHSL(0.42 + Math.random() * 0.12, 0.85, 0.55); col.set([c.r, c.g, c.b], i * 3); seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `attribute vec3 aColor; attribute float aSeed; uniform float uTime; varying vec3 vC; varying float vS;
      void main(){ vec3 p = position; float a = uTime * 0.25 + aSeed * 0.6; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz; p.y += sin(uTime * 1.3 + aSeed * 30.0) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (1.1 + aSeed * 1.2) * (22.0 / -mv.z); vC = aColor; vS = aSeed; }`,
    fragmentShader: `uniform float uFade; varying vec3 vC; varying float vS; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, 0.7 * uFade * smoothstep(0.5, 0.1, d)); }`,
  });
  const pts = new THREE.Points(geo, mat); group.add(pts);
  const stats: [string, string][] = [[`${S.metrics.accuracy}%`, 'test accuracy'], ['7', 'XAI engines'], [`${S.metrics.eceAfter}`, 'calibration error'], ['0.38', 'GFLOPs']];
  const orbs = stats.map(([a, b], i) => { const l = label(a, 0.8, '#7ee8bf', 800, b); group.add(l); return { l, i }; });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.015, 8, 160), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.5 })); ring.rotation.x = Math.PI / 2; group.add(ring);
  return {
    range: [20, 20], group,
    update(t, time) {
      mat.uniforms.uTime.value = time;
      group.rotation.x = 0.55 - 0.15 * smooth(0, 1, t); group.rotation.y = time * 0.05;
      orbs.forEach(({ l, i }) => { const a = time * 0.3 + (i / 4) * Math.PI * 2; l.position.set(Math.cos(a) * 5.4, 0.6 * Math.sin(time * 0.8 + i), Math.sin(a) * 5.4); setLocal(l, 0.9); });
    },
    camera() { return { p: [0, 2.2, 13], l: [0, 0, 0] }; },
    dispose() {},
  };
}
