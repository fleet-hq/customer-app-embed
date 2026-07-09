import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const distLib = join(root, "dist");
const outDir = join(root, "dist-vercel");
const versionDir = join(outDir, "v0");
const siteDir = join(root, "site");

if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(versionDir, { recursive: true });

console.log("[embed] building library…");
execSync("npx vite build", { cwd: root, stdio: "inherit" });

const libEntry = join(distLib, "embed.js");
if (!existsSync(libEntry)) {
  console.error("[embed] dist/embed.js not found after vite build");
  process.exit(1);
}
cpSync(libEntry, join(versionDir, "embed.js"));
const libMap = join(distLib, "embed.js.map");
if (existsSync(libMap)) cpSync(libMap, join(versionDir, "embed.js.map"));

console.log("[embed] copying site pages…");
for (const entry of readdirSync(siteDir)) {
  const from = join(siteDir, entry);
  if (!statSync(from).isFile()) continue;
  cpSync(from, join(outDir, entry));
}

console.log(`[embed] wrote ${outDir}`);
