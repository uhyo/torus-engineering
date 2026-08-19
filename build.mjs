// Static site build: src/ -> dist/
// - inlines {{include:...}} fragments (SVG figures)
// - replaces {{ORIGIN}} / {{ORIGIN_ENC}} with the canonical site origin
//   (set in site.config.json, overridable via the SITE_ORIGIN env var)
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = join(root, "src");
const distDir = join(root, "dist");

const config = JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));
const origin = (process.env.SITE_ORIGIN || config.origin).replace(/\/+$/, "");
if (!/^https?:\/\//.test(origin)) {
  console.error(`invalid origin: ${origin}`);
  process.exit(1);
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

function processHtml(text) {
  text = text.replace(/\{\{include:([^}]+)\}\}/g, (_, p) => readFileSync(join(root, p.trim()), "utf8").trim());
  text = text.replaceAll("{{ORIGIN_ENC}}", encodeURIComponent(origin));
  text = text.replaceAll("{{ORIGIN}}", origin);
  return text;
}

let pages = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(srcDir, path);
    if (statSync(path).isDirectory()) {
      if (rel === "figures") continue; // inlined into pages; not shipped
      walk(path);
    } else {
      const out = join(distDir, rel);
      mkdirSync(dirname(out), { recursive: true });
      if (name.endsWith(".html")) {
        writeFileSync(out, processHtml(readFileSync(path, "utf8")));
        pages++;
      } else {
        cpSync(path, out);
      }
    }
  }
}
walk(srcDir);
console.log(`built ${pages} pages -> dist/ (origin: ${origin})`);
