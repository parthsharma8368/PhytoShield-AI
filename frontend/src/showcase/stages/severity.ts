import * as THREE from 'three';
import { COLORS, clamp, imagePlane, label, lerp, sampleData, sampleTex, setLocal, setU, smooth, type SampleKey, type Stage } from '../core';
import type { StageCtx } from '../scene';

/** Photo -> leaf found -> damage found, as an exploding stack of three real layers with a scanning beam. */
export function createSeverity(ctx: StageCtx): Stage {
  const group = new THREE.Group();
  const files = ['photo.jpg', 'sev_leaf.jpg', 'sev_damage.jpg'];
  const planes = files.map(f => { const p = imagePlane(sampleTex(ctx.sample, f), 4.2, 4.2); group.add(p); return p; });
  const titles = [['1 · The photo', 'what the camera saw'], ['2 · Leaf found', 'GrabCut mask, background dimmed'], ['3 · Damage found', 'discoloured pixels in red']];
  const labels = titles.map(([a, b]) => { const l = label(a, 0.42, '#e8f5ee', 700, b); group.add(l); return l; });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.05), new THREE.MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.95 })); group.add(beam);
  const pctLbl = () => `${sampleData(key).damagePct}% of the leaf`;
  let key: SampleKey = ctx.sample;
  let big = label(pctLbl(), 0.8, '#ff9b8f', 800, 'measured from colour'); big.position.set(0, -3.3, 0.6); group.add(big);
  const rebuild = () => { group.remove(big); (big.material as THREE.SpriteMaterial).map?.dispose(); big = label(pctLbl(), 0.8, '#ff9b8f', 800, 'measured from colour'); big.position.set(0, -3.3, 0.6); group.add(big); };
  return {
    range: [19, 19], group,
    update(t, time) {
      const ex = smooth(0.05, 0.6, t), scan = smooth(0.35, 0.9, t);
      planes.forEach((p, i) => {
        p.position.set((i - 1) * 4.7 * ex, 0, -i * 1.1 * (1 - ex)); p.rotation.y = (1 - ex) * 0.5 - 0.15;
        setU(p, 'uReveal', smooth(i * 0.12, i * 0.12 + 0.25, t * 1.4));
        labels[i].position.set(p.position.x, -2.8, 0.2); setLocal(labels[i], ex);
      });
      planes[2].position.z += Math.sin(time * 1.5) * 0.03;
      beam.position.set(planes[2].position.x, lerp(2.1, -2.1, scan), 0.2); (beam.material as THREE.MeshBasicMaterial).userData.local = scan > 0.01 && scan < 0.99 ? 1 : 0;
      setU(planes[2], 'uBright', 0.85 + 0.15 * Math.sin(time * 3));
      setLocal(big, smooth(0.8, 0.95, t)); big.position.x = planes[2].position.x; big.position.y = -4.0;
    },
    camera(t) { const ex = smooth(0.05, 0.6, t); return { p: [lerp(0, 0, ex), 0.4, lerp(9, 13.2, ex)], l: [0, -0.4, 0] }; },
    setSample(k) { key = k; planes.forEach((p, i) => ((p.material as THREE.ShaderMaterial).uniforms.uMap.value = sampleTex(k, files[i]))); rebuild(); },
    dispose() { void clamp; },
  };
}
