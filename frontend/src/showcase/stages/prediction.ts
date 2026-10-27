import * as THREE from 'three';
import { SHOWCASE as S } from '../../generated/showcase';
import { COLORS, easeOut, imagePlane, label, lerp, sampleData, sampleTex, setLocal, setU, smooth, type SampleKey, type Stage } from '../core';
import type { StageCtx } from '../scene';

const SHORT = (c: string) => c.replace('Tomato__Tomato_', 'Tomato ').replace('Tomato_Spider_mites_Two_spotted_spider_mite', 'Tomato spider mites').replace(/___?/g, ' ').replace(/_/g, ' ').replace('bell ', '').replace('Pepper ', 'Pepper ').replace('Yellow Leaf Curl Virus', 'YLCV').replace('YellowLeaf Curl Virus', 'YLCV');

/** 15 class bars on a ring around the photo; chapter 7 shows a confident prediction, chapter 8 a hard photo with MC-Dropout wobble. */
export function createPrediction(ctx: StageCtx): Stage {
  const group = new THREE.Group();
  let key: SampleKey = ctx.sample;
  const photo = imagePlane(sampleTex(key, 'photo.jpg'), 3.0, 3.0); photo.position.set(-6.2, 1.4, 0); group.add(photo);
  const capA = label('Test photo', 0.4, '#e8f5ee', 700, 'never seen in training'); capA.position.set(-6.2, -0.7, 0); group.add(capA);
  const capB = label('A hard photo', 0.4, '#fcd34d', 700, 'the model is unsure'); capB.position.set(-6.2, -0.7, 0); group.add(capB);
  const hardPhoto = imagePlane(sampleTex('hard', 'photo.jpg'), 3.0, 3.0); hardPhoto.position.set(-6.2, 1.4, 0.02); group.add(hardPhoto);

  const ring = new THREE.Group(); ring.position.set(2.8, -1.4, 0); group.add(ring);
  const R = 4.1, BAR = 0.42, MAXH = 4.2;
  const bars = S.classes.map((c, i) => {
    const ang = (i / 15) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(BAR, 1, BAR), new THREE.MeshBasicMaterial({ color: COLORS.green, transparent: true, opacity: 0.85 }));
    b.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R); b.userData.ang = ang; ring.add(b);
    const raw = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BAR * 1.35, 1, BAR * 1.35)), new THREE.LineBasicMaterial({ color: COLORS.amber, transparent: true, opacity: 0.8 }));
    raw.position.copy(b.position); ring.add(raw);
    const l = label(SHORT(c), 0.3, '#bfe9d6', 600); l.position.set(Math.cos(ang) * (R + 1.15), 0.25, Math.sin(ang) * (R + 1.15)); ring.add(l);
    return { b, raw, l };
  });
  const base = new THREE.Mesh(new THREE.RingGeometry(R - 0.5, R + 0.5, 64), new THREE.MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.09, side: THREE.DoubleSide })); base.rotation.x = -Math.PI / 2; base.position.y = -0.02; ring.add(base);
  const topLbl: Record<string, THREE.Sprite> = {};
  (['tomato', 'potato', 'pepper', 'hard'] as const).forEach(k => {
    const d = sampleData(k); const l = label(`${SHORT(d.className)}`, 0.55, k === 'hard' ? '#fcd34d' : '#7ee8bf', 800, `${(d.confidence * 100).toFixed(1)}% confident`); l.position.set(2.8, 5.2, 0); group.add(l); topLbl[k] = l;
  });
  const tempLbl = label(`T = ${S.metrics.temperature.toFixed(3)}`, 0.45, '#fcd34d', 700, 'amber outline = before scaling'); tempLbl.position.set(8.4, 4.0, 0); group.add(tempLbl);
  const mcLbl = label('20 MC-Dropout passes', 0.45, '#7dd3fc', 700, ''); mcLbl.position.set(8.4, 3.0, 0); group.add(mcLbl);
  // MC ghosts: one thin pole per pass at the top class
  const ghosts = Array.from({ length: 20 }, () => new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.7 }))); ghosts.forEach(g => ring.add(g));
  // beams photo -> bars
  const beams = bars.map(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.25 })); });
  beams.forEach(b => group.add(b));

  const setPhoto = (k: SampleKey) => { key = k; (photo.material as THREE.ShaderMaterial).uniforms.uMap.value = sampleTex(k, 'photo.jpg'); };
  let heights = new Float32Array(15), rawH = new Float32Array(15);
  return {
    range: [7, 8], group,
    update(t, time) {
      const ch8 = smooth(0.5, 0.66, t);
      const a = sampleData(key), h = sampleData('hard');
      const cal = a.probsCalibrated.map((v, i) => lerp(v, h.probsCalibrated[i], ch8));
      const raw = a.probsRaw.map((v, i) => lerp(v, h.probsRaw[i], ch8));
      const grow = easeOut(smooth(0.02, 0.32, t));
      ring.rotation.y = time * 0.07 + t * 0.9;
      const topIdx = ch8 > 0.5 ? h.classIndex : a.classIndex;
      bars.forEach((o, i) => {
        const tg = cal[i] * MAXH * grow + 0.04, rg = raw[i] * MAXH * grow + 0.04;
        heights[i] += (tg - heights[i]) * 0.12; rawH[i] += (rg - rawH[i]) * 0.12;
        o.b.scale.y = Math.max(0.04, heights[i]); o.b.position.y = heights[i] / 2;
        o.raw.scale.y = Math.max(0.04, rawH[i]); o.raw.position.y = rawH[i] / 2;
        const isTop = i === topIdx;
        (o.b.material as THREE.MeshBasicMaterial).color.set(isTop ? (ch8 > 0.5 ? COLORS.amber : COLORS.mint) : COLORS.green);
        (o.b.material as THREE.MeshBasicMaterial).userData.baseOpacity = isTop ? 1 : 0.55;
        (o.raw.material as THREE.LineBasicMaterial).userData.local = smooth(0.62, 0.8, t) * 0.9;
        setLocal(o.l, isTop ? 1 : 0.55);
      });
      // photo swap + fades
      setU(photo, 'uReveal', smooth(0.0, 0.2, t) * (1 - ch8)); setU(hardPhoto, 'uReveal', ch8);
      setLocal(capA, 1 - ch8); setLocal(capB, ch8);
      (['tomato', 'potato', 'pepper'] as const).forEach(k => setLocal(topLbl[k], k === key ? (1 - ch8) * smooth(0.12, 0.3, t) : 0));
      setLocal(topLbl.hard, ch8);
      setLocal(tempLbl, smooth(0.6, 0.76, t)); setLocal(mcLbl, smooth(0.66, 0.82, t));
      // beams
      const photoP = new THREE.Vector3(-4.7, 1.4, 0);
      beams.forEach((b, i) => {
        const w = new THREE.Vector3(); bars[i].b.getWorldPosition(w); group.worldToLocal(w); w.y = heights[i];
        { const arr = b.geometry.attributes.position.array as Float32Array; arr.set([photoP.x, photoP.y, photoP.z, w.x, w.y, w.z]); b.geometry.attributes.position.needsUpdate = true; } (b.material as THREE.LineBasicMaterial).userData.local = (cal[i] * 1.6 + 0.04) * grow;
      });
      // MC ghosts
      const idx = h.classIndex, ang = bars[idx].b.userData.ang as number;
      const pass = Math.floor(time * 5) % 20;
      ghosts.forEach((g, k) => {
        const hh = h.mcTop[k] * MAXH; g.scale.y = Math.max(0.03, hh); g.position.set(Math.cos(ang) * R + (k - 9.5) * 0.07, hh / 2, Math.sin(ang) * R + 0.35);
        (g.material as THREE.MeshBasicMaterial).userData.local = ch8 * smooth(0.7, 0.85, t) * (k === pass ? 1 : 0.35);
        (g.material as THREE.MeshBasicMaterial).color.set(k === pass ? 0xffffff : COLORS.cyan);
      });
    },
    camera(t) { return { p: [lerp(0.2, 1.5, t), lerp(7.2, 7.8, t), 16.5], l: [lerp(-1.2, 0.2, t), 0.3, 0] }; },
    setSample(k) { setPhoto(k); },
    dispose() {},
  };
}
