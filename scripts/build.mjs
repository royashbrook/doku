import { build } from "vite";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, relative } from "node:path";

async function files(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, item.name);
    result.push(...(item.isDirectory() ? await files(path) : [path]));
  }
  return result.sort();
}
let source = "uncommitted",
  version = "development";
try {
  source = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const anchor = execFileSync(
    "git",
    [
      "describe",
      "--tags",
      "--first-parent",
      "--match",
      "v[0-9]*.[0-9]*",
      "--abbrev=0",
    ],
    { encoding: "utf8" },
  ).trim();
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(anchor))
    throw new Error("Invalid release anchor");
  if (
    execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      encoding: "utf8",
    }).trim() !== "false"
  )
    throw new Error("Full history required");
  const count = execFileSync(
    "git",
    ["rev-list", `${anchor}..HEAD`, "--count"],
    { encoding: "utf8" },
  ).trim();
  version = anchor.slice(1) + "." + count;
  if (
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
  ) {
    if (process.env.CI) throw new Error("Release tree is dirty");
    version += "-dev";
  }
} catch (error) {
  if (process.env.CI) throw error;
}
const inputs = [
  ...(await files("src")),
  ...(await files("public")),
  ...(await files("scripts")),
  ...[
    "index.html",
    "package-lock.json",
    "vite.config.ts",
    "svelte.config.js",
    "tsconfig.json",
    "tsconfig.worker.json",
    "LICENSE",
  ].map((file) => resolve(file)),
].sort();
const hash = createHash("sha256").update(version);
for (const path of inputs)
  hash.update(relative(process.cwd(), path)).update(await readFile(path));
const id = hash.digest("hex").slice(0, 12);
const define = {
  __BUILD_ID__: JSON.stringify(id),
  __APP_VERSION__: JSON.stringify(version),
  __SOURCE__: JSON.stringify(source),
};
await build({ define, logLevel: "warn" });
await writeFile(
  "dist/licenses.md",
  "# doku notices\n\n" +
    (await readFile("LICENSE", "utf8")) +
    "\n## original pet art\n\n" +
    (await readFile("public/art-notice.txt", "utf8")) +
    "\n## bundled dependencies\n\n" +
    (await readFile("dist/licenses.md", "utf8")),
);
const assets = (await files("dist"))
  .map((file) => "/" + relative(resolve("dist"), file))
  .filter((file) => file !== "/_headers")
  .map((file) => (file === "/index.html" ? "/" : file));
await build({
  configFile: false,
  publicDir: false,
  define: { ...define, __PRECACHE_ASSETS__: JSON.stringify(assets) },
  logLevel: "warn",
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/service-worker.ts",
      formats: ["iife"],
      name: "DokuWorker",
      fileName: () => "sw.js",
    },
    minify: true,
  },
});
await writeFile(
  "dist/version.json",
  JSON.stringify({ version, build: id, source }),
);
console.log(`Built doku ${version} / ${id}`);
