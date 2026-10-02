import * as THREE from 'three/webgpu';

/* ============================================================
 *  VISUALES DE LAS DIAPOSITIVAS 6 → 13 (índices 5 → 12)
 *  Cada builder devuelve { group, update(time) }.
 *  Todo es CPU + InstancedMesh / LineSegments (compatible con WebGPU,
 *  donde los "points" siempre miden 1px, por eso los puntos son círculos).
 * ============================================================ */

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const mod = (v, m) => ((v % m) + m) % m;
const rand = (a, b) => a + Math.random() * (b - a);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/* ---------- utilidades compartidas ---------- */

function createKit() {
  const list = [];
  return {
    track(obj) { list.push(obj); return obj; },
    dispose() { list.forEach((o) => o.dispose && o.dispose()); }
  };
}

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

// Puntos circulares instanciados (aditivos). El brillo se controla con el color por instancia.
function createDots(kit, count, { opacity = 1 } = {}) {
  const geo = kit.track(new THREE.CircleGeometry(1, 20));
  const mat = kit.track(new THREE.MeshBasicMaterial({
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  }));
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const white = new THREE.Color(1, 1, 1);
  dummy.position.set(0, 0, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = 0; i < count; i++) {
    mesh.setColorAt(i, white);
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  kit.track(mesh);
  return mesh;
}

function setDot(mesh, i, x, y, z, size, color, brightness = 1) {
  dummy.position.set(x, y, z);
  dummy.scale.setScalar(Math.max(size, 0.0001));
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
  tmpColor.copy(color).multiplyScalar(brightness);
  mesh.setColorAt(i, tmpColor);
}

function hideDot(mesh, i) {
  dummy.position.set(0, 0, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

function commitDots(mesh) {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// LineSegments con posición y color por vértice (el color oscuro = invisible con blending aditivo)
function createSegments(kit, segmentCount, opacity = 1) {
  const pos = new Float32Array(segmentCount * 6);
  const col = new Float32Array(segmentCount * 6);
  const geo = kit.track(new THREE.BufferGeometry());
  const pa = new THREE.BufferAttribute(pos, 3);
  const ca = new THREE.BufferAttribute(col, 3);
  pa.setUsage(THREE.DynamicDrawUsage);
  ca.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pa);
  geo.setAttribute('color', ca);
  geo.setDrawRange(0, segmentCount * 2);
  const mat = kit.track(new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { lines, geo, mat, pos, col, pa, ca };
}

const c = (hex) => new THREE.Color(hex);

/* ============================================================
 *  DIAPOSITIVA 6 (índice 5)
 *  "Un evento trae personas. Una comunidad trae transformación."
 *  Puntos sueltos (personas) que se acercan, se conectan y se
 *  vuelven cálidos al formar comunidad. Ciclo de 20 s.
 * ============================================================ */
function buildCommunity(kit) {
  const group = new THREE.Group();
  const N = 72;
  const MAX_SEG = 900;

  const hubs = [[-4.8, 1.8], [4.6, 2.4], [-3.0, -2.8], [4.2, -2.6]];
  const nodes = Array.from({ length: N }, (_, i) => ({
    hx: rand(-8.5, 8.5), hy: rand(-4.6, 4.6), hz: rand(-1.2, 1.2),
    ax: rand(0.5, 1.5), ay: rand(0.4, 1.1),
    sx: rand(0.15, 0.45), sy: rand(0.15, 0.45),
    px: rand(0, TAU), py: rand(0, TAU),
    hub: i % hubs.length,
    ox: rand(-1.7, 1.7), oy: rand(-1.2, 1.2),
    size: rand(0.05, 0.1)
  }));
  const P = nodes.map(() => ({ x: 0, y: 0, z: 0 }));
  const deg = new Int16Array(N);

  const dots = createDots(kit, N);
  const net = createSegments(kit, MAX_SEG, 0.95);
  group.add(net.lines, dots);

  const cold = c('#7f93b8');
  const warm = c('#ffb04a');
  const hot = c('#ffe6b0');
  const edgeColor = new THREE.Color();
  const nodeColor = new THREE.Color();

  function update(time) {
    const t = (time % 20) / 20;
    const connect = smoothstep(0.04, 0.5, t) * (1 - smoothstep(0.86, 1, t));
    const R = connect * 2.4;
    const pull = connect * 0.6;

    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      const wx = n.hx + Math.sin(time * n.sx + n.px) * n.ax;
      const wy = n.hy + Math.cos(time * n.sy + n.py) * n.ay;
      const hub = hubs[n.hub];
      P[i].x = mix(wx, hub[0] + n.ox, pull);
      P[i].y = mix(wy, hub[1] + n.oy, pull);
      P[i].z = n.hz;
    }

    deg.fill(0);
    let seg = 0;
    edgeColor.copy(cold).lerp(warm, connect);

    if (R > 0.05) {
      outer:
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = P[i].x - P[j].x;
          const dy = P[i].y - P[j].y;
          const dz = P[i].z - P[j].z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < R * R) {
            const d = Math.sqrt(d2);
            const b = (1 - d / R) * 0.85;
            const o = seg * 6;
            net.pos[o] = P[i].x; net.pos[o + 1] = P[i].y; net.pos[o + 2] = P[i].z;
            net.pos[o + 3] = P[j].x; net.pos[o + 4] = P[j].y; net.pos[o + 5] = P[j].z;
            net.col[o] = net.col[o + 3] = edgeColor.r * b;
            net.col[o + 1] = net.col[o + 4] = edgeColor.g * b;
            net.col[o + 2] = net.col[o + 5] = edgeColor.b * b;
            deg[i]++; deg[j]++;
            seg++;
            if (seg >= MAX_SEG) break outer;
          }
        }
      }
    }

    net.lines.visible = seg > 0;
    if (seg > 0) {
      net.geo.setDrawRange(0, seg * 2);
      net.pa.needsUpdate = true;
      net.ca.needsUpdate = true;
    }

    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      const d = Math.min(deg[i], 12);
      nodeColor.copy(cold).lerp(warm, connect).lerp(hot, (d / 12) * connect);
      const size = n.size * (1 + connect * 0.5 + d * 0.04);
      const b = 0.5 + 0.5 * connect + d * 0.03;
      setDot(dots, i, P[i].x, P[i].y, P[i].z, size, nodeColor, b);
    }
    commitDots(dots);
  }

  return { group, update };
}

