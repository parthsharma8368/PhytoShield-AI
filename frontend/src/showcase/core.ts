import * as THREE from 'three';
import { SHOWCASE } from '../generated/showcase';

export const SAMPLE_KEYS = ['tomato', 'potato', 'pepper'] as const;
export type SampleKey = typeof SAMPLE_KEYS[number];
export const sampleData = (k: SampleKey | 'hard') => SHOWCASE.samples[k];

export const COLORS = {
  mint: 0x34d399, green: 0x1f8a5b, cyan: 0x22d3ee, amber: 0xf59e0b, red: 0xef4444, violet: 0x8b5cf6, blue: 0x3b82f6, ink: 0x06120d, grey: 0x6b7f75,
};

/** One 3D chapter group. `update` gets local progress 0..1 across the stage's scroll span. */
export interface Stage {
  /** First and last chapter index this stage covers (inclusive). */
  range: [number, number];
  group: THREE.Group;
  update(t: number, time: number): void;
  /** Camera position and look-at for local progress t. */
  camera(t: number): { p: [number, number, number]; l: [number, number, number] };
  setSample?(key: SampleKey): void;
  dispose(): void;
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
export function tex(url: string): THREE.Texture {
  const key = url;
  let t = cache.get(key);
  if (!t) {
    t = loader.load(url);
    t.colorSpace = THREE.NoColorSpace; // colour management is off for the showcase: every colour is used as authored
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    cache.set(key, t);
  }
  return t;
}
export const sampleTex = (key: SampleKey | 'hard', file: string) => tex(`/showcase/${key}/${file}`);
export function disposeTextures() { cache.forEach(t => t.dispose()); cache.clear(); }

/** Text sprite drawn on a canvas. Returns a sprite whose world height is `height`. */
export function label(text: string, height = 0.5, color = '#e8f5ee', weight = 600, sub?: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const px = 96, subPx = 54;
  const font = `${weight} ${px}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.font = font;
  const w1 = ctx.measureText(text).width;
  ctx.font = `500 ${subPx}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const w2 = sub ? ctx.measureText(sub).width : 0;
  c.width = Math.ceil(Math.max(w1, w2)) + 40; c.height = sub ? px + subPx + 56 : px + 40;
  ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
  ctx.fillText(text, c.width / 2, 20);
  if (sub) { ctx.font = `500 ${subPx}px "Plus Jakarta Sans", system-ui, sans-serif`; ctx.fillStyle = 'rgba(180,205,192,0.9)'; ctx.fillText(sub, c.width / 2, px + 34); }
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(height * (c.width / c.height), height, 1);
  s.userData.baseOpacity = 1;
  return s;
}

/** Fragment helper: turbo-like colour ramp used by every heatmap shader. */
export const GLSL_HEAT = /* glsl */ `
vec3 heatRamp(float t){
  t = clamp(t, 0.0, 1.0);
  vec3 a = vec3(0.04,0.06,0.35), b = vec3(0.0,0.75,0.95), c = vec3(0.35,0.95,0.35), d = vec3(1.0,0.85,0.1), e = vec3(0.95,0.1,0.05);
  if (t < 0.25) return mix(a, b, t/0.25);
  if (t < 0.5)  return mix(b, c, (t-0.25)/0.25);
  if (t < 0.75) return mix(c, d, (t-0.5)/0.25);
  return mix(d, e, (t-0.75)/0.25);
}
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x), mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y); }
`;

/** Apply a 0..1 stage fade to every material under a group. Works for Basic/Sprite/Points and ShaderMaterials with uFade. */
export function applyFade(group: THREE.Object3D, f: number) {
  group.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      const sm = mat as THREE.ShaderMaterial;
      if (sm.uniforms && sm.uniforms.uFade) { sm.uniforms.uFade.value = f; continue; }
      if (mat.userData.baseOpacity === undefined) mat.userData.baseOpacity = mat.opacity;
      mat.transparent = true; mat.opacity = mat.userData.baseOpacity * f * (mat.userData.local ?? 1);
    }
  });
}

/** Dissolve-in textured plane (noise burn edge). `uReveal` 0..1 controls the dissolve; uFade is the stage fade. */
export function imagePlane(texture: THREE.Texture, w: number, h: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uMap: { value: texture }, uFade: { value: 1 }, uAlpha: { value: 1 }, uReveal: { value: 1 }, uBright: { value: 0.82 }, uEdge: { value: new THREE.Color(COLORS.mint) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `${GLSL_HEAT}
      uniform sampler2D uMap; uniform float uFade, uAlpha, uReveal, uBright; uniform vec3 uEdge; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(uMap, vUv);
        float n = vnoise(vUv * 14.0);
        float thr = uReveal * 1.25 - 0.1;
        float a = smoothstep(n - 0.05, n + 0.05, thr);
        float edge = smoothstep(n - 0.14, n - 0.02, thr) * (1.0 - smoothstep(n - 0.02, n + 0.06, thr));
        vec3 col = c.rgb * uBright + uEdge * edge * 2.0;
        gl_FragColor = vec4(col, (a * c.a + edge * 0.6) * uFade * uAlpha);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return mesh;
}

/** Plane showing a photo with a heatmap composited on top (colour ramp, adjustable threshold and pulse). */
export function heatPlane(photo: THREE.Texture, heat: THREE.Texture, size: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uPhoto: { value: photo }, uHeat: { value: heat }, uFade: { value: 1 }, uAlpha: { value: 1 }, uReveal: { value: 1 }, uTime: { value: 0 }, uMix: { value: 0.75 }, uDim: { value: 0.85 }, uGamma: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `${GLSL_HEAT}
      uniform sampler2D uPhoto, uHeat; uniform float uFade, uAlpha, uReveal, uTime, uMix, uDim, uGamma; varying vec2 vUv;
      void main(){
        vec3 p = texture2D(uPhoto, vUv).rgb * uDim;
        float h = pow(texture2D(uHeat, vUv).r, uGamma);
        float pulse = 0.88 + 0.12 * sin(uTime * 2.4 + h * 8.0);
        float show = smoothstep(1.0 - uReveal - 0.001, 1.0 - uReveal + 0.18, h);
        vec3 hc = heatRamp(h) * pulse;
        vec3 col = mix(p, mix(p, hc, uMix), show * smoothstep(0.02, 0.2, h));
        col += hc * show * h * h * 0.35;
        gl_FragColor = vec4(col, uFade * uAlpha);
      }`,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
}

export function setU(mesh: THREE.Mesh, name: string, v: number) {
  ((mesh.material as THREE.ShaderMaterial).uniforms[name]).value = v;
}

export function disposeGroup(g: THREE.Object3D) {
  g.traverse(o => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) for (const x of Array.isArray(mat) ? mat : [mat]) { (x as THREE.SpriteMaterial).map?.dispose?.(); x.dispose(); }
  });
}

/** Per-object opacity multiplier (on top of the stage fade). Works for sprites and basic materials. */
export function setLocal(o: THREE.Object3D, v: number) {
  const m = (o as THREE.Mesh).material as THREE.Material | undefined;
  if (m) m.userData.local = v;
}

/** Fade a sub-tree independently of the stage fade (shader materials use uAlpha, others use the local multiplier). */
export function setGroupAlpha(g: THREE.Object3D, v: number) {
  g.visible = v > 0.004;
  g.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      const sm = mat as THREE.ShaderMaterial;
      if (sm.uniforms && sm.uniforms.uAlpha) sm.uniforms.uAlpha.value = v; else mat.userData.local = v;
    }
  });
}
