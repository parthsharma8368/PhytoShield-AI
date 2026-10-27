import * as THREE from 'three';
import { SHOWCASE as S } from '../../generated/showcase';
import { COLORS, clamp, easeOut, label, lerp, setLocal, smooth, type Stage } from '../core';

const SIZE_H: Record<number, number> = { 112: 2.7, 56: 2.1, 28: 1.6, 14: 1.2, 7: 0.9 };
const fmtP = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} k` : String(n));

/** EfficientNet-B0 as a row of glowing blocks with a live signal, then frozen / trainable colouring and the real training curves. */
export function createNetwork(): Stage {
  const group = new THREE.Group();
  const net = new THREE.Group(); group.add(net);
  const blocks = S.blocks.map(b => ({ ...b, w: 0.35 + Math.sqrt(b.channels) * 0.07, h: SIZE_H[b.size] }));
  const gap = 0.95; let cursor = 0; const xs: number[] = [];
  blocks.forEach(b => { xs.push(cursor + b.w / 2); cursor += b.w + gap; });
  const poolX = cursor + 0.2, dropX = poolX + 1.5, linX = dropX + 1.5, outX = linX + 2.4; const total = outX + 0.5;
  const shift = -total / 2; net.position.x = shift;

  const meshes = blocks.map((b, i) => {
    const g = new THREE.Group(); g.position.set(xs[i], 0, 0);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.h), new THREE.MeshBasicMaterial({ color: COLORS.green, transparent: true, opacity: 0.2, depthWrite: false }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(fill.geometry), new THREE.LineBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.9 }));
    g.add(fill, edge);
    const n = Math.min(7, 2 + Math.round(Math.log2(b.channels)));
    for (let k = 0; k < n; k++) {
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(b.h * 0.86, b.h * 0.86), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
      slab.rotation.y = Math.PI / 2; slab.position.x = (k / Math.max(1, n - 1) - 0.5) * b.w * 0.8; g.add(slab);
    }
    const l = label(`features[${i}]`, 0.36, '#e8f5ee', 700, `${b.channels} ch · ${b.size}² · ${fmtP(b.params)}`); l.position.set(0, -b.h / 2 - 0.6, 0); g.add(l);
    net.add(g); return { g, fill, edge, label: l };
  });
  const mk = (geo: THREE.BufferGeometry, color: number, x: number) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })); m.position.x = x; net.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color, transparent: true })); e.position.x = x; net.add(e); return m; };
  mk(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 24), COLORS.amber, poolX).rotation.z = Math.PI / 2;
  mk(new THREE.BoxGeometry(0.3, 1.6, 1.6), COLORS.violet, dropX);
  mk(new THREE.BoxGeometry(0.9, 1.9, 1.9), COLORS.amber, linX);
  [['global pool', poolX], ['dropout 0.3', dropX], [`linear 1280 → 15 · ${fmtP(S.headParams)}`, linX]].forEach(([t, x]) => { const l = label(String(t), 0.34, '#fcd34d', 700); l.position.set(x as number, -1.8, 0); net.add(l); });
  const outs = S.classes.map((_, i) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), new THREE.MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.9 })); o.position.set(outX, (i - 7) * 0.34, 0); net.add(o); return o; });
  const outLbl = label('15 class scores', 0.4, '#7ee8bf', 700); outLbl.position.set(outX, 3.1, 0); net.add(outLbl);

  // signal pulses
  const PN = 70; const pg = new THREE.BufferGeometry(); const pp = new Float32Array(PN * 3); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pmat = new THREE.PointsMaterial({ color: 0xbffff0, size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  net.add(new THREE.Points(pg, pmat));

  // ------- training curves -------
  const curves = new THREE.Group(); curves.position.set(0, -6.8, 0); group.add(curves);
  const H = S.history, W = 17, CH = 4.2, x0 = -W / 2;
  const ex = (e: number) => x0 + (e / 19) * W;
  const ay = (v: number) => ((v - 50) / 50) * CH, ly = (v: number) => (v / 2.1) * CH;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, CH + 1.6), new THREE.MeshBasicMaterial({ color: 0x07241a, transparent: true, opacity: 0.55, depthWrite: false })); panel.position.set(0, CH / 2, -0.3); curves.add(panel);
  const band = (a: number, b: number, color: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(ex(b) - ex(a), CH + 1.2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false })); m.position.set((ex(a) + ex(b)) / 2, CH / 2, -0.2); curves.add(m); };
  band(0, 4.5, COLORS.blue); band(4.5, 19, COLORS.green);
  const sL = label('Stage 1 · head only', 0.6, '#7dd3fc', 700, 'lr 1e-4'); sL.position.set(ex(2.2), CH + 0.55, 0); const s2 = label('Stage 2 · blocks 6–8 unfrozen', 0.6, '#7ee8bf', 700, 'lr 1e-5'); s2.position.set(ex(12), CH + 0.55, 0); curves.add(sL, s2);
  const lines: { mesh: THREE.Mesh; total: number }[] = [];
  const addLine = (vals: readonly number[], fy: (v: number) => number, color: number, r: number) => {
    const pts = vals.map((v, e) => new THREE.Vector3(ex(e), fy(v), 0));
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, r, 6, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })); curves.add(mesh);
    lines.push({ mesh, total: geo.index!.count });
  };
  addLine(H.train_acc, ay, COLORS.cyan, 0.045); addLine(H.val_acc, ay, COLORS.mint, 0.06); addLine(H.train_loss, ly, 0xfbbf24, 0.03); addLine(H.val_loss, ly, 0xfb923c, 0.03);
  const legend = [['train accuracy', '#22d3ee'], ['validation accuracy', '#34d399'], ['train loss', '#fbbf24'], ['validation loss', '#fb923c']].map(([t, c], i) => { const l = label(t, 0.46, c, 700); l.position.set(-W / 2 + 2.1 + i * 4.3, -0.7, 0); curves.add(l); return l; });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), new THREE.MeshBasicMaterial({ color: 0xffffff })); curves.add(marker);
  const eLabels = H.val_acc.map((v, e) => { const l = label(`epoch ${e + 1} · val acc ${v.toFixed(1)}%`, 0.55, '#ffffff', 700); l.position.set(ex(e) - (e > 12 ? 1.6 : 0), ay(v) + 0.9, 0); curves.add(l); return l; });
  const final = label(`best validation ${Math.max(...H.val_acc).toFixed(2)}%`, 0.7, '#7ee8bf', 700, 'test accuracy 98.13% on unseen photos'); final.position.set(0, CH + 1.5, 0); curves.add(final);

  const grey = new THREE.Color(COLORS.grey), green = new THREE.Color(COLORS.mint);
  return {
    range: [5, 6], group,
    update(t, time) {
      const ch5 = t < 0.5 ? t * 2 : 1, st = smooth(0.5, 0.66, t), cur = smooth(0.58, 0.97, t);
      net.position.y = lerp(0, 4.0, easeOut(st)); net.scale.setScalar(lerp(1, 0.7, st));
      const front = (time * 3.2) % (total + 6) - 3; // signal x in net space
      meshes.forEach((m, i) => {
        const appear = smooth(i * 0.05, i * 0.05 + 0.2, ch5 * 1.4);
        m.g.scale.setScalar(Math.max(0.001, appear));
        const dist = Math.abs(front - xs[i]); const glow = Math.exp(-dist * dist * 0.35);
        const frozen = i < 6 ? st : 0;
        const col = new THREE.Color().copy(green).lerp(grey, frozen);
        (m.edge.material as THREE.LineBasicMaterial).color.copy(col); (m.fill.material as THREE.MeshBasicMaterial).color.copy(col);
        const trainGlow = i >= 6 ? st * (0.5 + 0.5 * Math.sin(time * 3 + i)) : 0;
        (m.fill.material as THREE.MeshBasicMaterial).userData.baseOpacity = 0.18 + 0.4 * glow * (1 - st) + 0.45 * trainGlow - 0.1 * frozen;
        setLocal(m.label, appear);
      });
      for (let i = 0; i < PN; i++) { const f = ((i / PN) * (total + 2) + time * 3.2) % (total + 2); pp[i * 3] = f - 1; pp[i * 3 + 1] = Math.sin(i * 12.9 + time * 2) * 0.55; pp[i * 3 + 2] = Math.cos(i * 7.7 + time * 2) * 0.55; }
      pg.attributes.position.needsUpdate = true; pmat.userData.local = 1 - st * 0.6;
      outs.forEach((o, i) => { (o.material as THREE.MeshBasicMaterial).userData.local = 0.35 + 0.65 * Math.max(0, Math.sin(time * 2.2 + i * 0.5)); });
      curves.visible = cur > 0.001;
      lines.forEach(l => l.mesh.geometry.setDrawRange(0, Math.floor(l.total * cur / 3) * 3));
      const e = clamp(cur * 19, 0, 19), ei = Math.round(e);
      marker.position.set(ex(e), ay(lerp(H.val_acc[Math.floor(e)], H.val_acc[Math.min(19, Math.floor(e) + 1)], e - Math.floor(e))), 0.05); marker.visible = cur > 0.02;
      eLabels.forEach((l, k) => setLocal(l, k === ei && cur > 0.02 && cur < 0.995 ? 1 : 0));
      setLocal(final, smooth(0.96, 1, cur)); setLocal(sL, cur > 0.02 ? 1 : 0); setLocal(s2, smooth(0.25, 0.4, cur)); legend.forEach(l => setLocal(l, cur > 0.05 ? 1 : 0));
      (panel.material as THREE.MeshBasicMaterial).userData.baseOpacity = 0.55;
      void time;
    },
    camera(t) {
      const pan = smooth(0.0, 0.46, t), st = smooth(0.5, 0.7, t);
      return { p: [lerp(lerp(-3, 3, pan), 0, st), lerp(2.0, -0.3, st), lerp(19, 20.5, st)], l: [lerp(lerp(-3, 3, pan), 0, st), lerp(0, -0.4, st), 0] };
    },
    dispose() {},
  };
}
