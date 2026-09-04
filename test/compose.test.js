import assert from "node:assert/strict";
import test from "node:test";

import { compose, MAX_COMPOSITION_STAGES } from "../dist/index.js";

test("compose preserves a plain sync return", () => {
    const result = compose((value) => value + 1, (value) => value * 3)(2);

    assert.equal(result, 9);
    assert.equal(typeof result?.then, "undefined");
});

test("compose accepts array, async, and mixed stages in order", async () => {
    const calls = [];
    const composed = compose([
        (value) => {
            calls.push("sync-first");
            return value + 1;
        },
        async (value) => {
            calls.push("async-middle");
            await Promise.resolve();
            return value * 3;
        },
        (value) => {
            calls.push("sync-last");
            return value - 2;
        },
    ]);

    assert.equal(await composed(2), 7);
    assert.deepEqual(calls, ["sync-first", "async-middle", "sync-last"]);
});

test("compose awaits an all-async chain", async () => {
    const composed = compose(
        async (value) => value + 1,
        async (value) => value * 3,
    );

    assert.equal(await composed(2), 9);
});

test("compose enforces its documented stage contract", () => {
    assert.throws(() => compose(), /at least one stage/);
    assert.throws(() => compose((value) => value, 1), /stages must be functions/);
    assert.throws(
        () => compose(...Array.from({ length: MAX_COMPOSITION_STAGES + 1 }, () => (value) => value)),
        /at most 256 stages/,
    );
    assert.equal(
        compose(...Array.from({ length: MAX_COMPOSITION_STAGES }, () => (value) => value + 1))(0),
        MAX_COMPOSITION_STAGES,
    );
});
