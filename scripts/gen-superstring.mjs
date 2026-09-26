// Generates the figures for the Superstring Engineering page, in the same
// wireframe style as the other figures (black hairlines, grey dashed lines).
// Outputs:
//   src/figures/string-modes-ja.svg / -en.svg  Fig. 1: a single string with
//     its fixed ends, drawn in its first three vibration modes at once, each
//     mode labelled with a role. The string vibrates slowly, one mode at a
//     time, each at its own frequency (off under prefers-reduced-motion).
//   src/figures/string-modes-bare.svg          same, static and unlabelled,
//     for the OGP image
//   src/figures/string-branes-ja.svg / -en.svg  Fig. 2: open strings anchored
//     to two parallel D-branes, and a closed string floating free of both
//   src/figures/string-cy-ja.svg / -en.svg      Fig. 3: a real slice of the
//     Fermat quintic, the usual picture of a Calabi–Yau manifold
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const deg = (d) => (d * Math.PI) / 180;
const fmt = (n) => (Math.round(n * 10) / 10).toString();

function toPath(pts) {
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${fmt(pts[i][0])} ${fmt(pts[i][1])}`;
  return d;
}

// ---- Fig. 1: vibration modes -------------------------------------------
// The string runs from x = X0 to X1 along the baseline Y; mode n has shape
// A_n sin(n pi s). A standing wave is its shape scaled by cos(omega t), so
// the animation is a scaleY about the baseline, and mode n vibrates n times
// as fast as the fundamental.
const X0 = 110;
const X1 = 650;
const Y = 200;
const MODES = [
  { n: 1, amp: 118, width: 1.5, role: { ja: "coder", en: "coder" } },
  { n: 2, amp: 84, width: 1.2, role: { ja: "reviewer", en: "reviewer" } },
  { n: 3, amp: 56, width: 1.0, role: { ja: "planner", en: "planner" } },
];

function modePath(n, amp, sign = 1) {
  const pts = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    pts.push([X0 + (X1 - X0) * s, Y - sign * amp * Math.sin(n * Math.PI * s)]);
  }
  return toPath(pts);
}

// a fixed end: a short wall with hatching behind it
function wall(x, side) {
  const h = 46;
  const lines = [`M${x} ${Y - h}L${x} ${Y + h}`];
  for (let y = Y - h + 4; y <= Y + h; y += 9) lines.push(`M${x} ${y}L${x + side * 9} ${y - 9}`);
  return lines.join("");
}

function modesCss() {
  // each mode is shown for a third of the cycle, fading in and out
  const DUR = 18;
  let css = `
      .sm-still { transition: opacity 0.4s; opacity: 0.32; }`;
  MODES.forEach((m, i) => {
    const a = (100 * i) / MODES.length;
    const b = (100 * (i + 1)) / MODES.length;
    const f = 4;
    const kf =
      i === 0
        ? `0% { opacity: 0; } ${f}%, ${b - f}% { opacity: 1; } ${b}%, 100% { opacity: 0; }`
        : `0%, ${a}% { opacity: 0; } ${a + f}%, ${b - f}% { opacity: 1; } ${b}%, 100% { opacity: 0; }`;
    const period = 2.6 / m.n;
    css += `
      .sm-live${m.n} { animation: sm-on${m.n} ${DUR}s linear infinite; }
      .sm-live${m.n} path { transform-origin: 0 ${Y}px; animation: sm-osc ${(period / 2).toFixed(3)}s ease-in-out infinite alternate; }
      @keyframes sm-on${m.n} { ${kf} }`;
  });
  css += `
      @keyframes sm-osc { from { transform: scaleY(1); } to { transform: scaleY(-1); } }`;
  return `
    @media (prefers-reduced-motion: no-preference) {${css}
    }`;
}

function fig1Svg({ lang, bare }) {
  const still = MODES.map(
    (m) =>
      `<path class="sm-back" d="${modePath(m.n, m.amp, -1)}"/><path class="sm-front" style="stroke-width:${m.width}" d="${modePath(m.n, m.amp)}"/>`
  ).join("");
  const live = bare
    ? ""
    : MODES.map((m) => `<g class="sm-live sm-live${m.n}"><path d="${modePath(m.n, m.amp)}"/></g>`).join("");

  let labels = "";
  if (!bare) {
    // anchor each label on an antinode that the other modes leave clear
    const at = (m, s, sign) => [X0 + (X1 - X0) * s, Y - sign * m.amp * Math.sin(m.n * Math.PI * s)];
    const spots = [
      { m: MODES[0], s: 0.5, sign: 1, dx: 0, dy: -30, anchor: "middle" },
      { m: MODES[1], s: 0.75, sign: 1, dx: 58, dy: 50, anchor: "start" },
      { m: MODES[2], s: 0.5, sign: 1, dx: -84, dy: 64, anchor: "end" },
    ];
    labels = spots
      .map(({ m, s, sign, dx, dy, anchor }) => {
        const [px, py] = at(m, s, sign);
        const lx = px + dx;
        const ly = py + dy;
        const lead =
          dx === 0
            ? `M${fmt(px)} ${fmt(py - 6)}L${fmt(lx)} ${fmt(ly + 24)}`
            : `M${fmt(px + Math.sign(dx) * 4)} ${fmt(py + Math.sign(dy) * 4)}L${fmt(lx - Math.sign(dx) * 4)} ${fmt(ly - (dy > 0 ? 14 : -22))}`;
        return `
  <path class="sm-lead" d="${lead}"/>
  <text class="sm-label" x="${fmt(lx)}" y="${fmt(ly)}" text-anchor="${anchor}">${m.role[lang]}</text>
  <text class="sm-label-sub" x="${fmt(lx)}" y="${fmt(ly + 17)}" text-anchor="${anchor}">(n = ${m.n})</text>`;
      })
      .join("");
  }

  const alt = bare
    ? "A single string between two fixed ends, drawn in its first three vibration modes."
    : lang === "ja"
      ? "両端を壁に固定された一本の紐の線画。同じ紐が、腹が一つの基本振動、腹が二つの 2 倍振動、腹が三つの 3 倍振動の三つのモードで重ねて描かれ、逆位相の形が灰色の破線で添えられている。基本振動に「coder」、2 倍振動に「reviewer」、3 倍振動に「planner」と注記がある。紐はモードを切り替えながら、ゆっくり振動する。"
      : "A line drawing of a single string fixed at both ends to two walls. The same string is drawn in three modes at once — the fundamental with one antinode, the second harmonic with two and the third with three — each with its opposite phase as a grey dashed line. The fundamental is labelled “coder”, the second harmonic “reviewer” and the third “planner”. The string vibrates slowly, passing from one mode to the next.";
  const style = `
    .sm-base { fill: none; stroke: #b9b9b9; stroke-width: 0.8; stroke-dasharray: 3 4; }
    .sm-back { fill: none; stroke: #b9b9b9; stroke-width: 0.8; stroke-dasharray: 3 4; stroke-linecap: round; }
    .sm-front { fill: none; stroke: #1a1a1a; stroke-linecap: round; }
    .sm-wall { fill: none; stroke: #1a1a1a; stroke-width: 1; stroke-linecap: round; }
    .sm-end { fill: #1a1a1a; }
    .sm-live { opacity: 0; }
    .sm-live path { fill: none; stroke: #111111; stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .sm-lead { fill: none; stroke: #444; stroke-width: 0.9; }
    .sm-label { font-family: inherit; font-style: italic; font-size: 18px; fill: #333; }
    .sm-label-sub { font-family: inherit; font-style: italic; font-size: 13.5px; fill: #777; }${bare ? "" : modesCss()}`;

  const vx = bare ? X0 - 24 : 40;
  const vw = bare ? X1 - X0 + 48 : 680;
  const vy = bare ? Y - 132 : 30;
  const vh = bare ? 264 : 340;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="${alt}">
  <style>${style}
  </style>
  <path class="sm-base" d="M${X0} ${Y}L${X1} ${Y}"/>
  <path class="sm-wall" d="${wall(X0, -1)}${wall(X1, 1)}"/>
  <g class="sm-still">${still}</g>
  ${live}
  <circle class="sm-end" cx="${X0}" cy="${Y}" r="3.2"/><circle class="sm-end" cx="${X1}" cy="${Y}" r="3.2"/>${labels}
</svg>`;
}

// ---- Fig. 2: D-branes ---------------------------------------------------
// Two vertical plates x = -D and x = +D, seen in an oblique projection.
const D = 210;
const PY = 95; // half depth of a plate
const PZ = 130; // half height of a plate
const OX = 360;
const OY = 230;
const obl = ([x, y, z]) => [OX + x + 0.5 * y, OY - z + 0.3 * y];

function plate(sx) {
  const c = [
    [sx * D, -PY, -PZ],
    [sx * D, PY, -PZ],
    [sx * D, PY, PZ],
    [sx * D, -PY, PZ],
  ].map(obl);
  const outline = `${toPath(c)}Z`;
  const grid = [];
  for (let k = 1; k < 4; k++) {
    const y = -PY + (2 * PY * k) / 4;
    grid.push(toPath([obl([sx * D, y, -PZ]), obl([sx * D, y, PZ])]));
  }
  for (let k = 1; k < 5; k++) {
    const z = -PZ + (2 * PZ * k) / 5;
    grid.push(toPath([obl([sx * D, -PY, z]), obl([sx * D, PY, z])]));
  }
  return { outline, grid: grid.join("") };
}

function openString(a, b, n, amp, phase = 0) {
  const pts = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const w = amp * Math.sin(n * Math.PI * t + phase) * Math.sin(Math.PI * t);
    pts.push(obl([p[0], p[1], p[2] + w]));
  }
  return pts;
}

function fig2Svg({ lang }) {
  const L = plate(-1);
  const R = plate(1);
  const strings = [
    { a: [-D, -40, 70], b: [D, -10, 88], n: 2, amp: 16 },
    { a: [-D, 30, 5], b: [D, 50, -20], n: 3, amp: 13 },
    { a: [-D, -30, -80], b: [D, -60, -60], n: 1, amp: 20 },
  ].map((s) => ({ ...s, pts: openString(s.a, s.b, s.n, s.amp) }));
  const ends = strings.flatMap((s) => [s.pts[0], s.pts[s.pts.length - 1]]);

  // the closed string: a wobbly loop in a tilted plane, above the open ones
  const loop = [];
  const C = [0, 0, 178];
  for (let i = 0; i <= 160; i++) {
    const th = (2 * Math.PI * i) / 160;
    const r = 32 * (1 + 0.12 * Math.sin(3 * th + 0.6));
    const p = [C[0] + r * Math.cos(th), C[1] + 14 * Math.sin(th), C[2] + r * Math.sin(th) * 0.8];
    loop.push(obl(p));
  }

  const t =
    lang === "ja"
      ? {
          left: "D ブレーン",
          leftSub: "(ツール・MCP サーバー)",
          right: "D ブレーン",
          rightSub: "(人間)",
          open: "開いた紐",
          openSub: "(エージェント)",
          closed: "閉じた紐",
          closedSub: "(重力子)",
        }
      : {
          left: "D-brane",
          leftSub: "(tools, MCP servers)",
          right: "D-brane",
          rightSub: "(human)",
          open: "open string",
          openSub: "(agent)",
          closed: "closed string",
          closedSub: "(graviton)",
        };
  const italic = lang === "en" ? "font-style: italic;" : "";
  // plate labels: above the top edge of the left plate, below the bottom
  // edge of the right one
  const lTop = obl([-D, 0, PZ]);
  const rBottom = obl([D, 0, -PZ]);
  const lBottom = obl([-D, -PY, -PZ]);
  const openAt = strings[2].pts[58];
  const loopAt = loop[12];
  const alt =
    lang === "ja"
      ? "向かい合う二枚の平行な板（D ブレーン）の線画。左の板には「ツール・MCP サーバー」、右の板には「人間」と注記がある。三本の波打つ紐が、両端を左右の板に固定されて渡されている（開いた紐＝エージェント）。その上方に、どちらの板にも触れない輪の形の紐が一本浮いている（閉じた紐＝重力子）。"
      : "A line drawing of two parallel plates facing each other (D-branes); the left plate is labelled “tools, MCP servers” and the right “human”. Three wavy strings stretch between them, each with one end fixed to each plate (open strings, i.e. agents). Above them floats a single loop of string that touches neither plate (a closed string, the graviton).";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 8 680 440" role="img" aria-label="${alt}">
  <style>
    .sb-grid { fill: none; stroke: #b9b9b9; stroke-width: 0.8; stroke-dasharray: 3 4; }
    .sb-plate { fill: none; stroke: #1a1a1a; stroke-width: 1.2; stroke-linejoin: round; }
    .sb-str { fill: none; stroke: #1a1a1a; stroke-width: 1.5; stroke-linecap: round; }
    .sb-end { fill: #1a1a1a; }
    .sb-lead { fill: none; stroke: #444; stroke-width: 0.9; }
    .sb-label { font-family: inherit; ${italic} font-size: 18px; fill: #333; }
    .sb-label-sub { font-family: inherit; font-size: 14.5px; fill: #777; }
  </style>
  <path class="sb-grid" d="${L.grid}${R.grid}"/>
  <path class="sb-plate" d="${L.outline}${R.outline}"/>
  <path class="sb-str" d="${strings.map((s) => toPath(s.pts)).join("")}"/>
  <path class="sb-str" d="${toPath(loop)}Z"/>
  ${ends.map(([x, y]) => `<circle class="sb-end" cx="${fmt(x)}" cy="${fmt(y)}" r="3.4"/>`).join("")}
  <text class="sb-label" x="${fmt(lTop[0])}" y="${fmt(lTop[1] - 50)}" text-anchor="middle">${t.left}</text>
  <text class="sb-label-sub" x="${fmt(lTop[0])}" y="${fmt(lTop[1] - 33)}" text-anchor="middle">${t.leftSub}</text>
  <text class="sb-label" x="${fmt(rBottom[0])}" y="${fmt(rBottom[1] + 50)}" text-anchor="middle">${t.right}</text>
  <text class="sb-label-sub" x="${fmt(rBottom[0])}" y="${fmt(rBottom[1] + 67)}" text-anchor="middle">${t.rightSub}</text>
  <path class="sb-lead" d="M${fmt(openAt[0] + 2)} ${fmt(openAt[1] + 6)}L${fmt(openAt[0] + 24)} ${fmt(lBottom[1] + 8)}"/>
  <text class="sb-label" x="${fmt(openAt[0] + 30)}" y="${fmt(lBottom[1] + 18)}">${t.open}</text>
  <text class="sb-label-sub" x="${fmt(openAt[0] + 30)}" y="${fmt(lBottom[1] + 35)}">${t.openSub}</text>
  <path class="sb-lead" d="M${fmt(loopAt[0] + 5)} ${fmt(loopAt[1] - 3)}L${fmt(loopAt[0] + 48)} ${fmt(loopAt[1] - 16)}"/>
  <text class="sb-label" x="${fmt(loopAt[0] + 54)}" y="${fmt(loopAt[1] - 18)}">${t.closed}</text>
  <text class="sb-label-sub" x="${fmt(loopAt[0] + 54)}" y="${fmt(loopAt[1] - 1)}">${t.closedSub}</text>
</svg>`;
}

// ---- Fig. 3: a Calabi–Yau manifold -------------------------------------
// The real 4-dimensional slice of the Fermat quintic z1^5 + z2^5 = 1 in C^2,
// parametrized patch by patch as
//   z1 = e^{2 pi i k1/5} cos(t)^{2/5},  z2 = e^{2 pi i k2/5} sin(t)^{2/5},
// t = a + ib, and projected to 3-space as (Re z1, Re z2, Im z1 cos A + Im z2 sin A).
// Lines further from the viewer are drawn lighter (depth cueing) in place of
// hidden-line removal.
const QN = 5;
const cmul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
const cexp = (th) => [Math.cos(th), Math.sin(th)];
function cpow(z, e) {
  const r = Math.hypot(z[0], z[1]);
  if (r === 0) return [0, 0];
  const th = Math.atan2(z[1], z[0]);
  return [Math.pow(r, e) * Math.cos(th * e), Math.pow(r, e) * Math.sin(th * e)];
}
const ccos = (a, b) => [Math.cos(a) * Math.cosh(b), -Math.sin(a) * Math.sinh(b)];
const csin = (a, b) => [Math.sin(a) * Math.cosh(b), Math.cos(a) * Math.sinh(b)];

function cyPoint(k1, k2, a, b) {
  const z1 = cmul(cexp((2 * Math.PI * k1) / QN), cpow(ccos(a, b), 2 / QN));
  const z2 = cmul(cexp((2 * Math.PI * k2) / QN), cpow(csin(a, b), 2 / QN));
  const A = deg(45);
  return [z1[0], z2[0], z1[1] * Math.cos(A) + z2[1] * Math.sin(A)];
}

// view: rotate about z by YAW, then tilt by PITCH
const YAW = deg(28);
const PITCH = deg(24);
function cyView([x, y, z]) {
  const x1 = x * Math.cos(YAW) - y * Math.sin(YAW);
  const y1 = x * Math.sin(YAW) + y * Math.cos(YAW);
  const sy = y1 * Math.sin(PITCH) + z * Math.cos(PITCH);
  const depth = y1 * Math.cos(PITCH) - z * Math.sin(PITCH); // larger = further
  return { x: x1, y: -sy, depth };
}

function fig3Svg({ lang }) {
  const S = 150;
  const CX = 330;
  const CY = 215;
  const BMAX = 1.05;
  const NA = 6; // iso-lines of a per patch
  const NB = 6; // iso-lines of b per patch
  const NS = 24; // samples per iso-line
  const buckets = [[], [], [], []];
  let dmin = Infinity;
  let dmax = -Infinity;
  const curves = [];
  for (let k1 = 0; k1 < QN; k1++) {
    for (let k2 = 0; k2 < QN; k2++) {
      for (let i = 0; i <= NA; i++) {
        const a = (Math.PI / 2) * (i / NA);
        const pts = [];
        for (let j = 0; j <= NS; j++) pts.push(cyView(cyPoint(k1, k2, a, -BMAX + (2 * BMAX * j) / NS)));
        curves.push(pts);
      }
      for (let i = 0; i <= NB; i++) {
        const b = -BMAX + (2 * BMAX * i) / NB;
        const pts = [];
        for (let j = 0; j <= NS; j++) pts.push(cyView(cyPoint(k1, k2, (Math.PI / 2) * (j / NS), b)));
        curves.push(pts);
      }
    }
  }
  for (const c of curves) for (const p of c) (dmin = Math.min(dmin, p.depth)), (dmax = Math.max(dmax, p.depth));
  // split each curve into short runs, each run filed under its depth bucket
  const place = (p) => [CX + S * p.x, CY + S * p.y];
  for (const c of curves) {
    let run = [place(c[0])];
    let bk = null;
    for (let j = 1; j < c.length; j++) {
      const d = (c[j - 1].depth + c[j].depth) / 2;
      const k = Math.min(3, Math.floor((4 * (d - dmin)) / (dmax - dmin + 1e-9)));
      if (bk !== null && k !== bk) {
        buckets[bk].push(toPath(run));
        run = [run[run.length - 1]];
      }
      bk = k;
      run.push(place(c[j]));
    }
    if (run.length > 1) buckets[bk].push(toPath(run));
  }

  // label: leader from the rightmost part of the surface
  let right = null;
  for (const c of curves) for (const p of c) if (!right || p.x > right.x) right = p;
  const [rx, ry] = place(right);
  const lx = rx + 40;
  const ly = ry - 56;
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const c of curves)
    for (const p of c) {
      const [x, y] = place(p);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  const vb = [x0 - 12, y0 - 12, Math.max(x1, lx + 128) - x0 + 24, y1 - y0 + 24].map((v) => Math.round(v));
  const alt =
    lang === "ja"
      ? "複雑に折り重なった曲面の線画（カラビ＝ヤウ多様体の断面）。花弁状の曲面が中心から何重にも張り出し、互いに貫き合っている。手前の線は濃く、奥の線は淡く描かれている。曲面の一箇所に「CLAUDE.md」と注記がある。"
      : "A line drawing of an intricately folded surface (a cross-section of a Calabi–Yau manifold). Petal-like sheets reach out from the centre in many layers and pass through one another; nearer lines are drawn darker and farther ones lighter. One part of the surface is labelled “CLAUDE.md”.";
  const shades = ["#1a1a1a", "#555555", "#8c8c8c", "#b9b9b9"];
  const widths = [1, 0.9, 0.8, 0.7];
  const layers = [3, 2, 1, 0]
    .map((k) => `<path d="${buckets[k].join("")}" stroke="${shades[k]}" stroke-width="${widths[k]}"/>`)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" role="img" aria-label="${alt}">
  <style>
    .cy path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .cy-lead { fill: none; stroke: #444; stroke-width: 0.9; }
    .cy-label { font-family: "Courier New", Courier, monospace; font-size: 22px; fill: #333; }
  </style>
  <g class="cy">
  ${layers}
  </g>
  <path class="cy-lead" d="M${fmt(rx + 4)} ${fmt(ry - 4)}L${fmt(lx - 4)} ${fmt(ly + 6)}"/>
  <text class="cy-label" x="${fmt(lx)}" y="${fmt(ly)}">CLAUDE.md</text>
</svg>`;
}

// ---- write -------------------------------------------------------------
mkdirSync(join(root, "src/figures"), { recursive: true });
const files = {
  "string-modes-ja.svg": fig1Svg({ lang: "ja" }),
  "string-modes-en.svg": fig1Svg({ lang: "en" }),
  "string-modes-bare.svg": fig1Svg({ lang: "en", bare: true }),
  "string-branes-ja.svg": fig2Svg({ lang: "ja" }),
  "string-branes-en.svg": fig2Svg({ lang: "en" }),
  "string-cy-ja.svg": fig3Svg({ lang: "ja" }),
  "string-cy-en.svg": fig3Svg({ lang: "en" }),
};
for (const [name, text] of Object.entries(files)) {
  writeFileSync(join(root, "src/figures", name), text);
  console.log(`wrote src/figures/${name} (${(text.length / 1024).toFixed(1)} KiB)`);
}