/* ============================================================
 *  DIAPOSITIVA 7 (índice 6)
 *  "El talento crece a la velocidad de la confianza."
 *  Barras que crecen en curva exponencial (la confianza acelera),
 *  con una línea y un punto líder que sube. Ciclo de 11 s.
 * ============================================================ */
function buildGrowth(kit) {
  const group = new THREE.Group();
  const N = 38;
  const K = 2.7;
  const H = 8.2;
  const X0 = -8.4;
  const X1 = 8.4;
  const baseY = -4.5;
  const target = (u) => 0.2 + H * (Math.exp(K * u) - 1) / (Math.exp(K) - 1);

  const barGeo = kit.track(new THREE.PlaneGeometry(1, 1));
  barGeo.translate(0, 0.5, 0); // ancla en la base
  const barMat = kit.track(new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.55, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));
  const bars = new THREE.InstancedMesh(barGeo, barMat, N);
  bars.frustumCulled = false;
  bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const init = new THREE.Color(1, 1, 1);
  for (let i = 0; i < N; i++) bars.setColorAt(i, init);
  bars.instanceColor.setUsage(THREE.DynamicDrawUsage);
  kit.track(bars);

  const caps = createDots(kit, N);
  const tip = createDots(kit, 1);

  // Línea de la curva
  const CURVE_PTS = 120;
  const curvePos = new Float32Array(CURVE_PTS * 3);
  for (let k = 0; k < CURVE_PTS; k++) {
    const u = k / (CURVE_PTS - 1);
    curvePos[k * 3] = mix(X0, X1, u);
    curvePos[k * 3 + 1] = baseY + target(u) + 0.15;
    curvePos[k * 3 + 2] = -0.3;
  }
  const curveGeo = kit.track(new THREE.BufferGeometry());
  curveGeo.setAttribute('position', new THREE.BufferAttribute(curvePos, 3));
  curveGeo.setDrawRange(0, 2);
  const curveMat = kit.track(new THREE.LineBasicMaterial({
    color: 0xfff1c9, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  const curve = new THREE.Line(curveGeo, curveMat);
  curve.frustumCulled = false;

  group.add(bars, caps, curve, tip);

  const teal = c('#2dd4bf');
  const amber = c('#ffb347');
  const gold = c('#fff1c9');
  const col = new THREE.Color();

  function update(time) {
    const cyc = (time % 11) / 11;
    const fade = 1 - smoothstep(0.88, 1, cyc);
    const frontU = Math.min(cyc / 0.7, 1) * 1.14;

    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = mix(X0, X1, u);
      const grow = smoothstep(0, 0.14, frontU - u);
      const wobble = 1 + 0.035 * Math.sin(time * 3 - u * 8) * grow;
      const h = Math.max(target(u) * grow * wobble, 0.0001);

      dummy.position.set(x, baseY, -0.5);
      dummy.scale.set(0.3, h, 1);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);

      col.copy(teal).lerp(amber, u).multiplyScalar((0.35 + 0.65 * grow) * fade);
      bars.setColorAt(i, col);

      if (grow > 0.01) {
        col.copy(teal).lerp(amber, u);
        setDot(caps, i, x, baseY + h, -0.4, 0.075, col, 1.1 * fade * grow);
      } else {
        hideDot(caps, i);
      }
    }
    bars.instanceMatrix.needsUpdate = true;
    bars.instanceColor.needsUpdate = true;
    commitDots(caps);

    // Curva y punto líder
    const fu = clamp(frontU, 0, 1);
    const count = Math.max(2, Math.floor(fu * (CURVE_PTS - 1)) + 1);
    curveGeo.setDrawRange(0, count);
    curveMat.opacity = 0.9 * fade;

    if (frontU > 0.01) {
      const tx = mix(X0, X1, fu);
      const ty = baseY + target(fu) + 0.15;
      setDot(tip, 0, tx, ty, -0.2, 0.15 + 0.04 * Math.sin(time * 6), gold, 1.3 * fade);
    } else {
      hideDot(tip, 0);
    }
    commitDots(tip);
  }

  return { group, update };
}

