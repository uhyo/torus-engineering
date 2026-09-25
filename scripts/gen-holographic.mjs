// Generates the figures for the Holographic Engineering page, in the same
// wireframe style as the torus figure (black hairlines, grey dashed hidden
// lines).
// Outputs:
//   src/figures/holo-bulk-ja.svg / -en.svg  Fig. 1: a wireframe sphere with a
//     tree of subagents inside (the bulk) and the same information written on
//     its surface as a grid of marks (the boundary). The tree grows and the
//     marks multiply in step with it (off under prefers-reduced-motion).
//   src/figures/holo-bulk-bare.svg          same, static and unlabelled, for
//     the OGP image
//   src/figures/holo-blackhole-ja.svg / -en.svg  Fig. 2: a collapsed subagent
//     and its Hawking radiation
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- vectors -----------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / len(a));
const deg = (d) => (d * Math.PI) / 180;
const fmt = (n) => (Math.round(n * 10) / 10).toString();

// deterministic PRNG, so that regenerating the figures is reproducible
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- camera ------------------------------------------------------------
// Orthographic view of the unit sphere (z up) from elevation E, as in the
// other figures.
const E = deg(18);
const sE = Math.sin(E);
const cE = Math.cos(E);
const VIEW = [0, -cE, sE]; // toward the viewer
const project = ([x, y, z]) => [x, -(y * sE + z * cE)];
const sph = (lat, lon) => [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];

