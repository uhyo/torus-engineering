// Generates the wireframe Klein bottle figure (same drawing style as the torus).
// Uses the classical "bottle" immersion parametrization, u in [0,pi], v in [0,2pi].
// Outputs:
//   src/figures/klein-ja.svg / klein-en.svg (alt text differs)
//   src/figures/klein-bare.svg (for the OGP image)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function kleinPoint(u, v) {
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const cv = Math.cos(v);
  const sv = Math.sin(v);
  const c2 = cu * cu;
  const c3 = c2 * cu;
  const c4 = c2 * c2;
  const c5 = c4 * cu;
  const c6 = c4 * c2;
  const c7 = c6 * cu;
  const x =
    (-2 / 15) *
    cu *
    (3 * cv - 30 * su + 90 * c4 * su - 60 * c6 * su + 5 * cu * cv * su);
  const y =
    (-1 / 15) *
    su *
    (3 * cv -
      3 * c2 * cv -
      48 * c4 * cv +
      48 * c6 * cv -
      60 * su +
      5 * cu * cv * su -
      5 * c3 * cv * su -
      80 * c5 * cv * su +
      80 * c7 * cv * su);
  const z = (2 / 15) * (3 + 5 * cu * su) * sv;
  return [x, y, z];
}

// ---- view --------------------------------------------------------------
// rotate so the bottle stands upright and is seen slightly from the side
const TILT = (40 * Math.PI) / 180; // rotate about screen-vertical axis
const LEAN = (0 * Math.PI) / 180; // slight lean

function view([x, y, z]) {
  // in the parametrization the bottle's long axis is along y
  // screen: up = -y, right = x rotated with z by TILT
  const x1 = x * Math.cos(TILT) + z * Math.sin(TILT);
  const z1 = -x * Math.sin(TILT) + z * Math.cos(TILT);
  const y1 = y * Math.cos(LEAN) - x1 * Math.sin(LEAN);
  const x2 = x1 * Math.cos(LEAN) + y * Math.sin(LEAN);
  return [x2, y1, z1]; // z1 = toward viewer
}

const W = 560;
const H = 620;

// auto-fit: compute view-space bounds first
let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
for (let i = 0; i <= 100; i++) {
  for (let j = 0; j <= 100; j++) {
    const [x, y] = view(kleinPoint((Math.PI * i) / 100, (2 * Math.PI * j) / 100));
    if (x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (y < by0) by0 = y;
    if (y > by1) by1 = y;
  }
}
const PAD = 30;
const SCALE = Math.min((W - 2 * PAD) / (bx1 - bx0), (H - 2 * PAD) / (by1 - by0));
const CX = W / 2 - (SCALE * (bx0 + bx1)) / 2;
const CY = H / 2 + (SCALE * (by0 + by1)) / 2;

function proj(p) {
  const [x, y, z] = view(p);
  return [CX + x * SCALE, CY - y * SCALE, z];
}

// ---- hidden-line removal via z-buffer ---------------------------------
// rasterize a dense triangulation of the surface into a per-pixel max-depth
// buffer, then test curve samples against it
const zbuf = new Float32Array(W * H).fill(-Infinity);
{
  const GU = 600;
  const GV = 600;
  const pts = new Float32Array((GU + 1) * (GV + 1) * 3);
  for (let i = 0; i <= GU; i++) {
    for (let j = 0; j <= GV; j++) {
      const u = (Math.PI * i) / GU;
      const v = (2 * Math.PI * j) / GV;
      const [sx, sy, z] = proj(kleinPoint(u, v));
      const o = (i * (GV + 1) + j) * 3;
      pts[o] = sx;
      pts[o + 1] = sy;
      pts[o + 2] = z;
    }
  }
  function tri(x1, y1, z1, x2, y2, z2, x3, y3, z3) {
    const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(x1, x2, x3)));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(y1, y2, y3)));
    const det = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    if (Math.abs(det) < 1e-9) return;
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const w1 = ((x2 - px) * (y3 - py) - (x3 - px) * (y2 - py)) / det;
        const w2 = ((x3 - px) * (y1 - py) - (x1 - px) * (y3 - py)) / det;
        const w3 = 1 - w1 - w2;
        if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
        const z = w1 * z1 + w2 * z2 + w3 * z3;
        const o = py * W + px;
        if (z > zbuf[o]) zbuf[o] = z;
      }
    }
  }
  for (let i = 0; i < GU; i++) {
    for (let j = 0; j < GV; j++) {
      const a = (i * (GV + 1) + j) * 3;
      const b = (i * (GV + 1) + j + 1) * 3;
      const c = ((i + 1) * (GV + 1) + j) * 3;
      const d = ((i + 1) * (GV + 1) + j + 1) * 3;
      tri(pts[a], pts[a + 1], pts[a + 2], pts[b], pts[b + 1], pts[b + 2], pts[c], pts[c + 1], pts[c + 2]);
      tri(pts[d], pts[d + 1], pts[d + 2], pts[b], pts[b + 1], pts[b + 2], pts[c], pts[c + 1], pts[c + 2]);
    }
  }
}

