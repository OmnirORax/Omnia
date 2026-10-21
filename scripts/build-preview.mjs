import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite-plus";

// Preview hosts throttle separate asset requests. Ship one HTML response with
// the same application, CSS, built-in font, icons and lazy modules embedded.
const directory = new URL("../dist-preview/", import.meta.url);
const result = await build({ build: {
  outDir: fileURLToPath(directory), assetsInlineLimit: Infinity, cssCodeSplit: false,
  rolldownOptions: { output: { codeSplitting: false } },
} });
const outputs = Array.isArray(result) ? result : [result];
const files = outputs.flatMap(output => output.output);
const chunks = files.filter(file => file.type === "chunk");
if (chunks.length !== 1 || !chunks[0].isEntry) throw new Error("Preview must contain one bundled application module.");
let html = await readFile(new URL("index.html", directory), "utf8");
const entry = chunks[0];
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (tag, src) =>
  src === `./${entry.fileName}` ? `<script type="module">${entry.code.replace(/<\/script/gi, "<\\/script")}</script>` : tag);
for (const file of files.filter(file => file.type === "asset" && file.fileName.endsWith(".css"))) {
  const css = await readFile(new URL(file.fileName, directory), "utf8");
  html = html.replace(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g, (tag, href) =>
    href === `./${file.fileName}` ? `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>` : tag);
}
const icon = await readFile(new URL("../public/favicon.svg", import.meta.url));
html = html.replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${icon.toString("base64")}"`);
if (/<script\b[^>]*\bsrc=|<link\b[^>]*rel="(?:stylesheet|modulepreload)"/.test(html))
  throw new Error("Preview still references external startup assets.");
await writeFile(new URL("index.html", directory), html);
console.log(`Self-contained preview: dist-preview/index.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