/* ============================================================
 *  DIAPOSITIVA 8 (índice 7)
 *  "La experiencia construye el camino.
 *   Las nuevas generaciones descubren nuevas rutas."
 *  Un camino dorado (experiencia) del que van brotando ramas
 *  cian y rosadas (nuevas rutas). Ciclo de 15 s.
 * ============================================================ */
function buildPaths(kit) {
  const group = new THREE.Group();
  const polys = [];

  const TRUNK_N = 70;
  const trunk = [];
  for (let k = 0; k <= TRUNK_N; k++) {
    const u = k / TRUNK_N;
    trunk.push([-9 + 18 * u, -3.2 + 6 * u + Math.sin(u * Math.PI * 2.2) * 1.0]);
  }
  polys.push({ pts: trunk, start: 0, dur: 0.4, kind: 0 });

  const grow = (x, y, ang, steps, step = 0.38) => {
    const pts = [[x, y]];
    const curl = rand(-0.06, 0.06);
    let cx = x;
    let cy = y;
    for (let s = 0; s < steps; s++) {
      ang += curl + rand(-0.12, 0.12);
      cx += Math.cos(ang) * step;
      cy += Math.sin(ang) * step;
      if (Math.abs(cx) > 10.5 || Math.abs(cy) > 6) break;
      pts.push([cx, cy]);
    }
    return pts;
  };

  [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].forEach((u, bi) => {
    const idx = Math.round(u * TRUNK_N);
    const [x, y] = trunk[idx];
    const a = trunk[Math.min(idx + 1, TRUNK_N)];
    const b = trunk[Math.max(idx - 1, 0)];
    const tangent = Math.atan2(a[1] - b[1], a[0] - b[0]);
    const ang0 = tangent + (bi % 2 === 0 ? 1 : -1) * rand(0.5, 1.0);
    const steps = Math.round(rand(14, 20));
    const pts = grow(x, y, ang0, steps);
    if (pts.length < 4) return;
    const start = 0.4 * u + 0.02;
    polys.push({ pts, start, dur: 0.24, kind: 1 });

    if (bi % 2 === 1 || Math.random() < 0.5) {
      const mid = Math.max(2, Math.floor(pts.length * rand(0.45, 0.65)));
      const p1 = pts[mid];
      const p0 = pts[mid - 1];
      const angMid = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      const sub = grow(p1[0], p1[1], angMid + (Math.random() < 0.5 ? 1 : -1) * rand(0.5, 0.9), Math.round(rand(9, 13)), 0.34);
      if (sub.length >= 4) {
        polys.push({
          pts: sub,
          start: start + 0.24 * (mid / (pts.length - 1)),
          dur: 0.16,
          kind: 2
        });
      }
    }
  });

  // Segmentos (el tronco se dibuja 3 veces con pequeño desplazamiento para ganar grosor)
  const TRUNK_OFFSETS = [-0.035, 0, 0.035];
  const segs = [];
  polys.forEach((p) => {
    const nSeg = p.pts.length - 1;
    const offsets = p.kind === 0 ? TRUNK_OFFSETS : [0];
    offsets.forEach((off) => {
      for (let k = 0; k < nSeg; k++) {
        segs.push({
          a: p.pts[k], b: p.pts[k + 1], off,
          t: p.start + p.dur * (k / nSeg),
          kind: p.kind,
          gain: p.kind === 0 ? 0.55 : p.kind === 1 ? 0.9 : 0.8
        });
      }
    });
  });

  const lines = createSegments(kit, segs.length, 1);
  segs.forEach((s, i) => {
    const o = i * 6;
    lines.pos[o] = s.a[0]; lines.pos[o + 1] = s.a[1] + s.off; lines.pos[o + 2] = 0;
    lines.pos[o + 3] = s.b[0]; lines.pos[o + 4] = s.b[1] + s.off; lines.pos[o + 5] = 0;
  });
  lines.pa.needsUpdate = true;

  const heads = createDots(kit, polys.length);
  group.add(lines.lines, heads);

  const kindColors = [c('#ffc14d'), c('#4fd1ff'), c('#ff7ab8')];

  function update(time) {
    const cyc = (time % 15) / 15;
    const fade = 1 - smoothstep(0.88, 1, cyc);

    for (let s = 0; s < segs.length; s++) {
      const sg = segs[s];
      const age = cyc - sg.t;
      let b = 0;
      if (age > 0) b = (0.45 + 0.55 * Math.exp(-age * 14)) * Math.min(1, age * 40) * fade;
      const k = b * sg.gain;
      const col = kindColors[sg.kind];
      const o = s * 6;
      lines.col[o] = lines.col[o + 3] = col.r * k;
      lines.col[o + 1] = lines.col[o + 4] = col.g * k;
      lines.col[o + 2] = lines.col[o + 5] = col.b * k;
    }
    lines.ca.needsUpdate = true;

    polys.forEach((p, i) => {
      if (cyc <= p.start) { hideDot(heads, i); return; }
      const q = clamp((cyc - p.start) / p.dur, 0, 1);
      const f = q * (p.pts.length - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, p.pts.length - 1);
      const fr = f - i0;
      const x = mix(p.pts[i0][0], p.pts[i1][0], fr);
      const y = mix(p.pts[i0][1], p.pts[i1][1], fr);
      const size = q < 1 ? 0.13 : 0.075;
      const br = (q < 1 ? 1.1 : 0.7) * fade;
      setDot(heads, i, x, y, 0.1, size, kindColors[p.kind], br);
    });
    commitDots(heads);
  }

  return { group, update };
}