const EPS = 0.022; // model-unit tolerance against the surface itself
function visible(u, v) {
  const [sx, sy, z] = proj(kleinPoint(u, v));
  const px = Math.round(sx);
  const py = Math.round(sy);
  // visible if any nearby pixel's front depth is not clearly in front of us
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = px + dx;
      const y = py + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (zbuf[y * W + x] - z <= EPS) return true;
    }
  }
  return false;
}

function fmt(n) {
  return (Math.round(n * 100) / 100).toString();
}

function toPath(points) {
  let d = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${fmt(points[i][0])} ${fmt(points[i][1])}`;
  }
  return d;
}

const solidPaths = [];
const hiddenPaths = [];

function addCurve(fn, vis, t0, t1, steps) {
  let cur = null;
  let curKind = null;
  const flush = () => {
    if (cur && cur.length > 1) (curKind === "solid" ? solidPaths : hiddenPaths).push(toPath(cur));
  };
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const [sx, sy] = proj(fn(t));
    const kind = vis(t) ? "solid" : "hidden";
    const pt = [sx, sy];
    if (kind !== curKind) {
      flush();
      cur = cur && cur.length ? [cur[cur.length - 1], pt] : [pt];
      curKind = kind;
    } else {
      cur.push(pt);
    }
  }
  flush();
}

// cross-sections (constant u): full circles in v
const NU = 14;
for (let k = 1; k < NU; k++) {
  const u = (Math.PI * k) / NU;
  addCurve((v) => kleinPoint(u, v), (v) => visible(u, v), 0, 2 * Math.PI, 160);
}
// lengthwise lines (constant v)
const NV = 8;
for (let k = 0; k < NV; k++) {
  const v = (2 * Math.PI * k) / NV;
  addCurve((u) => kleinPoint(u, v), (u) => visible(u, v), 0.001, Math.PI - 0.001, 200);
}

function svg(alt) {
  const hidden = hiddenPaths.map((d) => `<path d="${d}"/>`).join("\n      ");
  const solid = solidPaths.map((d) => `<path d="${d}"/>`).join("\n      ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt}">
  <style>
    .t-solid path { stroke: #1a1a1a; stroke-width: 1.05; stroke-linecap: round; }
    .t-hidden path { stroke: #c0c0c0; stroke-width: 0.75; stroke-dasharray: 3 4; stroke-linecap: round; }
  </style>
    <g class="t-hidden" fill="none">
      ${hidden}
    </g>
    <g class="t-solid" fill="none">
      ${solid}
    </g>
  </svg>`;
}

mkdirSync(join(root, "src/figures"), { recursive: true });
writeFileSync(
  join(root, "src/figures/klein-ja.svg"),
  svg("クラインの壺のワイヤーフレーム線画。管が壺の側面を貫通して内部へ折り返している。")
);
writeFileSync(
  join(root, "src/figures/klein-en.svg"),
  svg("Wireframe line drawing of a Klein bottle; the neck passes through the side wall and rejoins the interior.")
);
writeFileSync(join(root, "src/figures/klein-bare.svg"), svg("Wireframe line drawing of a Klein bottle."));
console.log("wrote klein figures:", solidPaths.length, "solid,", hiddenPaths.length, "hidden");
