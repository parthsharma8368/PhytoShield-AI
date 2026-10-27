import * as THREE from 'three';
import { SHOWCASE as S } from '../../generated/showcase';
import { COLORS, clamp, easeOut, label, lerp, setLocal, smooth, type Stage } from '../core';

const NAME: Record<string, string> = { gradcam: 'Grad-CAM', gradcam_pp: 'Grad-CAM++', shap: 'SHAP', lime: 'LIME', smoothgrad: 'SmoothGrad', saliency: 'Saliency', random: 'Random', ig: 'Integrated\nGradients' };
const PERT: [string, string][] = [['clean', 'Clean'], ['brightness_x0.5', 'Dark ×0.5'], ['brightness_x1.5', 'Bright ×1.5'], ['jpeg_q15', 'JPEG q15'], ['occlusion_25pct', '25% hidden'], ['background_removed', 'No background'], ['gaussian_noise_0.10', 'Noise'], ['gaussian_blur_r3', 'Blur']];

/** Two 3D bar charts built from real measurements: deletion AUC per engine (vs random) and accuracy under image changes. */
export function createMetrics(): Stage {
  const group = new THREE.Group();
  const mkSet = (items: { text: string; v: number; color: number; shown: string }[], max: number, height: number, refLine?: { v: number; text: string }) => {
    const g = new THREE.Group(); const gap = 1.62, x0 = -((items.length - 1) * gap) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(items.length * gap + 1.4, 3.2), new THREE.MeshBasicMaterial({ color: 0x0b2a1f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; g.add(floor);
    const grid = new THREE.GridHelper(items.length * gap + 1.4, items.length * 2, 0x1f8a5b, 0x124432); grid.scale.z = 3.2 / (items.length * gap + 1.4); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.5; g.add(grid);
    const bars = items.map((it, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.8), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.92 })); m.position.x = x0 + i * gap; g.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.8, 1, 0.8)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); e.position.x = m.position.x; g.add(e);
      const l = label(it.text, 0.34, '#e8f5ee', 700); l.position.set(m.position.x, -0.55, 1.1); g.add(l);
      const v = label(it.shown, 0.42, '#ffffff', 800); g.add(v);
      return { m, e, l, v, val: it.v };
    });
    let ref: THREE.Mesh | null = null, refL: THREE.Sprite | null = null;
    if (refLine) {
      ref = new THREE.Mesh(new THREE.PlaneGeometry(items.length * gap + 0.6, 0.03), new THREE.MeshBasicMaterial({ color: COLORS.amber, transparent: true, opacity: 0.95 })); ref.position.set(0, (refLine.v / max) * height, 0.9); g.add(ref);
      refL = label(refLine.text, 0.4, '#fcd34d', 700); refL.position.set(x0 - 1.7, (refLine.v / max) * height, 0.9); g.add(refL);
    }
    return { g, bars, ref, refL, height, max, floor, grid };
  };
  const del = S.deletionAuc as Record<string, number>;
  const order = ['gradcam', 'gradcam_pp', 'shap', 'lime', 'smoothgrad', 'saliency', 'random', 'ig'];
  const setA = mkSet(order.map(k => ({ text: NAME[k], v: del[k], shown: del[k].toFixed(3), color: k === 'random' ? COLORS.amber : del[k] < del.random ? COLORS.green : COLORS.grey })).map((it, i) => (order[i] === 'ig' ? { ...it, color: COLORS.red } : it)), 0.42, 4.6, { v: del.random, text: 'random 0.326' });
  const P = S.perturbation as Record<string, number>;
  const setB = mkSet(PERT.map(([k, t]) => ({ text: t, v: P[k], shown: `${P[k]}%`, color: P[k] > 90 ? COLORS.green : P[k] > 70 ? COLORS.amber : COLORS.red })), 100, 4.6);
  setA.g.position.set(0, -1.7, 0); setB.g.position.set(0, -1.7, 0); group.add(setA.g, setB.g);
  const tA = label('Deletion AUC · lower = removing the highlighted pixels hurts the model faster', 0.42, '#7ee8bf', 700, '300 test photos per engine'); tA.position.set(0, 3.5, 0); group.add(tA);
  const tB = label('Test accuracy after changing every image', 0.46, '#fcd34d', 700, '3,107 photos × 8 changes'); tB.position.set(0, 3.5, 0); group.add(tB);

  const run = (s: ReturnType<typeof mkSet>, k: number, gf: number) => {
    s.g.visible = gf > 0.003;
    (s.floor.material as THREE.Material).userData.local = gf; (s.grid.material as THREE.Material).userData.local = gf * 0.5;
    s.bars.forEach((b, i) => {
      const grow = easeOut(clamp(k * 1.5 - i * 0.07)); const h = Math.max(0.02, (b.val / s.max) * s.height * grow);
      b.m.scale.y = h; b.m.position.y = h / 2; b.e.scale.y = h; b.e.position.y = h / 2;
      b.v.position.set(b.m.position.x, h + 0.45, 0);
      (b.m.material as THREE.Material).userData.local = gf; (b.e.material as THREE.Material).userData.local = gf;
      setLocal(b.v, gf * smooth(0.5, 0.9, grow)); setLocal(b.l, gf * smooth(0.0, 0.4, grow));
    });
    if (s.ref) (s.ref.material as THREE.Material).userData.local = gf * (k > 0.2 ? 1 : 0); if (s.refL) setLocal(s.refL, gf * smooth(0.2, 0.4, k));
  };
  return {
    range: [17, 18], group,
    update(t, time) {
      const fa = smooth(0.0, 0.1, t) * (1 - smooth(0.42, 0.52, t)), fb = smooth(0.5, 0.6, t);
      run(setA, smooth(0.02, 0.38, t), fa); run(setB, smooth(0.54, 0.92, t), fb);
      setLocal(tA, fa); setLocal(tB, fb);
      group.rotation.y = Math.sin(time * 0.2) * 0.1 + lerp(-0.15, 0.15, t);
    },
    camera(t) { return { p: [lerp(-2, 2, t), 3.2, 13.5], l: [0, 1.2, 0] }; },
    dispose() {},
  };
}
