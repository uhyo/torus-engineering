// Generates the figures for the Topological Engineering page, in the same
// wireframe style as the torus figure (black hairlines, grey dashed hidden
// lines). Every surface is given as a signed distance function; the wireframe
// is the family of its plane sections (marching squares), and hidden lines are
// found by ray-marching from each point toward the viewer.
// Outputs:
//   src/figures/topo-surfaces-ja.svg / -en.svg  Fig. 1: sphere, torus, double
//     torus (g = 0, 1, 2). The torus panel deforms into a coffee cup and back
//     (flip-book animation, off under prefers-reduced-motion).
//   src/figures/topo-surfaces-bare.svg          same, static, for the OGP image
//   src/figures/topo-hairy-ja.svg / -en.svg     Fig. 2: a vector field on the
//     sphere and its cowlick
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- vectors -----------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / len(a));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const deg = (d) => (d * Math.PI) / 180;
const fmt = (n) => (Math.round(n * 10) / 10).toString();

// ---- signed distance functions ----------------------------------------
// torus with its ring in the xy-plane (axis z), centred at c
function sdTorus(p, c, R, r) {
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  const z = p[2] - c[2];
  return Math.hypot(Math.hypot(x, y) - R, z) - r;
}
function sdSphere(p, r) {
  return len(p) - r;
}
// rounded cylinder with axis along y, centred at c
function sdCylY(p, c, radius, halfH, round) {
  const dx = Math.hypot(p[0] - c[0], p[2] - c[2]) - (radius - round);
  const dy = Math.abs(p[1] - c[1]) - (halfH - round);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - round;
}
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}
function smax(a, b, k) {
  return -smin(-a, -b, k);
}
function gradient(f, p) {
  const e = 1e-4;
  return unit([
    f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]),
    f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]),
    f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e]),
  ]);
}

// ---- camera ------------------------------------------------------------
// Same orthographic view as the torus figure: the object's xy-plane is seen
// from elevation E. `pose` rotates the object about the x-axis first.
function camera(E, pose = 0) {
  const sE = Math.sin(E);
  const cE = Math.cos(E);
  const sP = Math.sin(pose);
  const cP = Math.cos(pose);
  const rot = ([x, y, z]) => [x, y * cP - z * sP, y * sP + z * cP];
  const toViewer = [0, -cE, sE]; // in world coordinates
  // toward-viewer direction expressed in object coordinates (inverse pose)
  const [vx, vy, vz] = toViewer;
  const viewObj = [vx, vy * cP + vz * sP, -vy * sP + vz * cP];
  return {
    // screen coordinates, y growing downward
    project(p) {
      const [x, y, z] = rot(p);
      return [x, -(y * sE + z * cE)];
    },
    viewObj,
  };
}

// point p on the surface f = 0 is visible if a ray toward the viewer never
// re-enters the solid
function visible(f, p, view) {
  const n = gradient(f, p);
  if (dot(n, view) < -0.02) return false;
  let q = add(p, mul(n, 0.012));
  let t = 0;
  for (let i = 0; i < 400 && t < 8; i++) {
    const d = f(add(q, mul(view, t)));
    if (d < 0) return false;
    t += Math.max(d, 0.006);
  }
  return true;
}

