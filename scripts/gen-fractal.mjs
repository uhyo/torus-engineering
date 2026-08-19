// Generates the Sierpinski-triangle fractal figure (same drawing style as the
// torus / Klein bottle: thin black lines on paper white).
// The labeled versions show the whole organization plus a magnified subagent
// that is identical to the whole (the joke draws itself).
// Outputs:
//   src/figures/fractal-ja.svg / fractal-en.svg (labels + alt text differ)
//   src/figures/fractal-bare.svg (single triangle, for the OGP image)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SQRT3 = Math.sqrt(3);

function fmt(n) {
  return (Math.round(n * 100) / 100).toString();
}

// stroke width per recursion depth (0 = outer outline)
const WIDTHS = [1.15, 1.0, 0.85, 0.7, 0.58, 0.48];

// Sierpinski triangle: upright outline + recursively inverted holes.
// apex = [x, y] of the top vertex, side = edge length, depth = hole levels.
// Returns an array of {d, w} path specs.
function sierpinski(apex, side, depth) {
  const paths = [];
  const h = (side * SQRT3) / 2;
  const [ax, ay] = apex;
  const B = [ax - side / 2, ay + h];
  const C = [ax + side / 2, ay + h];
  paths.push({
    d: `M${fmt(ax)} ${fmt(ay)}L${fmt(B[0])} ${fmt(B[1])}L${fmt(C[0])} ${fmt(C[1])}Z`,
    w: WIDTHS[0],
  });
  function mid(p, q) {
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  }
  function holes(A, B, C, level) {
    if (level > depth) return;
    const ab = mid(A, B);
    const ac = mid(A, C);
    const bc = mid(B, C);
    paths.push({
      d: `M${fmt(ab[0])} ${fmt(ab[1])}L${fmt(ac[0])} ${fmt(ac[1])}L${fmt(bc[0])} ${fmt(bc[1])}Z`,
      w: WIDTHS[Math.min(level, WIDTHS.length - 1)],
    });
    holes(A, ab, ac, level + 1);
    holes(ab, B, bc, level + 1);
    holes(ac, bc, C, level + 1);
  }
  holes([ax, ay], B, C, 1);
  return paths;
}

function pathsToSvg(paths) {
  return paths.map((p) => `<path d="${p.d}" stroke-width="${fmt(p.w)}"/>`).join("\n      ");
}

const style = `
  <style>
    .f-solid path { stroke: #1a1a1a; stroke-linecap: round; stroke-linejoin: round; }
    .f-zoom { stroke: #b9b9b9; stroke-width: 0.9; stroke-dasharray: 3 4; stroke-linecap: round; }
    .f-label text { font-family: inherit; font-style: italic; font-size: 16px; fill: #333; }
    .f-label .f-sub { font-size: 13px; fill: #777; font-style: normal; }
  </style>`;

// ---- labeled figure: whole + magnified subagent -------------------------
const W = 760;
const H = 500;
const DEPTH = 5;

// main triangle (the whole organization)
const MAIN_APEX = [230, 55];
const MAIN_SIDE = 400;
const mainH = (MAIN_SIDE * SQRT3) / 2; // 346.41
const mainBaseY = MAIN_APEX[1] + mainH; // 401.41

// source subtriangle: the depth-2 triangle in the bottom-right corner
const SUB_SIDE = MAIN_SIDE / 4; // 100
const subCorner = [MAIN_APEX[0] + MAIN_SIDE / 2, mainBaseY]; // [430, 401.41]
const subApex = [subCorner[0] - SUB_SIDE / 2, mainBaseY - (SUB_SIDE * SQRT3) / 2];
// circumscribed dashed circle around it
const srcC = [subApex[0], mainBaseY - SUB_SIDE / (2 * SQRT3) - ((SUB_SIDE * SQRT3) / 2 - SUB_SIDE / (2 * SQRT3)) / 1]; // centroid
const srcCenter = [subApex[0], (mainBaseY * 2 + subApex[1]) / 3];
const srcR = SUB_SIDE / SQRT3 + 6;

