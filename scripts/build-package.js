/**
 * Transform-Hub-style package builder for OFCA.
 *
 * Stages are separated: `tsc` emits compiled artifacts into the ignored `.build/`
 * directory, and this script assembles a self-contained, publishable package under
 * `dist/`. The dist manifest is regenerated from an explicit allowlist of the root
 * (development) manifest so that private flags, devDependencies, scripts, source
 * paths, and lockfiles never leak into the deliverable.
 *
 * No runtime dependencies are used; only the Node standard library.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stagingDir = join(packageRoot, ".build");
const distDir = join(packageRoot, "dist");

/** Compiled artifacts copied verbatim from staging into the dist package root. */
const ARTIFACTS = ["index.js", "index.d.ts"];

/** Root-manifest fields that are meaningful for consumers of the published package. */
const METADATA_ALLOWLIST = [
  "name",
  "version",
  "description",
  "keywords",
  "license",
  "author",
  "contributors",
  "funding",
  "homepage",
  "bugs",
  "repository",
  "engines",
  "os",
  "cpu",
  "publishConfig",
];

/** Files that make up the shipped package, used for the tight `files` allowlist. */
const PACKAGE_FILES = ["index.js", "index.d.ts", "README.md", "LICENSE"];

/** Human-readable documents shipped alongside the compiled artifacts. */
const DOCUMENTS = ["README.md", "LICENSE"];

function readRootManifest() {
  return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
}

/** Build the sanitized dist manifest from the allowlisted root metadata. */
export function buildDistManifest(root) {
  const manifest = {};
  for (const field of METADATA_ALLOWLIST) {
    if (Object.hasOwn(root, field)) manifest[field] = root[field];
  }

  // Local artifact entrypoints (relative to the dist package root).
  manifest.type = "module";
  manifest.main = "./index.js";
  manifest.types = "./index.d.ts";
  manifest.exports = {
    ".": {
      types: "./index.d.ts",
      default: "./index.js",
    },
  };
  manifest.files = PACKAGE_FILES;

  return manifest;
}

function requireFile(path, hint) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}${hint ? ` (${hint})` : ""}`);
  }
  return path;
}

function main() {
  // Clear and recreate the deliverable directory.
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  // Copy only the compiled artifacts (never maps, source, tests, or staging).
  for (const artifact of ARTIFACTS) {
    cpSync(requireFile(join(stagingDir, artifact), "run the TypeScript compile first"), join(distDir, artifact));
  }

  // Include the human-readable documents and the license.
  for (const document of DOCUMENTS) {
    cpSync(requireFile(join(packageRoot, document)), join(distDir, document));
  }

  // Generate the sanitized, self-contained package manifest.
  const manifest = buildDistManifest(readRootManifest());
  writeFileSync(join(distDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  process.stdout.write(
    `Built publishable package in dist/ (${[...ARTIFACTS, ...DOCUMENTS, "package.json"].join(", ")})\n`,
  );
}

// Run as a CLI, but stay importable for tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
