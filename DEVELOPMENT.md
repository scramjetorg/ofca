# OFCA development

The repository root is the private development package. The package is Node.js
`>=22` ESM, authored in `src/index.ts`, and has no runtime dependencies.

## Commands

```sh
npm install        # install build, test, coverage, and lint tooling
npm run build      # clean, compile to .build/, and assemble dist/
npm test           # build, then run the Node test suite
npm run typecheck  # build, then check source and consumer signatures
npm run check      # non-writing Biome check
npm run verify     # build, package integrity checks, and npm pack --dry-run
npm run benchmark  # build, then run the dependency-free benchmark
npm run coverage   # build and produce c8 text/LCOV coverage
npm run test:bun   # optional Bun compatibility run
```

`typecheck`, `test`, `coverage`, `verify`, and `benchmark` build first, so they can
be run from a clean checkout. `npm run check` does not build or rewrite files.

## Build and package verification

The build is staged so source and development metadata do not enter the deliverable:

1. `build:ts` compiles `src/index.ts` to ignored `.build/index.js` and
   `.build/index.d.ts`.
2. `build:pkg` recreates `dist/`, copies the compiled entry and declarations plus
   `README.md` and `LICENSE`, and writes a sanitized manifest.

The resulting `dist/` directory contains exactly `index.js`, `index.d.ts`,
`package.json`, `README.md`, and `LICENSE`. Its manifest retains consumer metadata and
local artifact entrypoints, while omitting development-only fields such as `private`,
`devDependencies`, and `scripts`. `npm run verify` checks this shape and
`npm pack --dry-run ./dist` confirms the package file list without publishing.

## Benchmark methodology

`benchmark/ofca-vs-array-transform.js` uses only Node built-ins and the built `dist`
entry. It processes 10,000 numeric items through the same 16 chained async stages in
three equivalent ways:

- repeated `Array.map` + `Promise.all`, awaiting every stage for all values before
  starting the next stage;
- OFCA with an explicitly stated bounded concurrency, applying all 16 stages
  sequentially inside each item pipeline; and
- a 16-Transform object-mode chain joined with `pipe`, with one stage per Transform.

Each stage performs deterministic 0–2 ms timer jitter and a zero-delay await at each
nonzero multiple of 500, keyed to the original input index. Every run checks output
length, ordering, and every output value. Transform implementations await each stage
inside `_transform` and call the callback only after the promise resolves or rejects.
The table reports elapsed milliseconds, items per second, and a ratio relative to the
16-Transform chain. These are configuration-specific measurements, not a claim that
OFCA is universally faster.

For reproducible comparisons, use the same Node version and machine, run the command
after a successful build, and record the printed item count, concurrency, and results.
Timer scheduling, CPU load, operating-system behavior, and changes to the workload can
materially affect the numbers. The benchmark is illustrative rather than a performance
contract.

## Tests and contributions

Tests in `test/` execute the built `dist/index.js`; the TypeScript signature test also
checks the generated public declarations. Keep public API examples aligned with the
exports from `src/index.ts`, run the relevant checks above, and preserve the exact
package verification boundary when changing build or package metadata.
