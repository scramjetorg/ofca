# OFCA — Phase 0

OFCA (Ordered Flow with Concurrent Arrival) is a small standalone Node `>=22` ESM
library. It is authored in TypeScript (`src/index.ts`). The repository root is the
**development** package (private manifest, tests, tooling); `npm run build` assembles a
separate, self-contained **publishable** package under `dist/`. It has zero runtime
dependencies and does not depend on, subclass, or modify any Scramjet package.

## API

```js
import { DROP, compose, ofca, ofcaSync } from "ofca";

const syncMapper = compose((value) => value + 1, (value) => value * 2);
ofcaSync([1, 2], syncMapper); // [4, 6]

const output = [];
for await (const value of ofca([1, 2, 3], async (value) => (
  value === 2 ? DROP : value * 10
), { concurrency: 2 })) {
  output.push(value);
}
// [10, 30]
```

- `compose(...stages)` or `compose(stages)` runs ordered unary stages, returns a plain
  value while every stage is synchronous, and transitions after a thenable. It rejects
  empty/non-function chains and caps chains at 256 stages.
- `ofcaSync(source, ...stages)` accepts arrays and synchronous iterables only. Arrays
  use an indexed fast path. It rejects thenable results rather than introducing async
  behavior.
- `ofca(source, mapper, { concurrency })` returns an async iterable. It consumes arrays,
  synchronous iterables, async iterables, and Node Readables through standard async
  iteration. It is not a stream class. Dispatch is callback-first; promise mappers are
  adapted at the mapper boundary. Slots cover active work and reorder-buffer results,
  so output remains ordered within the concurrency bound.
- `DROP` omits an item. `undefined` is a normal emitted value.
- `callbackify(mapper)` exposes the small callback mapper adapter used by the async
  kernel for direct tests or integrations.

Errors stop new dispatch, active callback completions are handled without unhandled
rejections, and source iterators receive `return()` when the consumer exits early.
Cancellation and richer error policies are deliberately deferred.

## Development

The repository root is the **development** package. Its `package.json` stays `private`
and carries the toolchain (`typescript` for the build, `c8` for coverage), scripts, and a
self-referential `exports` map that points at `dist/` so tests and the consumer type test
resolve the built artifacts.

The build is staged in two steps so the publishable output is assembled, never emitted
directly:

1. `npm run build:ts` — `tsc` compiles `src/index.ts` into the ignored staging directory
   `.build/` (ESM `index.js` + generated `index.d.ts`; source maps are disabled because
   source is intentionally not shipped).
2. `npm run build:pkg` — `scripts/build-package.js` clears/recreates `dist/`, copies only
   `.build/index.js` and `.build/index.d.ts`, copies the root `README.md` and `LICENSE`,
   and writes a **sanitized** `dist/package.json`.

`npm run build` runs `clean` + `build:ts` + `build:pkg` in order.

```sh
npm install        # installs the dev toolchain: TypeScript (build) + c8 (coverage) + Biome (lint)
npm run build      # clean, compile to .build/, then assemble the publishable dist/
npm run build:ts   # TypeScript compile/stage only (-> .build/)
npm run build:pkg  # assemble dist/ from .build/ + docs + generated manifest
npm run clean      # remove .build/ and dist/
npm test           # build, then run the Node test files against dist/index.js
npm run typecheck  # build, then tsc --noEmit over src and the consumer signature test
npm run check      # Biome lint over the repo (non-writing; no build needed)
npm run test:bun   # build, then run the same test files under Bun
npm run coverage   # build, then c8 over the Node tests: line/branch/function + LCOV for dist
npm run verify     # build, run scripts/verify-package.js, then `npm pack --dry-run ./dist`
```

`typecheck`, `test`, `test:bun`, `coverage`, and `verify` all build first, so they work
from a clean checkout. The Node and Bun suites execute the emitted `dist/index.js` entry
(never the TypeScript source), while `test/signatures.test.ts` imports the package public
entry (`"ofca"`) so it is validated against the generated `dist/index.d.ts`. `npm run
check` is a non-writing Biome lint over the source and needs no build.

`test:bun` uses the same Node test files and requires a local Bun installation; it is a
non-blocking compatibility check because Bun's `node:test` support may differ from
Node's authoritative runner.

### Lint (`npm run check`)

`npm run check` runs `biome check .` — a **non-writing** lint over the TypeScript/JavaScript
sources (it never rewrites files). `biome.json` is deliberately minimal and **adapted to the
current code**: the Biome formatter and the import-organization assist are disabled so the
check does not demand broad reformatting or import churn of existing files, while the
recommended **linter** rules stay on. `vcs.useIgnoreFile` skips the ignored build/coverage
artifacts (`.build/`, `dist/`, `coverage/`, `node_modules/`), and `files.ignoreUnknown`
skips non-code files. Two intentional patterns are tolerated via per-file `overrides`
(the narrowly-justified non-null assertions in `src/index.ts`, and an explicit
`&&` guard in `scripts/verify-package.js`) rather than by editing the source.

### Coverage (`npm run coverage`)

`npm run coverage` builds `dist/`, then runs the Node stdlib test files under **c8**,
reporting **line / branch / function** metrics as text and writing an **LCOV** report to
the ignored `coverage/` directory. The report is scoped to the emitted `dist` JS
(`--include="dist/**/*.js"`), not the TypeScript source. These metrics **complement** the
intention-driven tests — they quantify how much of the shipped artifact the tests
exercise — and are **not a correctness proof**; no coverage threshold is enforced.

## Publishable package (`dist/`)

`dist/` is a standalone package directory with its own manifest. The generated
`dist/package.json` keeps only consumer-meaningful metadata copied from the development
manifest via an explicit allowlist (`name`, `version`, `description`, `keywords`,
`license`, `author`, `contributors`, `funding`, `homepage`, `bugs`, `repository`,
`engines`, `os`, `cpu`, `publishConfig` — as present) and adds local artifact entrypoints
(`type: module`, `main: ./index.js`, `types: ./index.d.ts`, `exports` with `types` then
`default`, and a tight `files` allowlist). Development-only fields (`private`,
`devDependencies`, `scripts`) and any source/test/staging paths are never included.

The deliverable contains exactly:

```
dist/
├── index.js        # compiled ESM entry
├── index.d.ts      # generated type declarations
├── package.json    # sanitized, self-contained manifest
├── README.md       # copied from the root
└── LICENSE         # MIT, copied from the root
```

`test/package.test.js` and `scripts/verify-package.js` assert this shape (sanitized
manifest fields plus the exact file set). To inspect what would be published:

```sh
npm run verify            # build + verify + `npm pack --dry-run ./dist`
npm pack --dry-run ./dist # just the dry-run, against an already-built dist/
```

Both list only `index.js`, `index.d.ts`, `package.json`, `README.md`, and `LICENSE` —
never source, tests, `node_modules`, a lockfile, maps, or the `.build/` staging directory.