// ---- plane sections (marching squares) ---------------------------------
// slice: { o, a, b, s: [s0, s1], t: [t0, t1], keep?(p) }
function section(f, slice, h = 0.012) {
  const { o, a, b } = slice;
  const [s0, s1] = slice.s;
  const [t0, t1] = slice.t;
  const ni = Math.ceil((s1 - s0) / h);
  const nj = Math.ceil((t1 - t0) / h);
  const at = (i, j) => add(o, add(mul(a, s0 + i * h), mul(b, t0 + j * h)));
  const val = new Float64Array((ni + 1) * (nj + 1));
  for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) val[i * (nj + 1) + j] = f(at(i, j));
  const V = (i, j) => val[i * (nj + 1) + j];
  // crossing point on an edge, keyed so neighbouring cells share it
  const pts = new Map();
  function edgePoint(key, i0, j0, i1, j1) {
    if (!pts.has(key)) {
      const v0 = V(i0, j0);
      const v1 = V(i1, j1);
      const t = v0 / (v0 - v1);
      pts.set(key, lerp3(at(i0, j0), at(i1, j1), t));
    }
    return key;
  }
  const adj = new Map();
  const link = (k1, k2) => {
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1).push(k2);
    adj.get(k2).push(k1);
  };
  for (let i = 0; i < ni; i++) {
    for (let j = 0; j < nj; j++) {
      const c00 = V(i, j) < 0;
      const c10 = V(i + 1, j) < 0;
      const c11 = V(i + 1, j + 1) < 0;
      const c01 = V(i, j + 1) < 0;
      const e = [];
      if (c00 !== c10) e.push(edgePoint(`h${i},${j}`, i, j, i + 1, j));
      if (c10 !== c11) e.push(edgePoint(`v${i + 1},${j}`, i + 1, j, i + 1, j + 1));
      if (c01 !== c11) e.push(edgePoint(`h${i},${j + 1}`, i, j + 1, i + 1, j + 1));
      if (c00 !== c01) e.push(edgePoint(`v${i},${j}`, i, j, i, j + 1));
      if (e.length === 2) link(e[0], e[1]);
      else if (e.length === 4) {
        const centre = (V(i, j) + V(i + 1, j) + V(i + 1, j + 1) + V(i, j + 1)) / 4 < 0;
        if (centre === c00) {
          link(e[0], e[1]);
          link(e[2], e[3]);
        } else {
          link(e[0], e[3]);
          link(e[1], e[2]);
        }
      }
    }
  }
  // chain the segments into polylines
  const used = new Set();
  const segKey = (x, y) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const lines = [];
  const starts = [...adj.keys()].sort((x, y) => adj.get(x).length - adj.get(y).length);
  for (const start of starts) {
    for (const first of adj.get(start)) {
      if (used.has(segKey(start, first))) continue;
      const chain = [start];
      let prev = start;
      let cur = first;
      used.add(segKey(prev, cur));
      while (true) {
        chain.push(cur);
        const next = adj.get(cur).find((n) => !used.has(segKey(cur, n)));
        if (next === undefined) break;
        used.add(segKey(cur, next));
        prev = cur;
        cur = next;
      }
      lines.push(chain.map((k) => pts.get(k)));
    }
  }
  // drop the parts outside the slice's region of interest
  if (!slice.keep) return lines;
  const out = [];
  for (const line of lines) {
    let run = [];
    for (const p of line) {
      if (slice.keep(p)) run.push(p);
      else {
        if (run.length > 1) out.push(run);
        run = [];
      }
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

// ---- rendering ---------------------------------------------------------
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy);
  let worst = -1;
  let wi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = L < 1e-9 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / L;
    if (d > worst) {
      worst = d;
      wi = i;
    }
  }
  if (worst <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, wi + 1), tol).slice(0, -1), ...simplify(pts.slice(wi), tol)];
}
function toPath(pts) {
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${fmt(pts[i][0])} ${fmt(pts[i][1])}`;
  return d;
}

// Renders the sections of f into { solid, hidden } path-data strings.
// place(x, y) maps camera coordinates to SVG coordinates.
function renderSurface(f, slices, cam, place) {
  const solid = [];
  const hidden = [];
  for (const slice of slices) {
    for (const line of section(f, slice)) {
      const vis = line.map((p) => visible(f, p, cam.viewObj));
      // smooth out single-point flickers along silhouettes
      for (let i = 1; i < vis.length - 1; i++) if (vis[i - 1] === vis[i + 1]) vis[i] = vis[i - 1];
      const scr = line.map((p) => place(...cam.project(p)));
      let run = [scr[0]];
      let kind = vis[0];
      const flush = () => {
        if (run.length > 1) (kind ? solid : hidden).push(toPath(simplify(run, 0.25)));
      };
      for (let i = 1; i < scr.length; i++) {
        if (vis[i] !== kind) {
          run.push(scr[i]);
          flush();
          run = [scr[i]];
          kind = vis[i];
        } else run.push(scr[i]);
      }
      flush();
    }
  }
  return { solid: solid.join(""), hidden: hidden.join("") };
}

// ---- the surfaces ------------------------------------------------------
const E = deg(40); // same elevation as the torus figure
const Z = [0, 0, 1];

// half-plane through the z-axis at angle phi (a "meridian" section)
function meridian(phi, c = [0, 0, 0], reach = 3) {
  return { o: c, a: [Math.cos(phi), Math.sin(phi), 0], b: Z, s: [0, reach], t: [-1.5, 1.5] };
}
// plane z = const (a "parallel" section)
function parallel(z, sx = [-3.2, 3.2], ty = [-2, 2]) {
  return { o: [0, 0, z], a: [1, 0, 0], b: [0, 1, 0], s: sx, t: ty };
}

// sphere (g = 0)
const sphere = (p) => sdSphere(p, 1);
const sphereSlices = [
  ...Array.from({ length: 12 }, (_, k) => meridian((2 * Math.PI * k) / 12, [0, 0, 0], 1.2)),
  ...[-60, -30, 0, 30, 60].map((l) => parallel(Math.sin(deg(l)), [-1.2, 1.2], [-1.2, 1.2])),
];

// torus (g = 1); proportions of the torus figure (r / R = 62 / 150)
const R0 = 1;
const r0 = 0.415;
const NMER = 18;
const torusParallelZ = [0, 1, 2, 3, 4].map((k) => Math.sin((2 * Math.PI * k) / 10));

// double torus (g = 2): two tori fused along a smooth seam
const DC = 1.02;
const DR = 0.78;
const Dr = 0.33;
const doubleTorus = (p) => smin(sdTorus(p, [-DC, 0, 0], DR, Dr), sdTorus(p, [DC, 0, 0], DR, Dr), 0.22);
const doubleTorusSlices = [
  ...Array.from({ length: 9 }, (_, k) => {
    const phi = deg(100 + k * 20);
    return meridian(phi, [-DC, 0, 0], 1.6);
  }),
  ...Array.from({ length: 9 }, (_, k) => {
    const phi = deg(-80 + k * 20);
    return meridian(phi, [DC, 0, 0], 1.6);
  }),
  // across the waist
  ...[-1, 1].map((sy) => ({ o: [0, 0, 0], a: [0, sy, 0], b: Z, s: [0, 1.6], t: [-1, 1] })),
  ...[0, 1, 2, 3, 4].map((k) => parallel(Dr * Math.sin((2 * Math.PI * k) / 10) * 0.999)),
];

// ---- torus -> coffee cup ------------------------------------------------
// The ring of the torus shrinks into the handle while the body grows out of
// its left arc; the well is carved last, and the ring is united after the
// carving so it is never cut. The whole object stands up as it deforms.
// Nothing is torn and nothing is glued: every frame has genus 1.
const CUP = {
  Rh: 0.5, // handle ring radius
  rh: 0.13, // handle tube radius
  wall: 0.22,
  Rb: 0.78, // body radius
  Hb: 0.8, // body half height
  bottom: 0.2,
};
const POSE = deg(70); // final rotation: the cup stands upright, seen from slightly above

function cupState(t) {
  const s = smoothstep(0, 1, t);
  const R = lerp(R0, CUP.Rh, smoothstep(0, 0.75, t));
  const r = lerp(r0, CUP.rh, smoothstep(0, 0.75, t));
  const grow = smoothstep(0.05, 0.75, t);
  const carve = smoothstep(0.55, 1, t);
  const Rb = CUP.Rb * grow;
  const Hb = CUP.Hb * grow;
  const axisX = -R + CUP.wall / 2 - Rb + 0.02;
  // keep the object centred while it changes shape
  const shift = lerp(0, 0.62, s);
  return { t, s, R, r, grow, carve, Rb, Hb, axisX, shift, pose: lerp(0, POSE, s) };
}

function cupSdf(st) {
  const { R, r, grow, carve, Rb, Hb, axisX, shift } = st;
  return (q) => {
    const p = [q[0] - shift, q[1], q[2]];
    const ring = sdTorus(p, [0, 0, 0], R, r);
    if (grow < 0.02) return ring;
    const round = Math.min(0.1, 0.5 * Rb);
    let body = sdCylY(p, [axisX, 0, 0], Rb, Hb, round);
    if (carve > 0.01) {
      const depth = carve * (2 * Hb - CUP.bottom);
      const well = sdCylY(p, [axisX, Hb - depth / 2 + 0.3, 0], Rb - CUP.wall, depth / 2 + 0.3, 0.06);
      body = smax(body, -well, 0.04);
    }
    return smin(body, ring, 0.09);
  };
}

function cupSlices(st) {
  const { s, Rb, axisX, shift } = st;
  const out = [];
  // meridians on the handle side stay meridians
  for (let k = 0; k < NMER; k++) {
    const phi = (2 * Math.PI * k) / NMER;
    if (Math.cos(phi) < -0.01) continue;
    const m = meridian(phi, [shift, 0, 0], lerp(1.6, 0.9, s));
    out.push(m);
  }
  // meridians on the far side turn into horizontal rings of the cup body
  const left = [];
  for (let k = 0; k < NMER; k++) {
    const phi = (2 * Math.PI * k) / NMER;
    if (Math.cos(phi) < -0.01) left.push(phi);
  }
  // (the planes turn early, while the body is still small, so that they
  // never sweep through it like a fan)
  const ps = smoothstep(0, 0.45, st.t);
  left.forEach((phi, idx) => {
    const tangent = [Math.sin(phi), -Math.cos(phi), 0]; // points to +y on the left arc
    const n = unit(lerp3(tangent, [0, 1, 0], ps));
    const a = cross(Z, n);
    const yk = lerp(-0.86, 0.86, idx / (left.length - 1)) * CUP.Hb;
    const o0 = [shift + R0 * Math.cos(phi), R0 * Math.sin(phi), 0];
    const o1 = [shift + axisX, yk, 0];
    const o = lerp3(o0, o1, ps);
    const reach = lerp(0.72, Math.max(Rb, 0.45) + 0.14, ps);
    out.push({ o, a, b: Z, s: [-reach, reach], t: [-reach, reach], keep: (p) => len(sub(p, o)) < reach });
  });
  // parallels widen to cover the body
  const zs = lerp(r0, CUP.Rb * 0.93, s);
  for (const k of [0, 1, 2, 3, 4]) {
    const z = Math.sin((2 * Math.PI * k) / 10) * zs * 0.999;
    out.push(parallel(z, [-2.4, 2.4], [-1.8, 1.8]));
  }
  return out;
}

// ---- Fig. 1 ------------------------------------------------------------
const SC = 62; // pixels per unit
const W1 = 900;
const H1 = 290;
const ROW_Y = 150; // screen y of the surfaces' centres
const PANEL_X = { sphere: 118, torus: 372, double: 690 };

function place(cx) {
  return (x, y) => [cx + x * SC, ROW_Y + y * SC];
}

function renderFig1Parts() {
  const cam = camera(E);
  const sphereR = renderSurface(sphere, sphereSlices, cam, place(PANEL_X.sphere));
  const doubleR = renderSurface(doubleTorus, doubleTorusSlices, cam, place(PANEL_X.double));
  const FRAMES = 14;
  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    const st = cupState(i / (FRAMES - 1));
    frames.push(renderSurface(cupSdf(st), cupSlices(st), camera(E, st.pose), place(PANEL_X.torus)));
  }
  return { sphere: sphereR, double: doubleR, frames };
}

function group(r, extra = "") {
  return `<g${extra}><path class="tp-h" d="${r.hidden}"/><path class="tp-s" d="${r.solid}"/></g>`;
}

const LINE_STYLE = `
    .tp-s { fill: none; stroke: #1a1a1a; stroke-width: 1.1; stroke-linecap: round; stroke-linejoin: round; }
    .tp-h { fill: none; stroke: #b9b9b9; stroke-width: 0.8; stroke-dasharray: 3 4; stroke-linecap: round; }
    .tp-label { font-family: inherit; font-size: 20px; fill: #333; text-anchor: middle; }
    .tp-label .tp-m { font-style: italic; }
    .tp-name { font-family: inherit; font-size: 15px; fill: #777; text-anchor: middle; }`;

// Flip-book timeline for the morph, in frame slots:
// hold torus, deform, hold cup, deform back.
function flipbookCss(nFrames) {
  const HOLD = 10;
  const seq = [];
  for (let i = 0; i < HOLD; i++) seq.push(0);
  for (let i = 1; i < nFrames - 1; i++) seq.push(i);
  for (let i = 0; i < HOLD; i++) seq.push(nFrames - 1);
  for (let i = nFrames - 2; i >= 1; i--) seq.push(i);
  const total = seq.length;
  const slot = 0.3; // seconds per slot
  let css = "";
  for (let f = 0; f < nFrames; f++) {
    const stops = [];
    let prev = null;
    seq.forEach((fr, i) => {
      const on = fr === f ? 1 : 0;
      if (on !== prev) stops.push(`${((100 * i) / total).toFixed(3)}% { opacity: ${on}; }`);
      prev = on;
    });
    stops.push(`100% { opacity: ${prev}; }`);
    css += `
      .tp-f${f} { animation: tp-k${f} ${(total * slot).toFixed(1)}s step-end infinite; }
      @keyframes tp-k${f} { ${stops.join(" ")} }`;
  }
  return `
    .tp-morph > g { opacity: 0; }
    .tp-morph > .tp-f0 { opacity: 1; }
    @media (prefers-reduced-motion: no-preference) {${css}
    }`;
}

function fig1Svg(parts, { lang, bare }) {
  const names =
    lang === "ja"
      ? { sphere: "球面", torus: "トーラス", double: "ダブルトーラス" }
      : { sphere: "sphere", torus: "torus", double: "double torus" };
  const alt =
    lang === "ja"
      ? "球面・トーラス・ダブルトーラスのワイヤーフレーム線画が横に並び、それぞれ g = 0, 1, 2 と記されている。中央のトーラスはゆっくりとコーヒーカップへ連続変形し、また元に戻る。"
      : "Wireframe line drawings of a sphere, a torus and a double torus side by side, labelled g = 0, 1, 2. The torus in the middle slowly deforms into a coffee cup and back.";
  const labelY = 258;
  const label = (x, g, name) =>
    `<text class="tp-label" x="${x}" y="${labelY}"><tspan class="tp-m">g</tspan> = ${g}</text>` +
    (bare ? "" : `<text class="tp-name" x="${x}" y="${labelY + 20}">${name}</text>`);
  const [sx, sy] = place(PANEL_X.sphere)(0, 0);
  const rim = `<circle class="tp-s" cx="${sx}" cy="${sy}" r="${SC}"/>`;
  const morph = bare
    ? group(parts.frames[0])
    : `<g class="tp-morph">${parts.frames.map((fr, i) => group(fr, ` class="tp-f${i}"`)).join("")}</g>`;
  const style = LINE_STYLE + (bare ? "" : flipbookCss(parts.frames.length));
  // crop to the drawing: the surfaces occupy roughly x 40..860, y 70..
  const X0 = 34;
  const Y0 = 66;
  const height = (bare ? H1 - 18 : H1) - Y0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${X0} ${Y0} ${W1 - 2 * X0} ${height}" role="img" aria-label="${bare ? "Wireframe line drawings of a sphere, a torus and a double torus." : alt}">
  <style>${style}
  </style>
  ${group(parts.sphere)}
  ${rim}
  ${morph}
  ${group(parts.double)}
  ${label(PANEL_X.sphere, 0, names.sphere)}
  ${label(PANEL_X.torus, 1, names.torus)}
  ${label(PANEL_X.double, 2, names.double)}
</svg>`;
}

// ---- Fig. 2: the hairy ball --------------------------------------------
function fig2Svg({ lang }) {
  const W = 520;
  const H = 440;
  const S = 170;
  const CX = W / 2;
  const CY = 236;
  const cam = camera(deg(52));
  const plc = (x, y) => [CX + x * S, CY + y * S];
  const grid = renderSurface(
    sphere,
    [
      ...Array.from({ length: 12 }, (_, k) => meridian((2 * Math.PI * k) / 12, [0, 0, 0], 1.2)),
      ...[-60, -30, 0, 30, 60].map((l) => parallel(Math.sin(deg(l)), [-1.2, 1.2], [-1.2, 1.2])),
    ],
    cam,
    plc
  );
  // a whorl: the field turns around the pole and drifts away from it,
  // vanishing at the pole (and, out of sight, at the other one)
  const arrows = [];
  const heads = [];
  const polar = [16, 30, 44, 58, 72, 86, 100, 114];
  for (const th of polar) {
    const n = Math.max(6, Math.round(24 * Math.sin(deg(th))));
    for (let k = 0; k < n; k++) {
      const theta = deg(th);
      const phi = (2 * Math.PI * (k + (th / 14) * 0.5)) / n;
      const p = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
      if (dot(p, cam.viewObj) < 0.12) continue;
      const ePhi = [-Math.sin(phi), Math.cos(phi), 0];
      const eTheta = [Math.cos(theta) * Math.cos(phi), Math.cos(theta) * Math.sin(phi), -Math.sin(theta)];
      const mag = Math.sin(theta);
      const v = mul(unit(add(ePhi, mul(eTheta, 0.55))), 0.2 * mag);
      const steps = 8;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const q = unit(add(p, mul(v, i / steps - 0.5)));
        pts.push(plc(...cam.project(q)));
      }
      arrows.push(toPath(simplify(pts, 0.2)));
      const [x1, y1] = pts[pts.length - 2];
      const [x2, y2] = pts[pts.length - 1];
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const L = 3 + 5 * mag;
      const sp = 0.45;
      heads.push(
        `M${fmt(x2 - L * Math.cos(ang - sp))} ${fmt(y2 - L * Math.sin(ang - sp))}L${fmt(x2)} ${fmt(y2)}L${fmt(x2 - L * Math.cos(ang + sp))} ${fmt(y2 - L * Math.sin(ang + sp))}`
      );
    }
  }
  const [px, py] = plc(...cam.project([0, 0, 1]));
  const outline = `<circle cx="${CX}" cy="${CY}" r="${S}" class="tp-rim"/>`;
  const alt =
    lang === "ja"
      ? "球面のワイヤーフレーム線画の上に、ベクトル場を表す多数の小さな矢印が渦を巻いて描かれている。矢印は上方の一点に近づくにつれて短くなり、その点で消えている。その点に「つむじ」と注記がある。"
      : "A wireframe sphere covered with small arrows of a tangent vector field swirling around one point near the top. The arrows shrink as they approach that point and vanish there; the point is annotated “cowlick”.";
  const note = lang === "ja" ? "つむじ" : "cowlick";
  const lx = px + 112;
  const ly = py - 62;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 ${W} ${H - 60}" role="img" aria-label="${alt}">
  <style>
    .tp-grid-s { fill: none; stroke: #b0b0b0; stroke-width: 0.7; }
    .tp-rim { fill: none; stroke: #1a1a1a; stroke-width: 1.2; }
    .tp-arrow { fill: none; stroke: #1a1a1a; stroke-width: 1.05; stroke-linecap: round; stroke-linejoin: round; }
    .tp-zero { fill: #fdfdfc; stroke: #1a1a1a; stroke-width: 1.2; }
    .tp-lead { fill: none; stroke: #444; stroke-width: 0.9; }
    .tp-note { font-family: inherit; font-size: 20px; fill: #333; }
    .tp-note .tp-m { font-style: italic; }
    .tp-note-sub { font-family: inherit; font-size: 16px; fill: #777; }
  </style>
  <path class="tp-grid-s" d="${grid.solid}"/>
  ${outline}
  <path class="tp-arrow" d="${arrows.join("")}${heads.join("")}"/>
  <circle class="tp-zero" cx="${fmt(px)}" cy="${fmt(py)}" r="3.4"/>
  <path class="tp-lead" d="M${fmt(px + 5)} ${fmt(py - 4)}L${fmt(lx - 6)} ${fmt(ly + 5)}"/>
  <text class="tp-note" x="${fmt(lx)}" y="${fmt(ly)}"><tspan class="tp-m">v</tspan>(<tspan class="tp-m">p</tspan>) = 0</text>
  <text class="tp-note-sub" x="${fmt(lx)}" y="${fmt(ly + 21)}">${note}</text>
</svg>`;
}

// ---- write -------------------------------------------------------------
mkdirSync(join(root, "src/figures"), { recursive: true });
const parts = renderFig1Parts();
const files = {
  "topo-surfaces-ja.svg": fig1Svg(parts, { lang: "ja" }),
  "topo-surfaces-en.svg": fig1Svg(parts, { lang: "en" }),
  "topo-surfaces-bare.svg": fig1Svg(parts, { lang: "en", bare: true }),
  "topo-hairy-ja.svg": fig2Svg({ lang: "ja" }),
  "topo-hairy-en.svg": fig2Svg({ lang: "en" }),
};
for (const [name, text] of Object.entries(files)) {
  writeFileSync(join(root, "src/figures", name), text);
  console.log(`wrote src/figures/${name} (${(text.length / 1024).toFixed(1)} KiB)`);
}
