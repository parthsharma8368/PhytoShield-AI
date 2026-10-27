import * as THREE from 'three';
import { COLORS, easeOut, smooth, type SampleKey, type Stage } from '../core';
import type { StageCtx } from '../scene';

const N = 120; // points per side

/** The leaf photo as a living particle cloud: forms on load, disperses into the data cloud on scroll. */
export function createIntro(ctx: StageCtx): Stage {
  const group = new THREE.Group();
  const geo = new THREE.BufferGeometry();
  const target = new Float32Array(N * N * 3), scatter = new Float32Array(N * N * 3), seed = new Float32Array(N * N), color = new Float32Array(N * N * 3);
  const size = 5.4;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    target.set([(i / (N - 1) - 0.5) * size, (0.5 - j / (N - 1)) * size, 0], k * 3);
    const r = 5 + Math.random() * 9, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    scatter.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th)], k * 3);
    seed[k] = Math.random(); color.set([0.2, 0.7, 0.5], k * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(target.slice(), 3));
  geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const colAttr = new THREE.BufferAttribute(color, 3); geo.setAttribute('aColor', colAttr);
  const alpha = new Float32Array(N * N).fill(0.8); const alphaAttr = new THREE.BufferAttribute(alpha, 1); geo.setAttribute('aAlpha', alphaAttr);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMorph: { value: 1 }, uTime: { value: 0 }, uFade: { value: 1 }, uSize: { value: 1 } },
    vertexShader: `attribute vec3 aTarget, aScatter, aColor; attribute float aSeed, aAlpha; uniform float uMorph, uTime, uSize; varying vec3 vC; varying float vA;
      void main(){
        float m = smoothstep(0.0, 1.0, clamp(uMorph * 1.25 - aSeed * 0.25, 0.0, 1.0));
        vec3 p = mix(aTarget, aScatter, m);
        float ang = uTime * 0.35 * m + aSeed * 6.2831;
        p.xz = mat2(cos(ang*0.15), -sin(ang*0.15), sin(ang*0.15), cos(ang*0.15)) * p.xz;
        p.z += sin(uTime * 1.2 + aTarget.x * 1.7 + aTarget.y * 1.3) * 0.06 * (1.0 - m);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (1.3 + 0.9 * aSeed) * (24.0 / -mv.z);
        vC = aColor; vA = aAlpha;
      }`,
    fragmentShader: `uniform float uFade; varying vec3 vC; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC * 1.1, vA * uFade * smoothstep(0.5, 0.12, d)); }`,
  });
  const pts = new THREE.Points(geo, mat); group.add(pts);

  const rings: THREE.LineLoop[] = [];
  for (let r = 0; r < 3; r++) {
    const pg = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * (4.4 + r * 0.7), Math.sin(i / 128 * Math.PI * 2) * (4.4 + r * 0.7), 0)));
    const ring = new THREE.LineLoop(pg, new THREE.LineBasicMaterial({ color: r === 1 ? COLORS.cyan : COLORS.mint, transparent: true, opacity: 0.35 }));
    ring.rotation.x = 1.1 + r * 0.25; ring.rotation.y = r * 0.6; rings.push(ring); group.add(ring);
  }

  let loadId = 0;
  function loadColors(key: SampleKey) {
    const id = ++loadId, img = new Image();
    img.onload = () => {
      if (id !== loadId) return;
      const c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data;
      for (let k = 0; k < N * N; k++) {
        const r = d[k * 4] / 255, g2 = d[k * 4 + 1] / 255, b = d[k * 4 + 2] / 255, mx = Math.max(r, g2, b), sat = mx > 0 ? (mx - Math.min(r, g2, b)) / mx : 0;
        color.set([r, g2, b], k * 3); alpha[k] = Math.min(1, 0.16 + 1.9 * sat); // grey backdrop fades, leaf tissue glows
      }
      colAttr.needsUpdate = true; alphaAttr.needsUpdate = true;
    };
    img.src = `/showcase/${key}/photo.jpg`;
  }
  loadColors(ctx.sample);
  const born = performance.now();

  return {
    range: [0, 0], group,
    update(t, time) {
      const form = easeOut((performance.now() - born) / 2600);
      const morph = Math.max(1 - form, smooth(0.58, 1, t));
      mat.uniforms.uMorph.value = morph; mat.uniforms.uTime.value = time;
      mat.uniforms.uSize.value = 1 + 0.6 * smooth(0.55, 1, t);
      rings.forEach((r, i) => { r.rotation.z = time * (0.15 + i * 0.07) * (i % 2 ? -1 : 1); (r.material as THREE.LineBasicMaterial).userData.local = 1 - smooth(0.55, 0.9, t); });
      group.rotation.y = Math.sin(time * 0.25) * 0.18;
    },
    camera(t) { const u = smooth(0.5, 1, t); return { p: [0, u * 1.5, 9.5 + u * 5], l: [0, 0, 0] }; },
    setSample(k) { loadColors(k); },
    dispose() { loadId = -1; },
  };
}
