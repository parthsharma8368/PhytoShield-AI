import * as THREE from 'three';
import { COLORS, GLSL_HEAT, clamp, easeOut, heatPlane, imagePlane, label, lerp, sampleData, sampleTex, setGroupAlpha, setLocal, setU, smooth, type SampleKey, type Stage } from '../core';
import type { StageCtx } from '../scene';

const SIZE = 4.0;
const ENGINES = ['gradcam', 'gradcam_pp', 'saliency', 'smoothgrad', 'ig', 'shap', 'lime'] as const;
const NAMES = ['Grad-CAM', 'Grad-CAM++', 'Saliency', 'SmoothGrad', 'Integrated Gradients', 'SHAP (occlusion)', 'LIME'];
const heatFile = (e: string) => `heat_${e}.png`;
const ramp = (t: number) => { const c = [[0.04, 0.06, 0.35], [0, 0.75, 0.95], [0.35, 0.95, 0.35], [1, 0.85, 0.1], [0.95, 0.1, 0.05]]; const x = clamp(t) * 4, i = Math.min(3, Math.floor(x)), f = x - i; return new THREE.Color(lerp(c[i][0], c[i + 1][0], f), lerp(c[i][1], c[i + 1][1], f), lerp(c[i][2], c[i + 1][2], f)); };

type Rebind = (k: SampleKey) => void;

