import assert from "node:assert/strict";
import test from "node:test";

import { DROP, ofcaSync } from "../dist/index.js";

test("ofcaSync uses array order and preserves undefined while dropping DROP", () => {
    const fastPathSource = [0, 1, 2];
    fastPathSource[Symbol.iterator] = () => {
        throw new Error("array iterator must not be used");
    };

    assert.deepEqual(ofcaSync(fastPathSource, (value) => value * 2), [0, 2, 4]);
    assert.deepEqual(
        ofcaSync([0, 1, 2], (value) => value === 1 ? DROP : undefined),
        [undefined, undefined],
    );
});

test("ofcaSync accepts synchronous iterables and rejects async behavior", () => {
    function* source() {
        yield 1;
        yield 2;
    }

    assert.deepEqual(ofcaSync(source(), (value) => value * 2), [2, 4]);
    assert.throws(
        () => ofcaSync([1], async (value) => value),
        /must not return a thenable/,
    );
    assert.throws(
        () => ofcaSync({ async *[Symbol.asyncIterator]() { yield 1; } }, (value) => value),
        /does not accept asynchronous iterables/,
    );
});