/* ============================================================
 *  DIAPOSITIVA 9 (índice 8)
 *  "Una visión. Dos generaciones."
 *  Dos familias de anillos orbitales (ámbar y cian) que se
 *  acercan hasta superponerse y encender un punto de luz común.
 * ============================================================ */
function buildTwoGenerations(kit) {
  const group = new THREE.Group();
  const radii = [2.2, 3.0, 3.8];
  const speeds = [0.5, 0.35, 0.25];
  const DOTS_PER_RING = 28;

  const makeGen = (hex, dir) => {
    const color = c(hex);
    const g = new THREE.Group();
    radii.forEach((r) => {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * TAU;
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
      }
      const geo = kit.track(new THREE.BufferGeometry().setFromPoints(pts));
      const mat = kit.track(new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.42,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      const ring = new THREE.Line(geo, mat);
      ring.frustumCulled = false;
      g.add(ring);
    });
    const dots = createDots(kit, DOTS_PER_RING * radii.length);
    g.add(dots);
    group.add(g);
    return { g, dots, color, dir };
  };

  const genA = makeGen('#ffb347', 1);
  const genB = makeGen('#4fd1ff', -1);

  // Luz central compartida (la visión)
  const glowSizes = [1.0, 0.6, 0.34, 0.16, 0.07];
  const glowBase = [0.035, 0.07, 0.14, 0.3, 0.9];
  const glow = createDots(kit, glowSizes.length);
  group.add(glow);
  const glowColor = c('#fff0cf');

  function update(time) {
    const sep = mix(0.35, 3.3, 0.5 + 0.5 * Math.cos(time * 0.38));
    genA.g.position.x = -sep;
    genB.g.position.x = sep;

    [genA, genB].forEach((gen) => {
      let n = 0;
      radii.forEach((r, ri) => {
        for (let j = 0; j < DOTS_PER_RING; j++) {
          const a = (j / DOTS_PER_RING) * TAU + time * speeds[ri] * gen.dir + ri;
          setDot(gen.dots, n++, Math.cos(a) * r, Math.sin(a) * r, 0, 0.065, gen.color, 0.9);
        }
      });
      commitDots(gen.dots);
    });

    const overlap = 1 - smoothstep(0.35, 3.3, sep);
    const pulse = 1 + 0.08 * Math.sin(time * 2.4);
    glowSizes.forEach((s, i) => {
      setDot(glow, i, 0, 0, 0.2, s * pulse * (0.7 + 0.5 * overlap), glowColor, glowBase[i] * (0.4 + 1.6 * overlap));
    });
    commitDots(glow);
  }

  return { group, update };
}

