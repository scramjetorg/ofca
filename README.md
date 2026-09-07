# OFCA

![OFCA mascot](scramjet_sheep_vector.svg)

Ordered concurrent work for Node.js `>=22`.

## Why

Stream processing does not have to mean processing one item at a time. When each
item can be handled independently, waiting for one result before starting the next
leaves useful work idle.

## How

OFCA applies a work step to every input chunk with a bounded amount of concurrency,
then combines completed results in their original input order. It works with arrays,
sync and async iterables, and Node Readables through async iteration—without being a
stream class.

It sits between `Array.prototype.map` and Transform streams: it keeps map-like work
composition while accepting unbounded data from streams.

## What

OFCA (Ordered Flow with Concurrent Arrival) is a small standalone ESM library with
zero runtime dependencies. It provides:

- `ofca(source, mapper, { concurrency })` for ordered asynchronous processing;
- `ofcaSync(source, stages)` for synchronous iterable processing;
- `compose(...stages)` for ordered unary stage composition; and
- `DROP` for intentionally omitting an output.

```js
import { DROP, compose, ofca, ofcaSync } from "@scramjet/ofca";

const doubleThenAdd = compose((value) => value * 2, (value) => value + 1);
console.log(ofcaSync([1, 2], doubleThenAdd)); // [3, 5]

const output = [];
for await (const value of ofca([1, 2, 3], async (value) => (
  value === 2 ? DROP : value * 10
), { concurrency: 2 })) {
  output.push(value);
}
console.log(output); // [10, 30]
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for development instructions.

## Representative benchmark

Run `npm run benchmark` to measure the current checkout. Results are
configuration-specific (Node version, machine, workload, and concurrency) and are not
an intrinsic or universal speedup claim.

### What to expect

On Node `v22.22.1`, a 10,000-item workload with 16 async stages, small deterministic
jitter, and OFCA concurrency of 256 completed in:

| Method | Time | Throughput |
| --- | ---: | ---: |
| `Array.map` ×16 + `Promise.all` | 140ms | 71,267 items/s |
| OFCA | 971ms | 10,301 items/s |
| 16 chained Node Transforms | 14.4s | 696 items/s |

OFCA is slower than unbounded array admission, while processing stream-sized input
about 14.8× faster than the equivalent chained Transform pipeline in this run.
