import * as THREE from 'three';
import { SHOWCASE as S } from '../../generated/showcase';
import { clamp, easeOut, hash, label, setLocal, smooth, tex, type Stage } from '../core';
import type { StageCtx } from '../scene';

const CARDS = 600, DUPS = Math.round(CARDS * 0.5003), UNIQUE = CARDS - DUPS;
const TRAIN = Math.round(UNIQUE * 0.7), VAL = Math.round(UNIQUE * 0.15);

/** Raw data cloud -> duplicates exposed and dissolved -> unique photos fly into train / val / test bins. */
export function createData(ctx: StageCtx): Stage {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.62, 0.62);
  const cell = new Float32Array(CARDS * 2), tint = new Float32Array(CARDS), alpha = new Float32Array(CARDS).fill(1);
  const dup = new Uint8Array(CARDS);
  const order = Array.from({ length: CARDS }, (_, i) => i).sort((a, b) => hash(a * 3.1) - hash(b * 3.1));
  order.slice(0, DUPS).forEach(i => (dup[i] = 1));
  for (let i = 0; i < CARDS; i++) { const c = Math.floor(hash(i * 1.7 + 5) * 100); cell.set([c % 10, Math.floor(c / 10)], i * 2); }
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  const tintAttr = new THREE.InstancedBufferAttribute(tint, 1); geo.setAttribute('aTint', tintAttr);
  const alphaAttr = new THREE.InstancedBufferAttribute(alpha, 1); geo.setAttribute('aAlpha', alphaAttr);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uAtlas: { value: tex('/showcase/atlas.jpg') }, uFade: { value: 1 } },
    vertexShader: `attribute vec2 aCell; attribute float aTint, aAlpha; varying vec2 vUv; varying float vT, vA; varying vec2 vLocal;
      void main(){ vLocal = uv; vUv = vec2((aCell.x + uv.x) / 10.0, 1.0 - (aCell.y + 1.0 - uv.y) / 10.0); vT = aTint; vA = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uAtlas; uniform float uFade; varying vec2 vUv, vLocal; varying float vT, vA;
      void main(){
        vec3 c = texture2D(uAtlas, vUv).rgb * 0.78;
        vec3 red = vec3(0.85, 0.12, 0.1);
        c = mix(c, c * 0.25 + red * 0.7, vT);
        vec2 e = min(vLocal, 1.0 - vLocal); float edge = 1.0 - smoothstep(0.0, 0.05, min(e.x, e.y));
        vec3 rim = mix(vec3(0.15, 0.75, 0.5), red, vT);
        c = mix(c, rim * 0.95, edge);
        gl_FragColor = vec4(c, vA * uFade);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, CARDS);
  mesh.frustumCulled = false; group.add(mesh);

  const base = Array.from({ length: CARDS }, (_, i) => {
    const y = 1 - (i + 0.5) * 2 / CARDS, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(5.6);
  });
  // bin slots for the unique cards
  const slot: THREE.Vector3[] = []; const bins: [number, number, number, number][] = [[TRAIN, -8.2, 14, 3], [VAL, 3.6, 7, 2], [UNIQUE - TRAIN - VAL, 8.4, 7, 2]];
  const bx = [-5.0, 1.5, 5.1];
  bins.forEach(([n, , cols, layers], bi) => {
    const rows = Math.ceil(n / (cols * layers));
    for (let k = 0; k < n; k++) {
      const c = k % cols, l = Math.floor(k / cols) % layers, r = Math.floor(k / (cols * layers));
      slot.push(new THREE.Vector3(bx[bi] + (c - (cols - 1) / 2) * 0.46 * (bi === 0 ? 1 : 0.9), -1.6 + (r - rows / 2) * 0.46, (l - (layers - 1) / 2) * 0.55 - 1.5));
    }
  });
  const uniqueIdx = Array.from({ length: CARDS }, (_, i) => i).filter(i => !dup[i]);
  const slotOf = new Map<number, THREE.Vector3>(); uniqueIdx.forEach((ci, k) => slotOf.set(ci, slot[k]));

  const dummy = new THREE.Object3D();
  const l1 = label(`${S.counts.files.toLocaleString('en-US')} files`, 0.9, '#e8f5ee', 700, '1 card ≈ 69 photos');
  const l2 = label('50.03% are byte-identical copies', 0.8, '#ff9b8f', 700, 'found with MD5 fingerprints');
  const l3 = label(`${S.counts.unique.toLocaleString('en-US')} unique images`, 0.8, '#7ee8bf', 700);
  const lb = [label(`Train ${S.counts.train.toLocaleString('en-US')}`, 0.62, '#7ee8bf', 700, '70%'), label(`Val ${S.counts.val.toLocaleString('en-US')}`, 0.62, '#7dd3fc', 700, '15%'), label(`Test ${S.counts.test.toLocaleString('en-US')}`, 0.62, '#fcd34d', 700, '15%')];
  l1.position.set(0, 7.2, 0); l2.position.set(0, 7.2, 0); l3.position.set(0, 7.2, 0);
  lb.forEach((l, i) => l.position.set(bx[i], 1.5 + (i === 0 ? 1.3 : 0), -1.5));
  group.add(l1, l2, l3, ...lb);
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion();

  return {
    range: [1, 3], group,
    update(t, time) {
      const a = t * 3; // 0..1 raw, 1..2 leak, 2..3 split
      const rot = time * 0.12;
      q.copy(ctx.camera.quaternion);
      for (let i = 0; i < CARDS; i++) {
        const born = smooth(-0.25, 0.3, a - hash(i) * 0.25);
        tmp.copy(base[i]).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rot + a * 0.5);
        let sc = born;
        let al = 1, tn = 0;
        if (dup[i]) {
          tn = smooth(1.0 + hash(i) * 0.15, 1.35, a);
          const gone = smooth(1.55 + hash(i + 9) * 0.35, 1.95, a);
          sc *= 1 - gone * 0.6; al = 1 - gone; tmp.multiplyScalar(1 + gone * 0.35);
          if (a > 1.0 && a < 1.9) sc *= 1 + 0.12 * Math.sin(time * 6 + i);
        } else {
          const s = slotOf.get(i)!;
          const go = easeOut(clamp((a - 1.95 - hash(i + 3) * 0.3) / 0.4));
          const sph = tmp.clone().multiplyScalar(1 - 0.35 * smooth(1.8, 2.3, a));
          tmp.copy(sph).lerp(s, go);
          sc *= 1 - 0.3 * go;
          tn = 0;
        }
        dummy.position.copy(tmp);
        dummy.quaternion.copy(q); dummy.rotateZ(hash(i * 2) * 0.5 - 0.25);
        dummy.scale.setScalar(Math.max(0.0001, sc)); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix); tint[i] = tn; alpha[i] = al * (a < 0.05 ? 0 : 1);
      }
      mesh.instanceMatrix.needsUpdate = true; tintAttr.needsUpdate = true; alphaAttr.needsUpdate = true;
      setLocal(l1, smooth(0.1, 0.35, a) * (1 - smooth(0.85, 1.05, a)));
      setLocal(l2, smooth(1.1, 1.35, a) * (1 - smooth(1.8, 2.0, a)));
      setLocal(l3, smooth(1.9, 2.05, a) * (1 - smooth(2.2, 2.4, a)));
      lb.forEach((l, i) => setLocal(l, smooth(2.3 + i * 0.05, 2.55, a)));
    },
    camera(t) {
      const a = t * 3, u = smooth(1.9, 2.8, a);
      return { p: [Math.sin(a * 0.6) * 1.5 * (1 - u) + u * -0.6, 0.8 + 1.2 * (1 - u) + u * 1.2, 13.5 + 4.5 * u], l: [u * -0.6, 0.4 - u * 0.2, 0] };
    },
    dispose() { /* disposed with group */ },
  };
}
