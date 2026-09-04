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