export function createXai(ctx: StageCtx): Stage {
  const group = new THREE.Group();
  const rebinds: Rebind[] = [];
  const bind = (mat: THREE.ShaderMaterial, uniform: string, file: string, nearest = false) => {
    const apply = (k: SampleKey) => { const t = sampleTex(k, file); if (nearest) { t.minFilter = t.magFilter = THREE.NearestFilter; } mat.uniforms[uniform].value = t; };
    apply(ctx.sample); rebinds.push(apply);
  };
  const heat = (file: string, size = SIZE, photoFile = 'photo.jpg') => {
    const m = heatPlane(sampleTex(ctx.sample, photoFile), sampleTex(ctx.sample, file), size);
    bind(m.material as THREE.ShaderMaterial, 'uPhoto', photoFile); bind(m.material as THREE.ShaderMaterial, 'uHeat', file);
    return m;
  };
  const eg = ENGINES.map(() => { const g = new THREE.Group(); group.add(g); return g; });
  const overview = new THREE.Group(); group.add(overview);
  const tickers: ((u: number, time: number) => void)[] = ENGINES.map(() => () => {});

  // ---------- overview: seven engines around the photo ----------
  const centre = heat(heatFile('gradcam_pp'), 2.3); setU(centre, 'uReveal', 0); overview.add(centre);
  const minis = ENGINES.map((e, i) => {
    const m = heat(heatFile(e), 1.5); const a = (i / 7) * Math.PI * 2; m.position.set(Math.cos(a) * 3.9, Math.sin(a) * 2.5, 0); overview.add(m);
    const l = label(NAMES[i], 0.28, '#bff5dc', 700); l.position.set(m.position.x, m.position.y - 1.0, 0); overview.add(l);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), m.position.clone().multiplyScalar(0.55)]), new THREE.LineBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.4 })); overview.add(line);
    return { m, l, line };
  });

  // ---------- 0 Grad-CAM: feature maps weighted and summed ----------
  {
    const g = eg[0]; const base = heat(heatFile('gradcam'), SIZE); g.add(base);
    const layers = Array.from({ length: 5 }, () => { const m = heat(heatFile('gradcam'), SIZE * 0.78); setU(m, 'uMix', 0.95); setU(m, 'uDim', 0); g.add(m); return m; });
    const cap = label('weights × feature maps', 0.34, '#7ee8bf', 700, '5 of 1,280 maps shown'); cap.position.set(0, -2.7, 0); g.add(cap);
    tickers[0] = (u, time) => {
      const merge = smooth(0.08, 0.45, u);
      layers.forEach((m, k) => {
        m.position.set(lerp((k - 2) * 0.55, 0, merge), lerp(1.0, 0, merge), lerp(1.3 - k * 0.55, 0.05, merge)); m.rotation.y = lerp(-0.5, 0, merge);
        setU(m, 'uReveal', lerp(0.35 + k * 0.13, 0.0, merge)); setU(m, 'uTime', time); (m.material as THREE.ShaderMaterial).uniforms.uAlpha.value = (1 - merge) * 0.55;
      });
      setU(base, 'uReveal', smooth(0.3, 0.62, u)); setU(base, 'uTime', time); base.rotation.y = lerp(0.4, 0, smooth(0.05, 0.4, u));
      setLocal(cap, 1 - smooth(0.55, 0.7, u));
    };
  }

  // ---------- 1 Grad-CAM++: lesions as peaks ----------
  {
    const g = eg[1];
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, 150, 150);
    const mat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide,
      uniforms: { uPhoto: { value: null }, uHeat: { value: null }, uFade: { value: 1 }, uAlpha: { value: 1 }, uH: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `uniform sampler2D uHeat; uniform float uH; varying vec2 vUv; varying float vH;
        void main(){ vUv = uv; float h = texture2D(uHeat, uv).r; vH = h; vec3 p = position; p.z += h * h * uH * 1.9; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `${GLSL_HEAT} uniform sampler2D uPhoto; uniform float uFade, uAlpha, uTime; varying vec2 vUv; varying float vH;
        void main(){ vec3 p = texture2D(uPhoto, vUv).rgb * 0.8; vec3 hc = heatRamp(vH) * (0.9 + 0.1 * sin(uTime * 3.0 + vH * 9.0)); gl_FragColor = vec4(mix(p, hc, smoothstep(0.04, 0.35, vH) * 0.92), uFade * uAlpha); }`,
    });
    bind(mat, 'uPhoto', 'photo.jpg'); bind(mat, 'uHeat', heatFile('gradcam_pp'));
    const mesh = new THREE.Mesh(geo, mat); g.add(mesh);
    const cap = label('each lesion becomes its own peak', 0.34, '#7ee8bf', 700); cap.position.set(0, -3.0, 0.5); g.add(cap);
    tickers[1] = (u, time) => { mat.uniforms.uH.value = easeOut(smooth(0.05, 0.5, u)); mat.uniforms.uTime.value = time; mesh.rotation.x = lerp(-0.1, -0.95, smooth(0.05, 0.45, u)); mesh.rotation.z = Math.sin(time * 0.3) * 0.08; mesh.position.y = lerp(0, 0.4, smooth(0.05, 0.45, u)); };
  }

  // ---------- 2 Saliency: every pixel votes ----------
  {
    const g = eg[2]; const dim = heat(heatFile('saliency'), SIZE); setU(dim, 'uReveal', 0); setU(dim, 'uDim', 0.3); g.add(dim);
    const N = 120; const pos = new Float32Array(N * N * 3), uvs = new Float32Array(N * N * 2), seed = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; pos.set([(i / (N - 1) - 0.5) * SIZE, (0.5 - j / (N - 1)) * SIZE, 0], k * 3); uvs.set([i / (N - 1), 1 - j / (N - 1)], k * 2); seed[k] = Math.random(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uHeat: { value: null }, uFade: { value: 1 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uAmt: { value: 0 } },
      vertexShader: `attribute vec2 aUv; attribute float aSeed; uniform sampler2D uHeat; uniform float uTime, uAmt; varying float vH; varying float vS;
        void main(){ float h = texture2D(uHeat, aUv).r; vH = h; vS = aSeed; vec3 p = position;
          float tw = sin(uTime * 7.0 + aSeed * 40.0); p.z += uAmt * (h * 0.9 + 0.05 * tw) * (0.4 + aSeed); p.xy += (vec2(fract(aSeed * 91.0), fract(aSeed * 37.0)) - 0.5) * 0.04 * tw * uAmt;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uAmt * (1.0 + 7.0 * pow(h, 0.7)) * (14.0 / -mv.z); }`,
      fragmentShader: `uniform float uFade, uAlpha; varying float vH; varying float vS; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; vec3 c = mix(vec3(0.1,0.5,0.9), vec3(1.0), pow(vH, 0.6)); gl_FragColor = vec4(c, (0.12 + 0.88 * pow(vH, 0.6)) * uFade * uAlpha * smoothstep(0.5, 0.15, d)); }`,
    });
    bind(mat, 'uHeat', heatFile('saliency'));
    g.add(new THREE.Points(geo, mat));
    const cap = label('gradient of the score at every pixel', 0.34, '#7dd3fc', 700, 'sharp, but noisy'); cap.position.set(0, -2.8, 0); g.add(cap);
    tickers[2] = (u, time) => { mat.uniforms.uAmt.value = smooth(0.05, 0.4, u); mat.uniforms.uTime.value = time; g.rotation.y = Math.sin(time * 0.3) * 0.25; };
  }

  // ---------- 3 SmoothGrad: noisy copies averaged ----------
  {
    const g = eg[3]; const avg = heat(heatFile('smoothgrad'), SIZE); g.add(avg);
    const copies = Array.from({ length: 6 }, (_, k) => { const m = heat(`smooth_${k}.png`, 1.9); setU(m, 'uMix', 0.95); setU(m, 'uDim', 0.35); g.add(m); return m; });
    const plus = label('average of 15 noisy copies (6 shown)', 0.34, '#7dd3fc', 700); plus.position.set(0, -2.9, 0); g.add(plus);
    tickers[3] = (u, time) => {
      const merge = smooth(0.15, 0.55, u);
      copies.forEach((m, k) => {
        const a = (k / 6) * Math.PI * 2 + time * 0.25 * (1 - merge); const r = 3.3 * (1 - merge);
        m.position.set(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.72, lerp(0.4 * Math.sin(k), 0, merge)); m.scale.setScalar(1 - 0.2 * merge);
        setU(m, 'uTime', time); (m.material as THREE.ShaderMaterial).uniforms.uAlpha.value = 1 - merge;
      });
      setU(avg, 'uReveal', smooth(0.3, 0.65, u)); setU(avg, 'uTime', time);
    };
  }

  // ---------- 4 Integrated Gradients: from black to the photo ----------
  {
    const g = eg[4]; const main = heat(heatFile('ig'), 3.6); setU(main, 'uDim', 1); setU(main, 'uMix', 0.95); (main.material as THREE.ShaderMaterial).uniforms.uGamma.value = 0.8; main.position.set(0, -0.5, 0); g.add(main);
    const steps = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const path = steps.map((a, i) => { const m = imagePlane(sampleTex(ctx.sample, 'photo.jpg'), 1.05, 1.05); bind(m.material as THREE.ShaderMaterial, 'uMap', 'photo.jpg'); setU(m, 'uBright', Math.max(0.04, a)); m.position.set(-3.1 + i * 1.24, 2.55, 0); g.add(m); const l = label(`α = ${a.toFixed(1)}`, 0.24, '#d8b4fe', 700); l.position.set(m.position.x, m.position.y - 0.78, 0); g.add(l); return m; });
    const walker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshBasicMaterial({ color: 0xe9d5ff })); g.add(walker);
    const cap = label('add up the gradient along the path (20 steps)', 0.34, '#d8b4fe', 700, 'in our tests this engine scored worst'); cap.position.set(0, -2.8, 0); g.add(cap);
    tickers[4] = (u, time) => {
      const w = smooth(0.05, 0.5, u);
      path.forEach((m, i) => { setU(m, 'uReveal', smooth(i * 0.06, i * 0.06 + 0.14, u * 1.8)); });
      const idx = w * 5, i0 = Math.min(4, Math.floor(idx)), f = idx - i0;
      walker.position.set(lerp(path[i0].position.x, path[i0 + 1].position.x, f), lerp(path[i0].position.y, path[i0 + 1].position.y, f) - 0.2, 0.2);
      (walker.material as THREE.MeshBasicMaterial).userData.local = 0.6 + 0.4 * Math.sin(time * 8);
      setU(main, 'uReveal', smooth(0.25, 0.65, u)); setU(main, 'uTime', time);
    };
  }

  // ---------- 5 SHAP: hide a patch, watch the score ----------
  {
    const g = eg[5]; const base = heat(heatFile('shap'), SIZE); setU(base, 'uReveal', 0); setU(base, 'uDim', 0.55); g.add(base);
    const T = SIZE / 8; const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(T * 0.94, T * 0.94, 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), 64);
    tiles.frustumCulled = false; g.add(tiles);
    const dummy = new THREE.Object3D(); const col = new THREE.Color();
    const drops = (): readonly number[] => sampleData(shapKey).shapDrops;
    let shapKey: SampleKey = ctx.sample; rebinds.push(k => { shapKey = k; });
    const info = label('score drop when this patch is hidden', 0.34, '#fcd34d', 700, '64 patches · real drops for this photo'); info.position.set(0, -2.9, 0); g.add(info);
    tickers[5] = (u) => {
      const d = drops(); const mx = Math.max(...d.map(Math.abs), 1e-6);
      const prog = smooth(0.04, 0.6, u) * 64;
      for (let k = 0; k < 64; k++) {
        const r = Math.floor(k / 8), c = k % 8;
        const p = clamp(prog - k, 0, 1);
        const lift = Math.sin(clamp(p * 1.4) * Math.PI) * 0.9;
        dummy.position.set((c - 3.5) * T, (3.5 - r) * T, 0.06 + lift); dummy.scale.setScalar(p > 0 ? 1 : 0.0001); dummy.updateMatrix(); tiles.setMatrixAt(k, dummy.matrix);
        const dark = p > 0 && p < 0.7; const v = clamp(Math.max(0, d[k]) / mx);
        if (dark) col.setRGB(0.02, 0.02, 0.03); else col.copy(ramp(v));
        tiles.setColorAt(k, col);
      }
      tiles.instanceMatrix.needsUpdate = true; if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      (tiles.material as THREE.MeshBasicMaterial).userData.baseOpacity = 0.78;
    };
  }

  // ---------- 6 LIME: switch superpixels on and off ----------
  {
    const g = eg[6];
    const mkLime = (size: number, seed: number) => {
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uPhoto: { value: null }, uSeg: { value: null }, uHeat: { value: null }, uFade: { value: 1 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uReveal: { value: 0 }, uSeed: { value: seed } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `${GLSL_HEAT} uniform sampler2D uPhoto, uSeg, uHeat; uniform float uFade, uAlpha, uTime, uReveal, uSeed; varying vec2 vUv;
          void main(){
            vec3 p = texture2D(uPhoto, vUv).rgb; float id = floor(texture2D(uSeg, vUv).r * 255.0 + 0.5);
            float tick = floor(uTime * 2.2 + uSeed * 17.0); float on = step(0.42, hash21(vec2(id, tick + uSeed)));
            vec3 s = mix(vec3(0.5), p, on);
            float e = 0.0; vec2 d = vec2(1.0 / 224.0);
            if (floor(texture2D(uSeg, vUv + vec2(d.x, 0.0)).r * 255.0 + 0.5) != id || floor(texture2D(uSeg, vUv + vec2(0.0, d.y)).r * 255.0 + 0.5) != id) e = 1.0;
            float h = texture2D(uHeat, vUv).r;
            vec3 col = mix(s, mix(p * 0.6, heatRamp(h), 0.8), uReveal * smoothstep(0.0, 0.1, h) + uReveal * 0.25 * (1.0 - smoothstep(0.0, 0.1, h)));
            col = mix(col, vec3(0.5, 1.0, 0.8), e * 0.5);
            gl_FragColor = vec4(col, uFade * uAlpha);
          }`,
      });
      bind(m, 'uPhoto', 'photo.jpg'); bind(m, 'uSeg', 'lime_segments.png', true); bind(m, 'uHeat', heatFile('lime'));
      return new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
    };
    const main = mkLime(SIZE, 0); g.add(main);
    const minis2 = Array.from({ length: 5 }, (_, k) => { const m = mkLime(1.25, k + 1); m.position.set(3.7 + (k % 2) * 1.45, 1.9 - Math.floor(k / 2) * 1.45, 0); g.add(m); return m; });
    const cap = label(`${sampleData(ctx.sample).limeSegments} superpixels · about 40 copies · simple model on top`, 0.34, '#7dd3fc', 700); cap.position.set(0, -2.9, 0); g.add(cap);
    tickers[6] = (u, time) => {
      (main.material as THREE.ShaderMaterial).uniforms.uTime.value = time; setU(main, 'uReveal', smooth(0.35, 0.65, u));
      minis2.forEach(m => { (m.material as THREE.ShaderMaterial).uniforms.uTime.value = time; (m.material as THREE.ShaderMaterial).uniforms.uAlpha.value = 1 - smooth(0.4, 0.65, u); });
    };
  }

  return {
    range: [9, 16], group,
    update(t, time) {
      const pos = 8.5 + 8 * t;
      // overview (chapter 9)
      const ov = 1 - smooth(9.15, 9.6, pos);
      setGroupAlpha(overview, ov);
      setU(centre, 'uTime', time);
      minis.forEach((m, i) => { const ang = (i / 7) * Math.PI * 2 + time * 0.12; m.m.position.set(Math.cos(ang) * 3.9, Math.sin(ang) * 2.5, 0); m.l.position.set(m.m.position.x, m.m.position.y - 1.0, 0); { const arr = m.line.geometry.attributes.position.array as Float32Array; arr[3] = m.m.position.x * 0.55; arr[4] = m.m.position.y * 0.55; m.line.geometry.attributes.position.needsUpdate = true; } setU(m.m, 'uTime', time + i); setU(m.m, 'uReveal', 0.55 + 0.45 * smooth(8.9 + i * 0.05, 9.3 + i * 0.05, pos)); m.m.position.z = Math.sin(time * 1.2 + i) * 0.25; });
      setU(centre, 'uReveal', smooth(9.0, 9.4, pos));
      // engines
      eg.forEach((g, k) => {
        const c = 10 + k; const w = smooth(c - 0.62, c - 0.3, pos) * (1 - smooth(c + 0.3, c + 0.62, pos));
        setGroupAlpha(g, w);
        if (w > 0.004) tickers[k](clamp((pos - (c - 0.5)) / 1), time);
        g.position.z = (1 - w) * -1.5;
      });
    },
    camera(t) { const pos = 8.5 + 8 * t; return { p: [0, 0.4, 9.6 + 0.6 * Math.sin(pos * 0.7)], l: [0, -0.1, 0] }; },
    setSample(k) { rebinds.forEach(r => r(k)); },
    dispose() {},
  };
}