// inset: the magnified subagent — identical to the whole, of course
const INSET_APEX = [605, 135];
const INSET_SIDE = 240;
const insetH = (INSET_SIDE * SQRT3) / 2;
const insetBaseY = INSET_APEX[1] + insetH;
const insetCenter = [INSET_APEX[0], (insetBaseY * 2 + INSET_APEX[1]) / 3];
const insetR = INSET_SIDE / SQRT3 + 8;

// external tangent lines between the two dashed circles (the zoom cone)
function tangents([x1, y1], r1, [x2, y2], r2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  const theta = Math.atan2(dy, dx);
  const alpha = Math.acos((r1 - r2) / d);
  const lines = [];
  for (const s of [1, -1]) {
    const a = theta + s * alpha;
    lines.push([
      [x1 + r1 * Math.cos(a), y1 + r1 * Math.sin(a)],
      [x2 + r2 * Math.cos(a), y2 + r2 * Math.sin(a)],
    ]);
  }
  return lines;
}

function labeledSvg(labels) {
  const main = pathsToSvg(sierpinski(MAIN_APEX, MAIN_SIDE, DEPTH));
  const inset = pathsToSvg(sierpinski(INSET_APEX, INSET_SIDE, DEPTH));
  const cones = tangents(srcCenter, srcR, insetCenter, insetR)
    .map(([[x1, y1], [x2, y2]]) => `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`)
    .join("\n      ");
  const mainLabelY = mainBaseY + 62;
  const insetLabelY = insetCenter[1] + insetR + 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${labels.alt}">${style}
    <g class="f-solid" fill="none">
      ${main}
    </g>
    <g class="f-zoom" fill="none">
      <circle cx="${fmt(srcCenter[0])}" cy="${fmt(srcCenter[1])}" r="${fmt(srcR)}"/>
      <circle cx="${fmt(insetCenter[0])}" cy="${fmt(insetCenter[1])}" r="${fmt(insetR)}"/>
      ${cones}
    </g>
    <g class="f-solid" fill="none">
      ${inset}
    </g>
    <g class="f-label">
      <text x="${fmt(MAIN_APEX[0])}" y="${fmt(mainLabelY)}" text-anchor="middle">${labels.whole}</text>
      <text x="${fmt(MAIN_APEX[0])}" y="${fmt(mainLabelY + 19)}" text-anchor="middle" class="f-sub">${labels.wholeSub}</text>
      <text x="${fmt(insetCenter[0])}" y="${fmt(insetLabelY)}" text-anchor="middle">${labels.zoom}</text>
      <text x="${fmt(insetCenter[0])}" y="${fmt(insetLabelY + 19)}" text-anchor="middle" class="f-sub">${labels.zoomSub}</text>
    </g>
  </svg>`;
}

// ---- bare figure: a single triangle, for the OGP image ------------------
function bareSvg(alt) {
  const BW = 520;
  const BH = 470;
  const side = 480;
  const apex = [BW / 2, 24];
  const paths = pathsToSvg(sierpinski(apex, side, DEPTH));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}" role="img" aria-label="${alt}">${style}
    <g class="f-solid" fill="none">
      ${paths}
    </g>
  </svg>`;
}

const ja = labeledSvg({
  whole: "エージェント組織（全体）",
  wholeSub: "ハウスドルフ次元 log 3 / log 2",
  zoom: "サブエージェント（拡大図）",
  zoomSub: "全体と相似。以下、あらゆる深さで同様",
  alt: "シェルピンスキーの三角形の線画。右下の小さな部分を破線で囲み、拡大図として右側に示してあるが、拡大図は全体と完全に同じ形である。",
});
const en = labeledSvg({
  whole: "the agent organization (whole)",
  wholeSub: "Hausdorff dimension log 3 / log 2",
  zoom: "a subagent (magnified)",
  zoomSub: "similar to the whole; likewise at every depth",
  alt: "Line drawing of a Sierpinski triangle. A small region at the lower right is circled with a dashed line and shown magnified at the right; the magnified view is identical to the whole.",
});
const bare = bareSvg("Line drawing of a Sierpinski triangle.");

mkdirSync(join(root, "src/figures"), { recursive: true });
writeFileSync(join(root, "src/figures/fractal-ja.svg"), ja);
writeFileSync(join(root, "src/figures/fractal-en.svg"), en);
writeFileSync(join(root, "src/figures/fractal-bare.svg"), bare);
console.log("wrote fractal figures");
