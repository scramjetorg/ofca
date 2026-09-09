import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { DROP, ofca } from "../dist/index.js";

const delay = (milliseconds, value) => new Promise((resolve) => setTimeout(resolve, milliseconds, value));

async function collect(iterable) {
    const output = [];
    for await (const value of iterable) output.push(value);
    return output;
}

test("ofca accepts array, sync iterable, async iterable, and Readable sources", async () => {
    function* syncSource() {
        yield 1;
        yield 2;
    }
    async function* asyncSource() {
        yield 1;
        yield 2;
    }
    const mapper = async (value) => value * 2;

    assert.deepEqual(await collect(ofca([1, 2], mapper)), [2, 4]);
    assert.deepEqual(await collect(ofca(syncSource(), mapper)), [2, 4]);
    assert.deepEqual(await collect(ofca(asyncSource(), mapper)), [2, 4]);
    assert.deepEqual(await collect(ofca(Readable.from([1, 2], { objectMode: true }), mapper)), [2, 4]);
});

test("ofca bounds concurrency and emits out-of-order completion in input order", async () => {
    let active = 0;
    let peak = 0;
    const output = await collect(ofca([0, 1, 2, 3], async (value) => {
        active++;
        peak = Math.max(peak, active);
        const result = await delay([30, 5, 20, 10][value], value * 10);
        active--;
        return result;
    }, { concurrency: 2 }));

    assert.deepEqual(output, [0, 10, 20, 30]);
    assert.equal(peak, 2);
});

test("ofca distinguishes DROP from undefined and stops dispatch after an error", async () => {
    assert.deepEqual(
        await collect(ofca([0, 1, 2], (value) => value === 1 ? DROP : undefined)),
        [undefined, undefined],
    );

    let started = 0;
    await assert.rejects(
        collect(ofca([0, 1, 2, 3], (value) => {
            started++;
            if (value === 1) throw new Error("mapper failure");
            return value;
        }, { concurrency: 2 })),
        /mapper failure/,
    );
    assert.ok(started <= 2);
});

test("ofca closes a source iterator when the consumer exits early", async () => {
    let closed = false;
    async function* source() {
        try {
            yield 1;
            yield 2;
        } finally {
            closed = true;
        }
    }

    const iterator = ofca(source(), async (value) => delay(1, value))[Symbol.asyncIterator]();
    assert.deepEqual(await iterator.next(), { done: false, value: 1 });
    await iterator.return();
    assert.equal(closed, true);
});

test("ofca emits a live result without waiting for the next source item", async () => {
    let release;
    const source = (async function* () {
        yield 1;
        await new Promise(resolve => { release = resolve; });
        yield 2;
    })();
    const iterator = ofca(source, value => value, {concurrency: 2})[Symbol.asyncIterator]();
    const first = await Promise.race([
        iterator.next(),
        delay(100).then(() => { throw new Error("first output was gated by the live source"); }),
    ]);
    assert.deepEqual(first, {done: false, value: 1});
    const second = iterator.next();
    await delay(1);
    release();
    assert.deepEqual(await second, {done: false, value: 2});
    assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test("ofca refills a rolling window while an earlier item is delayed", async () => {
    let release;
    const started = [];
    const output = collect(ofca([0, 1, 2], async value => {
        started.push(value);
        if (value === 0) await new Promise(resolve => { release = resolve; });
        return value;
    }, {concurrency: 2}));

    await delay(10);
    assert.deepEqual(started, [0, 1, 2]);
    release();
    assert.deepEqual(await output, [0, 1, 2]);
});

test("ofca keeps a stalled first source read bounded", async () => {
    let calls = 0;
    let release;
    const source = {
        [Symbol.asyncIterator]() { return this; },
        next() {
            calls++;
            if (calls === 1) return new Promise(resolve => { release = () => resolve({done: false, value: 1}); });
            return Promise.resolve({done: true, value: undefined});
        }
    };
    const iterator = ofca(source, value => value, {concurrency: 2})[Symbol.asyncIterator]();
    const first = iterator.next();
    await delay(10);
    assert.equal(calls, 1);
    release();
    assert.deepEqual(await first, {done: false, value: 1});
    assert.deepEqual(await iterator.next(), {done: true, value: undefined});
});

test("ofca cancellation closes a blocked input without dispatching late values", async () => {
    let calls = 0;
    let releaseFirst;
    let returnCalls = 0;
    const mapped = [];
    const source = {
        [Symbol.asyncIterator]() { return this; },
        next() {
            calls++;
            if (calls === 1) return Promise.resolve({done: false, value: 1});
            return new Promise(resolve => { releaseFirst = () => resolve({done: false, value: 2}); });
        },
        return() {
            returnCalls++;
            return Promise.resolve({done: true, value: undefined});
        }
    };
    const iterator = ofca(source, async value => {
        mapped.push(value);
        return value;
    }, {concurrency: 1})[Symbol.asyncIterator]();

    assert.deepEqual(await iterator.next(), {done: false, value: 1});
    const pending = iterator.next();
    await delay(1);
    const returned = await Promise.race([
        iterator.return(),
        delay(100).then(() => { throw new Error("consumer cancellation stalled"); })
    ]);
    assert.deepEqual(returned, {done: true, value: undefined});
    assert.deepEqual(await pending, {done: true, value: undefined});
    assert.equal(returnCalls, 1);
    releaseFirst();
    await delay(1);
    assert.deepEqual(mapped, [1]);
});
