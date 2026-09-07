import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertPackage, EXPECTED_FILES, listDistFiles } from "../scripts/verify-package.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readDist = (name) => readFileSync(join(packageRoot, "dist", name), "utf8");
const readAt = (segments) => JSON.parse(readFileSync(join(packageRoot, ...segments), "utf8"));

test("dist deliverable is complete and sanitized (manifest + exact file set)", () => {
    // assertPackage() throws with a full report on any packaging invariant violation.
    assertPackage();
    assert.deepEqual(listDistFiles(), [...EXPECTED_FILES].sort());
});

test("dist manifest propagates allowlisted metadata from the development manifest", () => {
    const root = readAt(["package.json"]);
    const dist = readAt(["dist", "package.json"]);

    for (const field of ["name", "version", "description", "license", "author", "repository", "keywords", "engines"]) {
        assert.ok(field in root, `development manifest should declare "${field}"`);
        assert.deepEqual(dist[field], root[field], `"${field}" must be copied verbatim into the dist manifest`);
    }

    // The MIT license field matches the shipped LICENSE file.
    assert.equal(dist.license, "MIT");
    assert.match(readDist("LICENSE"), /^MIT License/);

    assert.ok(dist.files.includes("scramjet_sheep_vector.svg"));
    assert.match(readDist("scramjet_sheep_vector.svg"), /<svg\b/);
});

test("dist manifest strips development-only fields", () => {
    const root = readAt(["package.json"]);
    const dist = readAt(["dist", "package.json"]);

    // Sanity: the development manifest really does carry these, so stripping is meaningful.
    assert.equal(root.private, true);
    assert.ok(root.devDependencies && Object.keys(root.devDependencies).length > 0);
    assert.ok(root.scripts && Object.keys(root.scripts).length > 0);

    for (const field of ["private", "devDependencies", "scripts"]) {
        assert.ok(!(field in dist), `"${field}" must not appear in the dist manifest`);
    }
});

test("generated declarations and compiled entry are shipped at the dist root", () => {
    const declaration = readDist("index.d.ts");
    assert.match(declaration, /export declare const DROP: unique symbol;/);
    assert.match(declaration, /export declare const MAX_COMPOSITION_STAGES = 256;/);
    assert.match(declaration, /export declare function ofca</);
    assert.match(declaration, /export declare function ofcaSync</);
    assert.match(declaration, /export declare function compose</);
    assert.match(declaration, /export declare function callbackify</);

    const compiled = readDist("index.js");
    assert.match(compiled, /export const DROP = Symbol\("OFCA_DROP"\);/);
    assert.match(compiled, /export async function\* ofca\(/);

    // The shipped entry actually loads and exposes the runtime API.
    return import("../dist/index.js").then((module) => {
        for (const name of ["DROP", "MAX_COMPOSITION_STAGES", "compose", "ofca", "ofcaSync", "callbackify"]) {
            assert.ok(name in module, `dist/index.js must export "${name}"`);
        }
    });
});
