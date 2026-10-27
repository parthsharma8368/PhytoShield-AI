import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { applyFade, clamp, disposeGroup, disposeTextures, smooth, type SampleKey, type Stage } from './core';

THREE.ColorManagement.enabled = false;

export interface StageCtx { camera: THREE.PerspectiveCamera; sample: SampleKey }
export type StageFactory = (ctx: StageCtx) => Stage;

export class ShowcaseScene {
  private renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  private composer: EffectComposer | null = null;
  stages: Stage[] = [];
  private stars: THREE.Points;
  pos = 0; smoothPos = 0; side = 0; smoothSide = 0; lift = 0; smoothLift = 0;
  private mouse = new THREE.Vector2(); private smoothMouse = new THREE.Vector2();
  private clock = new THREE.Clock();
  private raf = 0; private disposed = false;
  private look = new THREE.Vector3(); private camP = new THREE.Vector3();

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, factories: StageFactory[], sample: SampleKey) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x040d09, 1);
    this.scene.fog = new THREE.FogExp2(0x040d09, 0.018);

    const n = 2600, a = new Float32Array(n * 3), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 30 + Math.random() * 60, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      a.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
      const tint = Math.random(); c.set([0.35 + 0.3 * tint, 0.75 + 0.2 * tint, 0.6 + 0.3 * (1 - tint)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }));
    this.scene.add(this.stars);

    const ctx: StageCtx = { camera: this.camera, sample };
    this.stages = factories.map(f => f(ctx));
    this.stages.forEach(s => { this.scene.add(s.group); s.group.visible = false; });

    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.34, 0.5, 0.8));
    } catch { this.composer = null; }

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onMove);
    this.loop();
  }

  setPos(p: number, side: number, lift = 0) { this.pos = p; this.side = side; this.lift = lift; }
  setSample(k: SampleKey) { this.stages.forEach(s => s.setSample?.(k)); }

  private onMove = (e: PointerEvent) => { this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1)); };

  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(dpr); this.composer?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.tick();
  };

  /** One simulation + render step (also callable directly for debugging). */
  tick = () => {
    const dt = Math.min(this.clock.getDelta(), 0.05), time = this.clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 5);
    this.smoothPos += (this.pos - this.smoothPos) * k;
    this.smoothSide += (this.side - this.smoothSide) * (1 - Math.exp(-dt * 3));
    this.smoothLift += (this.lift - this.smoothLift) * (1 - Math.exp(-dt * 3));
    this.smoothMouse.lerp(this.mouse, 1 - Math.exp(-dt * 3));
    const pos = this.smoothPos;

    const p = new THREE.Vector3(), l = new THREE.Vector3(); let wsum = 0;
    this.stages.forEach(s => {
      const [a, b] = s.range;
      const w = smooth(a - 0.62, a - 0.12, pos) * (1 - smooth(b + 0.38, b + 0.88, pos));
      const vis = w > 0.003;
      s.group.visible = vis;
      if (!vis) return;
      const t = clamp((pos - (a - 0.5)) / (b - a + 1));
      s.update(t, time);
      applyFade(s.group, w);
      const c = s.camera(t);
      p.x += c.p[0] * w; p.y += c.p[1] * w; p.z += c.p[2] * w; l.x += c.l[0] * w; l.y += c.l[1] * w; l.z += c.l[2] * w; wsum += w;
    });
    if (wsum > 0) { p.divideScalar(wsum); l.divideScalar(wsum); } else { p.set(0, 0, 10); }

    this.camP.copy(p); this.look.copy(l);
    const right = new THREE.Vector3().subVectors(l, p).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const dist = p.distanceTo(l);
    const shift = right.multiplyScalar(this.smoothSide * dist * 0.18).add(new THREE.Vector3(0, -this.smoothLift * dist * 0.13, 0));
    this.camera.position.copy(this.camP).add(shift).add(new THREE.Vector3(this.smoothMouse.x * 0.45, this.smoothMouse.y * 0.28, 0));
    this.camera.lookAt(this.look.clone().add(shift));
    this.stars.rotation.y = time * 0.01 + pos * 0.05; this.stars.rotation.x = pos * 0.02;

    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize); window.removeEventListener('pointermove', this.onMove);
    this.stages.forEach(s => { s.dispose(); disposeGroup(s.group); });
    disposeGroup(this.stars); disposeTextures();
    this.composer?.dispose(); this.renderer.dispose();
  }
}
