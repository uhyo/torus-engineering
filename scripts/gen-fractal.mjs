// Generates the Sierpinski-triangle fractal figures (same drawing style as the
// torus / Klein bottle: thin black lines on paper white).
// The hero figure is a single triangle presented as an "organizational chart",
// with an optional CSS animation that zooms slowly and endlessly into the
// lower-left subtree. Scaling by 2 about the lower-left vertex maps the
// lower-left subtriangle onto the whole, so the loop is seamless: the finest
// recursion level fades in during each cycle to replace the detail that the
// zoom pushes past the viewport. Strokes use vector-effect:non-scaling-stroke
// so line weight stays constant while zooming. prefers-reduced-motion is
// honored inside the SVG itself (and again globally in styles.css).
// Outputs:
//   src/figures/fractal-zoom-ja.svg / fractal-zoom-en.svg (alt text differs)
//   src/figures/fractal-bare.svg (static triangle, for the OGP image)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SQRT3 = Math.sqrt(3);

function fmt(n) {
  return (Math.round(n * 100) / 100).toString();
}

// Sierpinski triangle: upright outline + recursively inverted holes.
// apex = [x, y] of the top vertex, side = edge length, depth = hole levels.
// Returns { outline, holes: [{d, level}] } (level 1 = the central hole).
function sierpinski(apex, side, depth) {
  const h = (side * SQRT3) / 2;
  const [ax, ay] = apex;
  const B = [ax - side / 2, ay + h];
  const C = [ax + side / 2, ay + h];
  const outline = `M${fmt(ax)} ${fmt(ay)}L${fmt(B[0])} ${fmt(B[1])}L${fmt(C[0])} ${fmt(C[1])}Z`;
  const holes = [];
  function mid(p, q) {
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  }
  function recur(A, B, C, level) {
    if (level > depth) return;
    const ab = mid(A, B);
    const ac = mid(A, C);
    const bc = mid(B, C);
    holes.push({
      d: `M${fmt(ab[0])} ${fmt(ab[1])}L${fmt(ac[0])} ${fmt(ac[1])}L${fmt(bc[0])} ${fmt(bc[1])}Z`,
      level,
    });
    recur(A, ab, ac, level + 1);
    recur(ab, B, bc, level + 1);
    recur(ac, bc, C, level + 1);
  }
  recur([ax, ay], B, C, 1);
  return { outline, holes };
}

// ---- hero figure: the infinite zoom -------------------------------------
function zoomSvg(alt) {
  const W = 560;
  const SIDE = 520;
  const APEX = [W / 2, 14];
  const h = (SIDE * SQRT3) / 2;
  const baseY = APEX[1] + h;
  const H = Math.ceil(baseY + 14);
  const B = [APEX[0] - SIDE / 2, baseY]; // fixed point of the zoom
  const DEPTH = 6;

  const { outline, holes } = sierpinski(APEX, SIDE, DEPTH);
  const coarse = holes
    .filter((p) => p.level < DEPTH)
    .map((p) => `<path d="${p.d}"/>`)
    .join("\n        ");
  const fine = holes
    .filter((p) => p.level === DEPTH)
    .map((p) => `<path d="${p.d}"/>`)
    .join("\n          ");

  // exponential zoom: scale(t) = 2^t, approximated with quarter keyframes
  const k = (t) => fmt(Math.pow(2, t));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt}">
  <style>
    .fz path { stroke: #1a1a1a; fill: none; stroke-linejoin: round; stroke-linecap: round; }
    .fz .fz-outline { stroke-width: 1.15; }
    .fz-holes path { stroke-width: 0.95; vector-effect: non-scaling-stroke; }
    @media (prefers-reduced-motion: no-preference) {
      .fz-holes {
        transform-box: view-box;
        transform-origin: ${fmt(B[0])}px ${fmt(B[1])}px;
        animation: fz-zoom 48s linear infinite;
      }
      .fz-fine { animation: fz-fade 48s linear infinite; }
      @keyframes fz-zoom {
        0% { transform: scale(1); }
        25% { transform: scale(${k(0.25)}); }
        50% { transform: scale(${k(0.5)}); }
        75% { transform: scale(${k(0.75)}); }
        100% { transform: scale(2); }
      }
      @keyframes fz-fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    }
  </style>
  <defs>
    <clipPath id="fz-clip"><path d="${outline}"/></clipPath>
  </defs>
  <g class="fz">
    <path class="fz-outline" d="${outline}"/>
    <g clip-path="url(#fz-clip)">
      <g class="fz-holes">
        ${coarse}
        <g class="fz-fine">
          ${fine}
        </g>
      </g>
    </g>
  </g>
</svg>`;
}

// ---- bare figure: a static triangle, for the OGP image ------------------
// stroke width per recursion depth (0 = outer outline)
const WIDTHS = [1.15, 1.0, 0.85, 0.7, 0.58, 0.48];

function bareSvg(alt) {
  const BW = 520;
  const BH = 470;
  const side = 480;
  const apex = [BW / 2, 24];
  const { outline, holes } = sierpinski(apex, side, 5);
  const paths = [{ d: outline, level: 0 }, ...holes]
    .map((p) => `<path d="${p.d}" stroke-width="${fmt(WIDTHS[Math.min(p.level, WIDTHS.length - 1)])}"/>`)
    .join("\n      ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}" role="img" aria-label="${alt}">
  <style>
    .f-solid path { stroke: #1a1a1a; stroke-linecap: round; stroke-linejoin: round; }
  </style>
    <g class="f-solid" fill="none">
      ${paths}
    </g>
  </svg>`;
}

const ja = zoomSvg(
  "シェルピンスキーの三角形の線画。組織図として提示されており、ゆっくりと無限にズームしながら、常に同じ図に戻り続ける。"
);
const en = zoomSvg(
  "Line drawing of a Sierpinski triangle, presented as an organizational chart, zooming slowly and endlessly into itself."
);
const bare = bareSvg("Line drawing of a Sierpinski triangle.");

mkdirSync(join(root, "src/figures"), { recursive: true });
writeFileSync(join(root, "src/figures/fractal-zoom-ja.svg"), ja);
writeFileSync(join(root, "src/figures/fractal-zoom-en.svg"), en);
writeFileSync(join(root, "src/figures/fractal-bare.svg"), bare);
console.log("wrote fractal figures");
