import * as THREE from 'three';
import { COLORS, clamp, imagePlane, label, sampleTex, setU, smooth, type SampleKey, type Stage } from '../core';
import type { StageCtx } from '../scene';

/** Photo -> resize -> center crop -> normalize -> augmentation fan, laid out along x with glowing gates. */
export function createPreprocess(ctx: StageCtx): Stage {
  const group = new THREE.Group();
  const xs = [-8.4, -4.2, 0, 4.2];
  const sizes = [3.2, 2.3, 2.3, 2.3];
  const files = ['photo.jpg', 'crop224.jpg', 'crop224.jpg', 'norm.png'];
  const planes = xs.map((x, i) => { const p = imagePlane(sampleTex(ctx.sample, files[i]), sizes[i], sizes[i]); p.position.set(x, 0.4, 0); group.add(p); return p; });
  const names = [['Original photo', '256 × 256 px'], ['Resize', '224 × 224 px'], ['Center crop', '224 × 224 px'], ['Normalize', 'ImageNet mean / std']];
  names.forEach(([a, b], i) => { const l = label(a, 0.42, '#e8f5ee', 700, b); l.position.set(xs[i], -1.9, 0); group.add(l); });

  // brackets around the crop plane that snap in
  const br = new THREE.Group(); br.position.set(xs[2], 0.4, 0.05);
  const cm = new THREE.LineBasicMaterial({ color: COLORS.mint, transparent: true });
  [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx * 1.15, sy * 0.7, 0), new THREE.Vector3(sx * 1.15, sy * 1.15, 0), new THREE.Vector3(sx * 0.7, sy * 1.15, 0)]);
    br.add(new THREE.Line(g, cm));
  });
  group.add(br);

  // gates between stations + travelling data packets
  const gates: THREE.Mesh[] = []; const packets: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const gx = (xs[i] + xs[i + 1]) / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.8 }));
    ring.rotation.y = Math.PI / 2; ring.position.set(gx, 0.4, 0); gates.push(ring); group.add(ring);
    const pk = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshBasicMaterial({ color: COLORS.mint, transparent: true }));
    packets.push(pk); group.add(pk);
  }
  // augmentation fan
  const augFiles = ['aug_flip.jpg', 'aug_rot.jpg', 'aug_zoom.jpg', 'aug_jitter.jpg'];
  const augNames = ['Flip', 'Rotate ±20°', 'Zoom crop', 'Brightness / contrast'];
  const augPos: [number, number][] = [[8.0, 1.5], [10.3, 1.5], [8.0, -1.1], [10.3, -1.1]];
  const augs = augFiles.map((f, i) => { const p = imagePlane(sampleTex(ctx.sample, f), 1.9, 1.9); p.position.set(augPos[i][0], augPos[i][1], 0); group.add(p); const l = label(augNames[i], 0.3, '#bff5dc', 600); l.position.set(augPos[i][0], augPos[i][1] - 1.2, 0); group.add(l); return p; });
  const trainOnly = label('Training only', 0.5, '#fcd34d', 700, 'four mild augmentations'); trainOnly.position.set(9.15, 3.25, 0); group.add(trainOnly);

  return {
    range: [4, 4], group,
    update(t, time) {
      const u = clamp(t * 1.15);
      planes.forEach((p, i) => setU(p, 'uReveal', smooth(i * 0.14, i * 0.14 + 0.2, u)));
      augs.forEach((p, i) => setU(p, 'uReveal', smooth(0.55 + i * 0.07, 0.75 + i * 0.07, u)));
      br.scale.setScalar(1.25 - 0.25 * smooth(0.25, 0.5, u) + 0.03 * Math.sin(time * 3));
      gates.forEach((g, i) => { g.rotation.z = time * (0.6 + i * 0.2); });
      packets.forEach((pk, i) => { const f = (time * 0.55 + i * 0.33) % 1; pk.position.set(xs[i] + (xs[i + 1] - xs[i]) * f, 0.4 + Math.sin(f * Math.PI * 2) * 0.15, 0.1); });
    },
    camera(t) { const x = -5 + 13 * smooth(0.05, 0.95, t); return { p: [x, 1.6, 11.5], l: [x, 0.2, 0] }; },
    setSample(k: SampleKey) { planes.forEach((p, i) => ((p.material as THREE.ShaderMaterial).uniforms.uMap.value = sampleTex(k, files[i]))); augs.forEach((p, i) => ((p.material as THREE.ShaderMaterial).uniforms.uMap.value = sampleTex(k, augFiles[i]))); },
    dispose() {},
  };
}
