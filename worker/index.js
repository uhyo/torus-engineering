// Cloudflare Worker: serves the static site and handles the root redirect.
// Every path that matches a file in dist/ is served directly from static
// assets without invoking this worker; only "/" (and unknown paths) get here.

function prefersJapanese(accept) {
  let ja = 0;
  let other = 0;
  for (const part of accept.split(",")) {
    const [tag, ...params] = part.trim().split(";");
    if (!tag) continue;
    let q = 1;
    for (const p of params) {
      const m = p.trim().match(/^q=([0-9.]+)$/i);
      if (m) q = parseFloat(m[1]) || 0;
    }
    if (/^ja(-|$)/i.test(tag.trim())) ja = Math.max(ja, q);
    else other = Math.max(other, q);
  }
  return ja > 0 && ja >= other;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const accept = request.headers.get("accept-language") || "";
      const target = prefersJapanese(accept) ? "/ja/" : "/en/";
      return new Response(null, {
        status: 302,
        headers: {
          location: target,
          vary: "accept-language",
          "cache-control": "no-store",
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