/* ============================================================
 *  DIAPOSITIVA 10 (índice 9)
 *  "El crecimiento no ocurre cuando una generación reemplaza a otra.
 *   Ocurre cuando trabajan juntas."
 *  Doble hélice: dos hebras (ámbar y cian) entrelazadas, unidas
 *  por peldaños. Una no sustituye a la otra: giran juntas.
 * ============================================================ */
function buildHelix(kit) {
  const group = new THREE.Group();
  group.rotation.set(0.3, 0, -0.08);

  const N = 84;
  const EVERY = 3;
  const rungCount = Math.ceil(N / EVERY);
  const colA = c('#ffb347');
  const colB = c('#4fd1ff');

  const dotsA = createDots(kit, N);
  const dotsB = createDots(kit, N);
  const rungs = createSegments(kit, rungCount, 0.85);
  group.add(rungs.lines, dotsA, dotsB);

  function update(time) {
    const r = 1.7 + 0.25 * Math.sin(time * 0.7);
    let rr = 0;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = mix(-9.2, 9.2, u);
      const ang = u * TAU * 2.4 + time * 0.9;
      const ya = r * Math.sin(ang);
      const za = r * Math.cos(ang);
      const da = (za / r) * 0.5 + 0.5;
      const db = 1 - da;

      setDot(dotsA, i, x, ya, za, 0.06 + 0.05 * da, colA, 0.3 + 0.7 * da);
      setDot(dotsB, i, x, -ya, -za, 0.06 + 0.05 * db, colB, 0.3 + 0.7 * db);

      if (i % EVERY === 0) {
        const b = 0.15 + 0.35 * Math.abs(Math.sin(ang));
        const o = rr * 6;
        rungs.pos[o] = x; rungs.pos[o + 1] = ya; rungs.pos[o + 2] = za;
        rungs.pos[o + 3] = x; rungs.pos[o + 4] = -ya; rungs.pos[o + 5] = -za;
        rungs.col[o] = colA.r * b; rungs.col[o + 1] = colA.g * b; rungs.col[o + 2] = colA.b * b;
        rungs.col[o + 3] = colB.r * b; rungs.col[o + 4] = colB.g * b; rungs.col[o + 5] = colB.b * b;
        rr++;
      }
    }
    rungs.pa.needsUpdate = true;
    rungs.ca.needsUpdate = true;
    commitDots(dotsA);
    commitDots(dotsB);
  }

  return { group, update };
}