function toPath(pts) {
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${fmt(pts[i][0])} ${fmt(pts[i][1])}`;
  return d;
}

// sample a curve on the sphere and split it into visible / hidden runs
function sphereCurve(fn, steps, place, out) {
  let run = [];
  let kind = null;
  for (let i = 0; i <= steps; i++) {
    const p = fn(i / steps);
    const k = dot(p, VIEW) >= 0;
    const q = place(project(p));
    if (k !== kind && run.length) {
      run.push(q);
      if (run.length > 1) (kind ? out.solid : out.hidden).push(toPath(run));
      run = [];
    }
    kind = k;
    run.push(q);
  }
  if (run.length > 1) (kind ? out.solid : out.hidden).push(toPath(run));
}

// ---- Fig. 1: bulk and boundary -----------------------------------------
const W1 = 760;
const H1 = 520;
const S1 = 190; // sphere radius, px
const CX1 = W1 / 2;
const CY1 = 262;
const place1 = ([x, y]) => [CX1 + x * S1, CY1 + y * S1];

function sphereGrid() {
  const out = { solid: [], hidden: [] };
  for (let k = 0; k < 12; k++) {
    const lon = (2 * Math.PI * k) / 12;
    sphereCurve((t) => sph(deg(-90 + 180 * t), lon), 90, place1, out);
  }
  for (const l of [-60, -30, 0, 30, 60]) {
    sphereCurve((t) => sph(deg(l), 2 * Math.PI * t), 180, place1, out);
  }
  return { solid: out.solid.join(""), hidden: out.hidden.join("") };
}

// the subagent tree: an orchestrator at the bottom, delegating upward
function buildTree() {
  const levels = [
    { z: -0.66, r: 0, spread: 0 },
    { z: -0.22, r: 0.3, spread: 0 },
    { z: 0.16, r: 0.5, spread: 34 },
    { z: 0.5, r: 0.62, spread: 16 },
  ];
  const nodes = [{ p: [0, 0, levels[0].z], az: 0, depth: 0, parent: -1 }];
  const fan = [3, 2, 2];
  let frontier = [0];
  for (let d = 1; d < levels.length; d++) {
    const next = [];
    for (const pi of frontier) {
      const parent = nodes[pi];
      const n = fan[d - 1];
      for (let c = 0; c < n; c++) {
        const az = d === 1 ? 90 + 25 + (360 * c) / n : parent.az + (c - (n - 1) / 2) * 2 * levels[d].spread;
        const L = levels[d];
        const p = [L.r * Math.cos(deg(az)), L.r * Math.sin(deg(az)), L.z];
        nodes.push({ p, az, depth: d, parent: pi });
        next.push(nodes.length - 1);
      }
    }
    frontier = next;
  }
  return nodes; // breadth-first order
}

// the boundary: a grid of small cells in latitude/longitude, some of them
// filled. Only cells facing the viewer are drawn.
function boundaryMarks(nSteps) {
  const rand = rng(20260925);
  const marks = [];
  const STEP = 7.5;
  const INSET = 1.9;
  for (let lat = -60; lat < 60; lat += STEP) {
    for (let lon = 0; lon < 360; lon += STEP) {
      const c = sph(deg(lat + STEP / 2), deg(lon + STEP / 2));
      if (dot(c, VIEW) < 0.34) continue;
      if (rand() > 0.44) continue;
      const a0 = lat + INSET;
      const a1 = lat + STEP - INSET;
      const b0 = lon + INSET;
      const b1 = lon + STEP - INSET;
      const corners = [
        [a0, b0],
        [a0, b1],
        [a1, b1],
        [a1, b0],
      ].map(([a, b]) => place1(project(sph(deg(a), deg(b)))));
      marks.push(`${toPath(corners)}Z`);
    }
  }
  // shuffle, then deal the marks out over the growth steps
  for (let i = marks.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [marks[i], marks[j]] = [marks[j], marks[i]];
  }
  const buckets = Array.from({ length: nSteps }, () => []);
  marks.forEach((m, i) => buckets[Math.floor((i * nSteps) / marks.length)].push(m));
  return buckets.map((b) => b.join(""));
}

// Growth timeline: step k fades in at k/N of the growth phase; everything
// holds, then fades out together and the tree grows again.
function growthCss(nSteps) {
  const DUR = 15; // seconds per cycle
  const GROW = 58; // % of the cycle spent growing
  const HOLD = 93; // % at which the fade-out begins
  let css = "";
  for (let k = 0; k < nSteps; k++) {
    const a = (GROW * k) / nSteps;
    const b = a + 1.6;
    css += `
      .hg-s${k} { animation: hg-k${k} ${DUR}s linear infinite; }
      @keyframes hg-k${k} { 0%, ${a.toFixed(2)}% { opacity: 0; } ${b.toFixed(2)}%, ${HOLD}% { opacity: 1; } 100% { opacity: 0; } }`;
  }
  return `
    @media (prefers-reduced-motion: no-preference) {${css}
    }`;
}

function fig1Svg({ lang, bare }) {
  const grid = sphereGrid();
  const tree = buildTree();
  const N = tree.length;
  const marks = boundaryMarks(N);
  const P = (p) => place1(project(p));

  // edges first, so that every node is drawn over every edge
  const edges = [];
  const nodes = [];
  tree.forEach((node, k) => {
    const [x, y] = P(node.p);
    if (node.parent >= 0) {
      const [px, py] = P(tree[node.parent].p);
      edges.push(`<path class="hg-s${k} hg-edge" d="M${fmt(px)} ${fmt(py)}L${fmt(x)} ${fmt(y)}"/>`);
    }
    const r = node.depth === 0 ? 7 : node.depth === 3 ? 4.4 : 5.4;
    nodes.push(`<circle class="hg-s${k} hg-node" cx="${fmt(x)}" cy="${fmt(y)}" r="${r}"/>`);
  });
  const treeSvg = edges.join("") + nodes.join("");
  const markSvg = marks.map((d, k) => (d ? `<path class="hg-s${k} hg-mark" d="${d}"/>` : "")).join("");
  const rim = `<circle class="hg-rim" cx="${CX1}" cy="${CY1}" r="${S1}"/>`;

  // leader labels
  let labels = "";
  if (!bare) {
    const t =
      lang === "ja"
        ? { bulk: "バルク", bulkSub: "(エージェント内部)", bdy: "境界", bdySub: "(成果物への符号化)" }
        : { bulk: "bulk", bulkSub: "(agent interior)", bdy: "boundary", bdySub: "(surface encoding)" };
    const [bx, by] = P(tree[2].p);
    const bulkAt = [CX1 - S1 - 34, by - 66];
    const bdyPt = P(sph(deg(22), deg(-36)));
    const bdyAt = [CX1 + S1 + 34, bdyPt[1] - 70];
    labels = `
  <path class="hg-lead" d="M${fmt(bx - 7)} ${fmt(by - 4)}L${fmt(bulkAt[0] + 6)} ${fmt(bulkAt[1] + 8)}"/>
  <text class="hg-label" x="${fmt(bulkAt[0])}" y="${fmt(bulkAt[1])}" text-anchor="end">${t.bulk}</text>
  <text class="hg-label-sub" x="${fmt(bulkAt[0])}" y="${fmt(bulkAt[1] + 18)}" text-anchor="end">${t.bulkSub}</text>
  <path class="hg-lead" d="M${fmt(bdyPt[0] + 5)} ${fmt(bdyPt[1] - 4)}L${fmt(bdyAt[0] - 6)} ${fmt(bdyAt[1] + 8)}"/>
  <text class="hg-label" x="${fmt(bdyAt[0])}" y="${fmt(bdyAt[1])}">${t.bdy}</text>
  <text class="hg-label-sub" x="${fmt(bdyAt[0])}" y="${fmt(bdyAt[1] + 18)}">${t.bdySub}</text>`;
  }

  const alt = bare
    ? "A wireframe sphere with a tree of nodes inside and a grid of small marks on its surface."
    : lang === "ja"
      ? "球面のワイヤーフレーム線画。球の内部には、下の一点から上へ枝分かれするサブエージェントの木（小さなノードと枝）が描かれ、球の表面には同じ情報が格子状の小さな記号として書き込まれている。木が成長するにつれて、表面の記号も増えていく。内部に「バルク」、表面に「境界」と注記がある。"
      : "A wireframe sphere. Inside it, a tree of subagents — small nodes and branches — grows upward from a single point at the bottom; on its surface, the same information is written as a grid of small marks, which multiply as the tree grows. The interior is labelled “bulk” and the surface “boundary”.";
  const italic = lang === "en" ? "font-style: italic;" : "";
  const style = `
    .hg-h { fill: none; stroke: #b9b9b9; stroke-width: 0.8; stroke-dasharray: 3 4; stroke-linecap: round; }
    .hg-g { fill: none; stroke: #1a1a1a; stroke-width: 1; stroke-linecap: round; }
    .hg-rim { fill: none; stroke: #1a1a1a; stroke-width: 1.3; }
    .hg-edge { fill: none; stroke: #1a1a1a; stroke-width: 1.5; stroke-linecap: round; }
    .hg-node { fill: #fdfdfc; stroke: #1a1a1a; stroke-width: 1.4; }
    .hg-mark { fill: #6a6a6a; stroke: none; }
    .hg-lead { fill: none; stroke: #444; stroke-width: 0.9; }
    .hg-label { font-family: inherit; ${italic} font-size: 18px; fill: #333; }
    .hg-label-sub { font-family: inherit; font-size: 13.5px; fill: #777; }${bare ? "" : growthCss(N)}`;

  const X0 = bare ? CX1 - S1 - 16 : 30;
  const vw = bare ? 2 * S1 + 32 : W1 - 60;
  const Y0 = CY1 - S1 - 16;
  const vh = 2 * S1 + 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${X0} ${Y0} ${vw} ${vh}" role="img" aria-label="${alt}">
  <style>${style}
  </style>
  <path class="hg-h" d="${grid.hidden}"/>
  ${markSvg}
  <path class="hg-g" d="${grid.solid}"/>
  ${treeSvg}
  ${rim}${labels}
</svg>`;
}

// ---- Fig. 2: the black hole --------------------------------------------
function fig2Svg({ lang }) {
  const W = 640;
  const H = 400;
  const CX = W / 2;
  const CY = 196;
  const RH = 74; // horizon radius
  const rand = rng(4242);
  const rays = [];
  const ends = [];
  const NR = 30;
  for (let i = 0; i < NR; i++) {
    const a0 = (2 * Math.PI * (i + 0.5 * (rand() - 0.5))) / NR;
    const L = 26 + 104 * rand() * rand() + 20 * rand();
    const twist = (rand() < 0.5 ? -1 : 1) * (0.03 + 0.08 * rand());
    const pts = [];
    const steps = 24;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const r = RH + 9 + L * t;
      const a = a0 + twist * t * t;
      pts.push([CX + r * Math.cos(a), CY + r * Math.sin(a)]);
    }
    rays.push(toPath(pts));
    ends.push(pts[pts.length - 1]);
  }
  // the annotated ray: the one ending closest to the upper right
  const [ax, ay] = ends.reduce((best, e) => {
    const score = (e) => Math.abs(Math.atan2(e[1] - CY, e[0] - CX) + Math.PI / 3.2) - Math.hypot(e[0] - CX, e[1] - CY) / 400;
    return score(e) < score(best) ? e : best;
  });
  const note = lang === "ja" ? "ホーキング放射（ログ）" : "Hawking radiation (logs)";
  const inner = lang === "ja" ? "完了しました。" : "Done.";
  const innerSize = lang === "ja" ? 17 : 25;
  const alt =
    lang === "ja"
      ? "中央が真っ黒に塗りつぶされた円の線画。円の中には白抜きで「完了しました。」とだけ書かれている。円の縁からは、細い点線が四方へ不規則に漏れ出している。点線の一本に「ホーキング放射（ログ）」と注記がある。"
      : "A line drawing of a circle filled solid black. Inside it, in white, is written only “Done.” Thin dotted lines leak irregularly outward from its rim in every direction; one of them is annotated “Hawking radiation (logs)”.";
  const lx = ax + 46;
  const ly = ay - 44;
  const italic = lang === "en" ? "font-style: italic;" : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt}">
  <style>
    .hb-ray { fill: none; stroke: #1a1a1a; stroke-width: 1.5; stroke-dasharray: 0.1 6; stroke-linecap: round; }
    .hb-hole { fill: #111111; stroke: #111111; stroke-width: 1.2; }
    .hb-in { font-family: inherit; font-size: ${innerSize}px; fill: #fdfdfc; text-anchor: middle; dominant-baseline: central; ${italic} }
    .hb-lead { fill: none; stroke: #444; stroke-width: 0.9; }
    .hb-note { font-family: inherit; font-size: 15px; fill: #555; }
  </style>
  <path class="hb-ray" d="${rays.join("")}"/>
  <circle class="hb-hole" cx="${CX}" cy="${CY}" r="${RH}"/>
  <text class="hb-in" x="${CX}" y="${CY}">${inner}</text>
  <path class="hb-lead" d="M${fmt(ax + 5)} ${fmt(ay - 5)}L${fmt(lx - 4)} ${fmt(ly + 4)}"/>
  <text class="hb-note" x="${fmt(lx)}" y="${fmt(ly - 2)}">${note}</text>
</svg>`;
}

// ---- write -------------------------------------------------------------
mkdirSync(join(root, "src/figures"), { recursive: true });
const files = {
  "holo-bulk-ja.svg": fig1Svg({ lang: "ja" }),
  "holo-bulk-en.svg": fig1Svg({ lang: "en" }),
  "holo-bulk-bare.svg": fig1Svg({ lang: "en", bare: true }),
  "holo-blackhole-ja.svg": fig2Svg({ lang: "ja" }),
  "holo-blackhole-en.svg": fig2Svg({ lang: "en" }),
};
for (const [name, text] of Object.entries(files)) {
  writeFileSync(join(root, "src/figures", name), text);
  console.log(`wrote src/figures/${name} (${(text.length / 1024).toFixed(1)} KiB)`);
}
