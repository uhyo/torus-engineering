// Renders the two 1200x630 OGP images (src/og/torus.png, src/og/klein.png)
// from the generated SVG figures, using headless Chromium.
// Usage: CHROME=/path/to/chrome node scripts/gen-og.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontsDir = join(root, "scripts/og-fonts");
const outDir = join(root, "src/og");
mkdirSync(outDir, { recursive: true });

const chrome =
  process.env.CHROME ||
  ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
if (!chrome) {
  console.error("no chromium found; set CHROME=/path/to/chrome");
  process.exit(1);
}

const fontCss = `
  @font-face { font-family: "STIX Two Text"; src: url("file://${fontsDir}/stix-regular.ttf"); font-weight: 400; }
  @font-face { font-family: "STIX Two Text"; src: url("file://${fontsDir}/stix-semibold.ttf"); font-weight: 600; }
  @font-face { font-family: "STIX Two Text"; src: url("file://${fontsDir}/stix-italic.ttf"); font-weight: 400; font-style: italic; }
`;

function card({ figure, figureWidth, title, titleSize, catchline, sub }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fontCss}
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #fdfdfc; color: #111;
       font-family: "STIX Two Text", serif; overflow: hidden; }
.frame { position: absolute; inset: 22px; border: 1.5px solid #111; }
.inner { position: absolute; inset: 28px; display: flex; align-items: center; gap: 30px; padding: 0 40px; }
.fig { flex: 0 0 ${figureWidth}px; display: flex; justify-content: center; align-items: center; }
.fig svg { width: ${figureWidth}px; height: auto; }
.text { flex: 1; padding-right: 20px; }
h1 { font-size: ${titleSize}px; font-weight: 600; line-height: 1.1; letter-spacing: 0.5px; }
.rule { width: 120px; border-top: 2px solid #111; margin: 26px 0; }
.catch { font-size: 33px; font-style: italic; line-height: 1.35; }
.sub { font-size: 21px; color: #555; margin-top: 22px; line-height: 1.4; }
.wg { position: absolute; bottom: 44px; right: 62px; font-size: 17px; color: #666;
      font-variant: small-caps; letter-spacing: 1.5px; }
</style></head>
<body>
  <div class="frame"></div>
  <div class="inner">
    <div class="fig">${figure}</div>
    <div class="text">
      <h1>${title}</h1>
      <div class="rule"></div>
      <div class="catch">${catchline}</div>
      <div class="sub">${sub}</div>
    </div>
  </div>
  <div class="wg">The Torus Engineering Working Group</div>
</body></html>`;
}

const torusSvg = readFileSync(join(root, "src/figures/torus-bare.svg"), "utf8");
const kleinSvg = readFileSync(join(root, "src/figures/klein-bare.svg"), "utf8");

const jobs = [
  {
    out: "torus.png",
    html: card({
      figure: torusSvg,
      figureWidth: 560,
      title: "Torus Engineering",
      titleSize: 64,
      catchline: "&ldquo;Don&rsquo;t run the loop.<br>Wind it.&rdquo;",
      sub: "The 6th-generation paradigm of<br>AI-driven development. (Probably.)",
    }),
  },
  {
    out: "klein.png",
    html: card({
      figure: kleinSvg,
      figureWidth: 420,
      title: "Klein Bottle Engineering",
      titleSize: 56,
      catchline: "&ldquo;No inside. No outside.<br>No DevOps divide.&rdquo;",
      sub: "Appendix A: the ultimate form of DevOps.",
    }),
  },
];

for (const job of jobs) {
  const tmp = join(tmpdir(), `og-${job.out}.html`);
  writeFileSync(tmp, job.html);
  execFileSync(chrome, [
    "--no-sandbox",
    "--headless",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--screenshot=${join(outDir, job.out)}`,
    "--window-size=1200,630",
    `file://${tmp}`,
  ]);
  console.log("wrote", join("src/og", job.out));
}