/* ============================================================
 *  DIAPOSITIVA 11 (índice 10)
 *  "Los jóvenes no son el futuro.
 *   Son el presente que muchas organizaciones aún no ven."
 *  Una matriz de puntos apagada (lo que no se ve) que se
 *  enciende al paso de un anillo de luz. Ciclo de 14 s.
 * ============================================================ */
function buildPresentGrid(kit) {
  const group = new THREE.Group();
  const cols = 46;
  const rows = 26;
  const sp = 0.4;
  const dots = createDots(kit, cols * rows);
  group.add(dots);

  const dim = c('#5d6f94');
  const lit = c('#ffc766');
  const flash = c('#fff4dc');
  const col = new THREE.Color();

  function update(time) {
    const cyc = (time % 14) / 14;
    const fade = 1 - smoothstep(0.86, 1, cyc);
    const r = clamp(cyc / 0.6, 0, 1) * 12.5;
    const ringActive = 1 - smoothstep(0.58, 0.64, cyc);

    let n = 0;
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        const x = (cx - (cols - 1) / 2) * sp;
        const y = (ry - (rows - 1) / 2) * sp;
        const d = Math.hypot(x, y);

        const l = smoothstep(r + 0.4, r - 0.4, d) * fade;
        const e = Math.exp(-Math.pow((d - r) / 0.45, 2)) * ringActive;
        const pulse = 0.5 + 0.5 * Math.sin(d * 1.4 - time * 2.0);

        const size = 0.05 + 0.045 * l * (0.6 + 0.4 * pulse) + 0.1 * e;
        const b = 0.22 + 0.55 * l * (0.7 + 0.3 * pulse) + 1.0 * e;

        col.copy(dim).lerp(lit, l).lerp(flash, clamp(e, 0, 1));
        setDot(dots, n++, x, y, e * 0.5, size, col, b);
      }
    }
    commitDots(dots);
  }

  return { group, update };
}

/* ============================================================
 *  DIAPOSITIVA 12 (índice 11)
 *  "El futuro no se hereda. Se construye."
 *  Cubos de alambre que caen y se ensamblan capa a capa en una
 *  pirámide escalonada (de ámbar a cian). Ciclo de 14 s.
 * ============================================================ */
