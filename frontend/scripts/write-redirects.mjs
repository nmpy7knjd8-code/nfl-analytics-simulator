// After `next build` (static export), write redirect pages so old links keep working:
//   /demo/...  → same path at the root (the app moved from /demo/ to /)
//   /quiz/     → /practice/      /decide/ → /fourth-down/
// and a 404 page that forwards any other /demo/* path. Static hosting: meta refresh + JS.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;
const BASE = "/nfl-analytics-simulator";

export const REDIRECTS = {
  "demo/": "",
  "demo/quiz/": "practice/",
  "demo/decide/": "fourth-down/",
  "demo/games/": "games/",
  "quiz/": "practice/",
  "decide/": "fourth-down/",
};

function page(to) {
  const url = `${BASE}/${to}`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Moved · Fourth &amp; Daily</title>
<meta name="robots" content="noindex"><link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${url}">
<script>location.replace(${JSON.stringify(url)} + location.search + location.hash);</script>
</head><body style="background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;padding:2rem">
<p>This page moved to <a style="color:#4c8dff" href="${url}">${url}</a>.</p></body></html>
`;
}

for (const [from, to] of Object.entries(REDIRECTS)) {
  const dir = join(OUT, from);
  if (existsSync(join(dir, "index.html")) && !from.startsWith("demo")) {
    throw new Error(`redirect would overwrite a real page: ${from}`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), page(to));
}

// 404: forward /demo/<anything> (e.g. /demo/games/2023_01_DET_KC/) to /<anything>.
const notFound = join(OUT, "404.html");
const forward = `<script>(function(){var b=${JSON.stringify(BASE + "/")},p=location.pathname;if(p.indexOf(b+"demo/")===0){location.replace(b+p.slice((b+"demo/").length)+location.search+location.hash);}})();</script>`;
const html = readFileSync(notFound, "utf8");
if (!html.includes("demo/")) writeFileSync(notFound, html.replace("<head>", `<head>${forward}`));
writeFileSync(join(OUT, ".nojekyll"), "");
console.log(`wrote ${Object.keys(REDIRECTS).length} redirect pages + 404 forwarder`);
