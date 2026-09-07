import { Transform, Readable } from "node:stream";

import { ofca } from "../dist/index.js";

const ITEM_COUNT = 10_000;
const STAGE_COUNT = 16;
const OFCA_CONCURRENCY = 256;
const input = Array.from({ length: ITEM_COUNT }, (_, index) => index + 1);

async function stage(value, originalIndex, stageIndex) {
  const jitter = (originalIndex * 17 + stageIndex * 13) % 3;
  await new Promise((resolve) => setTimeout(resolve, jitter));
  if (originalIndex !== 0 && originalIndex % 500 === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return value + stageIndex + 1;
}

function expected(value) {
  return value + (STAGE_COUNT * (STAGE_COUNT + 1)) / 2;
}

function assertResults(name, results) {
  if (results.length !== ITEM_COUNT) {
    throw new Error(`${name}: expected ${ITEM_COUNT} results, got ${results.length}`);
  }
  for (let index = 0; index < results.length; index += 1) {
    if (results[index] !== expected(input[index])) {
      throw new Error(`${name}: incorrect result at index ${index}`);
    }
  }
}

async function measure(name, run) {
  const start = performance.now();
  const results = await run();
  const elapsed = performance.now() - start;
  assertResults(name, results);
  return { name, elapsed, throughput: ITEM_COUNT / (elapsed / 1000) };
}

async function arrayPromiseAll() {
  let values = input;
  for (let stageIndex = 0; stageIndex < STAGE_COUNT; stageIndex += 1) {
    values = await Promise.all(values.map((value, originalIndex) => (
      stage(value, originalIndex, stageIndex)
    )));
  }
  return values;
}

async function ofcaRun() {
  const results = [];
  for await (const result of ofca(input, async (value, originalIndex) => {
    let current = value;
    for (let stageIndex = 0; stageIndex < STAGE_COUNT; stageIndex += 1) {
      current = await stage(current, originalIndex, stageIndex);
    }
    return current;
  }, { concurrency: OFCA_CONCURRENCY })) {
    results.push(result);
  }
  return results;
}

function stageTransform(stageIndex, isFirst) {
  let nextIndex = 0;
  return new Transform({
    objectMode: true,
    async transform(item, _encoding, callback) {
      const originalIndex = isFirst ? nextIndex++ : item.index;
      const value = isFirst ? item : item.value;
      try {
        callback(null, {
          value: await stage(value, originalIndex, stageIndex),
          index: originalIndex,
        });
      } catch (error) {
        callback(error);
      }
    },
  });
}

async function transformRun() {
  const results = [];
  let stream = Readable.from(input, { objectMode: true });
  for (let stageIndex = 0; stageIndex < STAGE_COUNT; stageIndex += 1) {
    stream = stream.pipe(stageTransform(stageIndex, stageIndex === 0));
  }
  for await (const item of stream) results.push(item.value);
  return results;
}

const results = [
  await measure("Array.map x16 + Promise.all", arrayPromiseAll),
  await measure(`OFCA (concurrency ${OFCA_CONCURRENCY})`, ofcaRun),
  await measure("16 Node Transforms", transformRun),
];
const transformResult = results.at(-1);
if (!transformResult) throw new Error("Transform benchmark did not produce a result");
const transformElapsed = transformResult.elapsed;

console.log(`Configuration: Node ${process.version}, ${ITEM_COUNT.toLocaleString()} items, ${STAGE_COUNT} async stages, deterministic 0–2ms jitter plus a zero-delay await at each nonzero multiple of 500`);
console.log("Results are configuration-specific; ratios are relative to the 16-Transform chain.");
console.log("Method                         Elapsed (ms)   Items/s       Relative");
for (const result of results) {
  console.log(
    `${result.name.padEnd(30)} ${result.elapsed.toFixed(2).padStart(12)} ${result.throughput.toFixed(0).padStart(12)} ${(transformElapsed / result.elapsed).toFixed(2).padStart(11)}x`,
  );
}