function buildConstruction(kit) {
  const group = new THREE.Group();
  group.rotation.x = 0.5;
  group.scale.setScalar(1.1);
  const inner = new THREE.Group();
  inner.position.y = -2.4;
  group.add(inner);

  const s = 0.95;
  const LAYERS = 5;
  const boxGeo = kit.track(new THREE.BoxGeometry(s * 0.94, s * 0.94, s * 0.94));
  const edgeGeo = kit.track(new THREE.EdgesGeometry(boxGeo));

  const fillMats = [];
  const edgeMats = [];
  const base = c('#ffb347');
  const top = c('#4fd1ff');
  for (let L = 0; L < LAYERS; L++) {
    const color = base.clone().lerp(top, L / (LAYERS - 1));
    fillMats.push(kit.track(new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending
    })));
    edgeMats.push(kit.track(new THREE.LineBasicMaterial({
      color: color.clone().lerp(new THREE.Color(1, 1, 1), 0.35),
      transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending
    })));
  }

  const cubes = [];
  for (let L = 0; L < LAYERS; L++) {
    const n = LAYERS - L;
    for (let ix = 0; ix < n; ix++) {
      for (let iz = 0; iz < n; iz++) {
        const holder = new THREE.Group();
        holder.add(new THREE.Mesh(boxGeo, fillMats[L]));
        holder.add(new THREE.LineSegments(edgeGeo, edgeMats[L]));
        inner.add(holder);
        cubes.push({
          holder,
          cx: (ix - (n - 1) / 2) * s,
          cy: L * s,
          cz: (iz - (n - 1) / 2) * s,
          order: L * 0.11 + Math.hypot(ix - (n - 1) / 2, iz - (n - 1) / 2) * 0.018 + Math.random() * 0.02
        });
      }
    }
  }
  const maxOrder = Math.max(...cubes.map((q) => q.order));

  function update(time) {
    const cyc = (time % 14) / 14;
    const fade = 1 - smoothstep(0.88, 1, cyc);
    fillMats.forEach((m) => { m.opacity = 0.16 * fade; });
    edgeMats.forEach((m) => { m.opacity = 0.95 * fade; });

    for (const q of cubes) {
      const t0 = (q.order / maxOrder) * 0.5;
      const local = clamp((cyc - t0) / 0.12, 0, 1);
      q.holder.visible = local > 0;
      q.holder.scale.setScalar(Math.max(easeOutBack(local), 0.0001));
      q.holder.position.set(q.cx, q.cy + (1 - local) * (1 - local) * 3, q.cz);
    }
    inner.rotation.y = time * 0.22;
  }

  return { group, update };
}

/* ============================================================
 *  DIAPOSITIVA 13 (índice 12) – QR / cierre
 *  Luces suaves que ascienden lentamente (brasas), discretas
 *  para no competir con los códigos QR.
 * ============================================================ */
function buildEmbers(kit) {
  const group = new THREE.Group();
  const N = 260;
  const palette = [c('#ffb347'), c('#4fd1ff'), c('#ffffff'), c('#ff7ab8')];
  const items = Array.from({ length: N }, () => ({
    x0: rand(-10, 10), y0: rand(0, 12),
    speed: rand(0.12, 0.45),
    sway: rand(0.15, 0.7), sf: rand(0.3, 0.9),
    phase: rand(0, TAU), tw: rand(1.2, 3.2),
    z: rand(-2, 1.5),
    size: rand(0.02, 0.07),
    color: palette[Math.floor(Math.random() * palette.length)]
  }));
  const dots = createDots(kit, N);
  group.add(dots);

  function update(time) {
    for (let i = 0; i < N; i++) {
      const p = items[i];
      const y = mod(p.y0 + time * p.speed, 12) - 6;
      const x = p.x0 + Math.sin(time * p.sf + p.phase) * p.sway;
      const edge = smoothstep(-6, -4.5, y) * smoothstep(6, 4.2, y);
      const twinkle = 0.65 + 0.35 * Math.sin(time * p.tw + p.phase);
      setDot(dots, i, x, y, p.z, p.size, p.color, 0.7 * twinkle * edge);
    }
    commitDots(dots);
  }

  return { group, update };
}

/* ============================================================
 *  GESTOR: indica qué visual está activo según la diapositiva
 * ============================================================ */
export function createExtraVisuals(scene) {
  const kit = createKit();

  const builders = {
    5: buildCommunity,
    6: buildGrowth,
    7: buildPaths,
    8: buildTwoGenerations,
    9: buildHelix,
    10: buildPresentGrid,
    11: buildConstruction,
    12: buildEmbers
  };

  const entries = Object.entries(builders).map(([index, build]) => {
    const visual = build(kit);
    visual.group.visible = false;
    scene.add(visual.group);
    return { index: Number(index), ...visual };
  });

  return {
    setActive(slideIndex) {
      entries.forEach((e) => { e.group.visible = (e.index === slideIndex); });
    },
    update(time) {
      entries.forEach((e) => { if (e.group.visible) e.update(time); });
    },
    dispose() {
      entries.forEach((e) => scene.remove(e.group));
      kit.dispose();
    }
  };
}