/**
 * Verify the assembled `dist/` package is a complete, sanitized deliverable.
 *
 * This is the packaging integrity gate (analogous to a Transform Hub PrePack check):
 * it asserts the dist manifest carries only consumer-meaningful metadata plus local
 * artifact entrypoints, and that the shipped files are exactly the intended assets.
 * Importable by tests and runnable as a CLI (`npm run verify`).
 *
 * No runtime dependencies are used; only the Node standard library.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(packageRoot, "dist");

/** The complete, intended set of shipped files (relative to the dist package root). */
export const EXPECTED_FILES = [
  "index.js",
  "index.d.ts",
  "README.md",
  "LICENSE",
  "scramjet_sheep_vector.svg",
  "package.json",
];

/** Development-only manifest fields that must never reach the published package. */
export const FORBIDDEN_FIELDS = [
  "private",
  "devDependencies",
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "scripts",
];

/** Manifest keys that must be present and carry the local artifact entrypoints. */
const REQUIRED_ENTRYPOINTS = {
  type: "module",
  main: "./index.js",
  types: "./index.d.ts",
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Names of the files physically present in `dist/` (non-recursive, sorted). */
export function listDistFiles() {
  if (!existsSync(distDir)) return [];
  return readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Collect every packaging problem found in the current `dist/` directory.
 *
 * @returns {{ problems: string[], manifest: Record<string, unknown> }}
 */
export function verifyPackage() {
  const problems = [];

  if (!existsSync(distDir)) {
    return { problems: [`dist/ does not exist — run \`npm run build\` first`], manifest: {} };
  }

  let manifest;
  try {
    manifest = readJson(join(distDir, "package.json"));
  } catch (error) {
    return { problems: [`dist/package.json is unreadable: ${error.message}`], manifest: {} };
  }

  // 1. The deliverable contains exactly the intended assets (no maps, src, tests, staging).
  const present = listDistFiles();
  if (JSON.stringify(present) !== JSON.stringify([...EXPECTED_FILES].sort())) {
    problems.push(`dist contents must be exactly ${JSON.stringify(EXPECTED_FILES)}, got ${JSON.stringify(present)}`);
  }

  // 2. Development-only fields must be stripped.
  for (const field of FORBIDDEN_FIELDS) {
    if (field in manifest) problems.push(`unexpected field "${field}" leaked into the dist manifest`);
  }

  // 3. Local artifact entrypoints must resolve within the package root.
  for (const [field, expected] of Object.entries(REQUIRED_ENTRYPOINTS)) {
    if (manifest[field] !== expected) {
      problems.push(`${field} must be ${JSON.stringify(expected)}, got ${JSON.stringify(manifest[field])}`);
    }
  }

  const exportEntry = manifest.exports && manifest.exports["."];
  if (!exportEntry) {
    problems.push('exports["."] must be defined');
  } else {
    const keys = Object.keys(exportEntry);
    if (keys[0] !== "types" || keys.at(-1) !== "default") {
      problems.push(`exports["."] must order "types" before "default", got ${JSON.stringify(keys)}`);
    }
    if (exportEntry.types !== "./index.d.ts") problems.push('exports["."].types must be "./index.d.ts"');
    if (exportEntry.default !== "./index.js") problems.push('exports["."].default must be "./index.js"');
  }

  // 4. The `files` allowlist must name only the shipped artifacts and docs.
  const declared = Array.isArray(manifest.files) ? manifest.files : [];
  const expectedFiles = ["index.js", "index.d.ts", "README.md", "LICENSE", "scramjet_sheep_vector.svg"];
  if (JSON.stringify([...declared].sort()) !== JSON.stringify([...expectedFiles].sort())) {
    problems.push(`files allowlist must be ${JSON.stringify(expectedFiles)}, got ${JSON.stringify(declared)}`);
  }

  // 5. No source/staging/build paths anywhere in the manifest.
  const serialized = JSON.stringify(manifest);
  for (const needle of ["src/", ".build", "tsconfig", "node_modules", "../"]) {
    if (serialized.includes(needle)) problems.push(`dist manifest references forbidden path "${needle}"`);
  }

  return { problems, manifest };
}

/**
 * Assert the packaging invariants, throwing an Error that lists every problem found.
 */
export function assertPackage() {
  const { problems } = verifyPackage();
  if (problems.length > 0) {
    throw new Error(`Package verification failed:\n  - ${problems.join("\n  - ")}`);
  }
}

// CLI entry point for `npm run verify`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, manifest } = verifyPackage();
  if (problems.length > 0) {
    process.stderr.write(`Package verification failed:\n  - ${problems.join("\n  - ")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Package verification passed for ${String(manifest.name)}@${String(manifest.version)} ` +
      `(files: ${EXPECTED_FILES.join(", ")})\n`,
    );
  }
}
