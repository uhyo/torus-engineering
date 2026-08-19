// Generates the wireframe torus figure (classic math-textbook style) as SVG.
// Outputs:
//   src/figures/torus-ja.svg  (labeled: 実行ループ / 改善ループ)
//   src/figures/torus-en.svg  (labeled: execution loop / improvement loop)
//   src/figures/torus-bare.svg (no labels, for the OGP image)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- geometry ----------------------------------------------------------
const R = 150; // big radius
const r = 62; // tube radius
const E = (40 * Math.PI) / 180; // viewing elevation above torus plane
const sinE = Math.sin(E);
const cosE = Math.cos(E);

// torus point for angles u (around tube) and v (around axis)
function P(u, v) {
  const x = (R + r * Math.cos(u)) * Math.cos(v);
  const y = (R + r * Math.cos(u)) * Math.sin(v);
  const z = r * Math.sin(u);
  return [x, y, z];
}
// outward unit normal
function N(u, v) {
  return [Math.cos(u) * Math.cos(v), Math.cos(u) * Math.sin(v), Math.sin(u)];
}
// orthographic projection to screen (y grows downward in SVG)
function proj([x, y, z]) {
  return [x, -(y * sinE + z * cosE)];
}
// visibility: normal has a component toward the viewer
function visible(u, v) {
  const [nx, ny, nz] = N(u, v);
  return -ny * cosE + nz * sinE > 0.02;
}

const W = 760;
const H = 520;
const CX = W / 2;
const CY = H / 2 + 6;

function fmt(n) {
  return (Math.round(n * 100) / 100).toString();
}

// sample a curve t -> {point(t), visible(t)} and split into solid/dashed paths
function curvePaths(fn, vis, t0, t1, steps) {
  const segs = { solid: [], hidden: [] };
  let cur = null;
  let curKind = null;
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const [sx, sy] = proj(fn(t));
    const kind = vis(t) ? "solid" : "hidden";
    const pt = [CX + sx, CY + sy];
    if (kind !== curKind) {
      if (cur && cur.length > 1) segs[curKind].push(cur);
      // start new segment from previous point to avoid gaps
      cur = cur && cur.length ? [cur[cur.length - 1], pt] : [pt];
      curKind = kind;
    } else {
      cur.push(pt);
    }
  }
  if (cur && cur.length > 1) segs[curKind].push(cur);
  return segs;
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

function addCurve(fn, vis) {
  const { solid, hidden } = curvePaths(fn, vis, 0, 2 * Math.PI, 180);
  for (const s of solid) solidPaths.push(toPath(s));
  for (const h of hidden) hiddenPaths.push(toPath(h));
}

// meridians (constant v): circles around the tube
const NMER = 18;
for (let k = 0; k < NMER; k++) {
  const v = (2 * Math.PI * k) / NMER;
  addCurve((u) => P(u, v), (u) => visible(u, v));
}
// parallels (constant u): circles around the axis
const NPAR = 10;
for (let k = 0; k < NPAR; k++) {
  const u = (2 * Math.PI * k) / NPAR;
  addCurve((v) => P(u, v), (v) => visible(u, v));
}

// ---- annotation arrows -------------------------------------------------
// meridian arrow: circle around the tube, slightly outside it, at v = -0.35
const AV = -0.35;
const ar = r + 16;
function meridianArrowPoint(u) {
  const x = (R + ar * Math.cos(u)) * Math.cos(AV);
  const y = (R + ar * Math.cos(u)) * Math.sin(AV);
  const z = ar * Math.sin(u);
  return [x, y, z];
}
// draw from u=100deg going 300 degrees so the head lands near the top front
const mer = [];
const mSteps = 120;
const mu0 = (100 * Math.PI) / 180;
const mu1 = mu0 + (300 * Math.PI) / 180;
for (let i = 0; i <= mSteps; i++) {
  const u = mu0 + ((mu1 - mu0) * i) / mSteps;
  const [sx, sy] = proj(meridianArrowPoint(u));
  mer.push([CX + sx, CY + sy]);
}
const merPath = toPath(mer);
// arrowhead direction at end of meridian arrow
function headAt(pts) {
  const [x1, y1] = pts[pts.length - 2];
  const [x2, y2] = pts[pts.length - 1];
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = 9;
  const s = 0.46;
  const p1 = [x2 - L * Math.cos(a - s), y2 - L * Math.sin(a - s)];
  const p2 = [x2 - L * Math.cos(a + s), y2 - L * Math.sin(a + s)];
  return `M${fmt(p1[0])} ${fmt(p1[1])}L${fmt(x2)} ${fmt(y2)}L${fmt(p2[0])} ${fmt(p2[1])}`;
}
const merHead = headAt(mer);

// longitude arrow: arc in the z=0 plane, outside the torus, lower left
const lr = R + r + 22;
const lon = [];
const lSteps = 120;
const lv0 = (140 * Math.PI) / 180;
const lv1 = (243 * Math.PI) / 180;
for (let i = 0; i <= lSteps; i++) {
  const v = lv0 + ((lv1 - lv0) * i) / lSteps;
  const [sx, sy] = proj([lr * Math.cos(v), lr * Math.sin(v), 0]);
  lon.push([CX + sx, CY + sy]);
}
const lonPath = toPath(lon);
const lonHead = headAt(lon);

// label anchor points
const merLabelAt = proj(meridianArrowPoint((-8 * Math.PI) / 180));
const lonLabelAt = proj([lr * Math.cos((180 * Math.PI) / 180), lr * Math.sin((180 * Math.PI) / 180), 0]);

// ---- assemble ----------------------------------------------------------
function svg({ labels, bare }) {
  const hidden = hiddenPaths.map((d) => `<path d="${d}"/>`).join("\n      ");
  const solid = solidPaths.map((d) => `<path d="${d}"/>`).join("\n      ");
  let ann = "";
  if (!bare) {
    const mlx = CX + merLabelAt[0] + 16;
    const mly = CY + merLabelAt[1] + 26;
    const llx = CX + lonLabelAt[0] - 12;
    const lly = CY + lonLabelAt[1] - 14;
    ann = `
    <g class="t-arrow" fill="none">
      <path d="${merPath}"/>
      <path d="${merHead}"/>
      <path d="${lonPath}"/>
      <path d="${lonHead}"/>
    </g>
    <g class="t-label">
      <text x="${fmt(mlx)}" y="${fmt(mly)}">${labels.meridian}</text>
      <text x="${fmt(mlx)}" y="${fmt(mly + 17)}" class="t-sub">${labels.meridianSub}</text>
      <text x="${fmt(llx)}" y="${fmt(lly)}" text-anchor="end">${labels.longitude}</text>
      <text x="${fmt(llx)}" y="${fmt(lly + 17)}" text-anchor="end" class="t-sub">${labels.longitudeSub}</text>
    </g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${labels.alt}">
    <g class="t-hidden" fill="none">
      ${hidden}
    </g>
    <g class="t-solid" fill="none">
      ${solid}
    </g>${ann}
  </svg>`;
}

const style = `
  <style>
    .t-solid path { stroke: #1a1a1a; stroke-width: 1.1; stroke-linecap: round; }
    .t-hidden path { stroke: #b9b9b9; stroke-width: 0.8; stroke-dasharray: 3 4; stroke-linecap: round; }
    .t-arrow path { stroke: #444; stroke-width: 1.2; }
    .t-label text { font-family: inherit; font-style: italic; font-size: 16px; fill: #333; }
    .t-label .t-sub { font-size: 13px; fill: #777; font-style: normal; }
  </style>`;

function withStyle(s) {
  return s.replace("aria-label", `aria-label`).replace(/(<svg[^>]*>)/, `$1${style}`);
}

const ja = withStyle(
  svg({
    labels: {
      meridian: "実行ループ",
      meridianSub: "(子午線方向)",
      longitude: "改善ループ",
      longitudeSub: "(経線方向)",
      alt: "トーラスのワイヤーフレーム線画。子午線方向に「実行ループ」、経線方向に「改善ループ」の矢印が添えられている。",
    },
  })
);
const en = withStyle(
  svg({
    labels: {
      meridian: "execution loop",
      meridianSub: "(meridian)",
      longitude: "improvement loop",
      longitudeSub: "(longitude)",
      alt: "Wireframe line drawing of a torus, annotated with an arrow labeled “execution loop” along the meridian and an arrow labeled “improvement loop” along the longitude.",
    },
  })
);
const bare = withStyle(svg({ labels: { alt: "Wireframe line drawing of a torus." }, bare: true }));

mkdirSync(join(root, "src/figures"), { recursive: true });
writeFileSync(join(root, "src/figures/torus-ja.svg"), ja);
writeFileSync(join(root, "src/figures/torus-en.svg"), en);
writeFileSync(join(root, "src/figures/torus-bare.svg"), bare);
console.log("wrote torus figures:", solidPaths.length, "solid paths,", hiddenPaths.length, "hidden paths");
