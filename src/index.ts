/** Ordered Flow with Concurrent Arrival (OFCA), Phase 0. */

export const DROP: unique symbol = Symbol("OFCA_DROP");
export const MAX_COMPOSITION_STAGES = 256;

export type Unary<Input, Output> = (value: Input) => Output;
export type UnknownStage = (value: never) => unknown;
export type ChainResult<Previous, Next> = Previous extends PromiseLike<unknown>
  ? PromiseLike<Awaited<Next>>
  : Next;

/** Applies the promise exclusion after TypeScript has inferred a concrete stage. */
type NonThenableStage<Stage extends UnknownStage> = ReturnType<Stage> extends PromiseLike<unknown>
  ? never
  : unknown;
type CheckedStages<Stages extends readonly UnknownStage[]> = {
  [Index in keyof Stages]: Stages[Index] extends UnknownStage
    ? Stages[Index] & NonThenableStage<Stages[Index]>
    : Stages[Index];
};

export type CallbackMapper<Input, Output> = (
  value: Input,
  index: number,
  done: (error?: unknown, value?: Output) => void,
) => void;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function";
}

/**
 * The composition kernel is intentionally heterogeneous: stages are supplied by
 * consumers and only validated to be functions at runtime. This single, contained
 * boundary treats a validated stage as a plain `unknown -> unknown` call so the
 * rest of the implementation stays free of `any`.
 */
function applyStage(stage: UnknownStage, value: unknown): unknown {
  return (stage as (value: unknown) => unknown)(value);
}

function stagesFrom(received: readonly unknown[]): UnknownStage[] {
  const stages: readonly unknown[] = received.length === 1 && Array.isArray(received[0])
    ? (received[0] as readonly unknown[])
    : received;

  if (stages.length === 0) throw new RangeError("compose requires at least one stage");
  if (stages.length > MAX_COMPOSITION_STAGES) {
    throw new RangeError(`compose supports at most ${MAX_COMPOSITION_STAGES} stages`);
  }
  if (!stages.every((stage) => typeof stage === "function")) {
    throw new TypeError("compose stages must be functions");
  }

  return stages as UnknownStage[];
}

function continueCompose(
  result: PromiseLike<unknown>,
  stages: readonly UnknownStage[],
  index: number,
): Promise<unknown> {
  return Promise.resolve(result).then(async (value) => {
    let current: unknown = value;
    for (let position = index; position < stages.length; position += 1) {
      current = await applyStage(stages[position], current);
    }
    return current;
  });
}

/**
 * Compose an ordered array or variadic list of unary stages. The sync path does
 * not allocate a Promise; later stages are awaited only after a thenable appears.
 */
export function compose<Input, Output>(stage: Unary<Input, Output>): Unary<Input, Output>;
export function compose<Input, Output>(stages: readonly [Unary<Input, Output>]): Unary<Input, Output>;
export function compose<Input, First, Output>(
  first: Unary<Input, First>,
  second: Unary<Awaited<First>, Output>,
): Unary<Input, ChainResult<First, Output>>;
export function compose<Input, First, Output>(
  stages: readonly [Unary<Input, First>, Unary<Awaited<First>, Output>],
): Unary<Input, ChainResult<First, Output>>;
export function compose<Input, First, Second, Output>(
  first: Unary<Input, First>,
  second: Unary<Awaited<First>, Second>,
  third: Unary<Awaited<Second>, Output>,
): Unary<Input, ChainResult<ChainResult<First, Second>, Output>>;
export function compose<Input, First, Second, Output>(
  stages: readonly [
    Unary<Input, First>,
    Unary<Awaited<First>, Second>,
    Unary<Awaited<Second>, Output>,
  ],
): Unary<Input, ChainResult<ChainResult<First, Second>, Output>>;
/** Four or more stages use this broad inference boundary. */
export function compose(...stages: [UnknownStage, UnknownStage, UnknownStage, UnknownStage, ...UnknownStage[]]): Unary<unknown, unknown | PromiseLike<unknown>>;
export function compose(stages: readonly UnknownStage[]): Unary<unknown, unknown | PromiseLike<unknown>>;
export function compose(...received: unknown[]): (value: unknown) => unknown {
  return composeStages(stagesFrom(received));
}

function composeStages(stages: readonly UnknownStage[]): (value: unknown) => unknown {
  return (value: unknown) => {
    let current = applyStage(stages[0], value);
    for (let index = 1; index < stages.length; index += 1) {
      if (isThenable(current)) return continueCompose(current, stages, index);
      current = applyStage(stages[index], current);
    }
    return current;
  };
}

function concurrencyOf(concurrency: number | undefined): number {
  const value = concurrency ?? 1;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("concurrency must be a positive safe integer");
  }
  return value;
}

/**
 * Apply synchronous stages to an array or synchronous iterable. Arrays use this
 * dedicated indexed loop; asynchronous sources and thenable outputs are rejected.
 */
export function ofcaSync<Input, Stage extends Unary<Input, unknown>>(
  source: Iterable<Input>,
  mapper: Stage & NonThenableStage<Stage>,
): Exclude<ReturnType<Stage>, typeof DROP>[];
export function ofcaSync<Input, Stage extends Unary<Input, unknown>>(
  source: Iterable<Input>,
  stages: readonly [Stage & NonThenableStage<Stage>],
): Exclude<ReturnType<Stage>, typeof DROP>[];
export function ofcaSync<
  Input,
  First extends Unary<Input, unknown>,
  Second extends Unary<ReturnType<First>, unknown>,
>(
  source: Iterable<Input>,
  first: First & NonThenableStage<First>,
  second: Second & NonThenableStage<Second>,
): Exclude<ReturnType<Second>, typeof DROP>[];
export function ofcaSync<
  Input,
  First extends Unary<Input, unknown>,
  Second extends Unary<ReturnType<First>, unknown>,
>(
  source: Iterable<Input>,
  stages: readonly [
    First & NonThenableStage<First>,
    Second & NonThenableStage<Second>,
  ],
): Exclude<ReturnType<Second>, typeof DROP>[];
export function ofcaSync<
  Input,
  First extends Unary<Input, unknown>,
  Second extends Unary<ReturnType<First>, unknown>,
  Third extends Unary<ReturnType<Second>, unknown>,
>(
  source: Iterable<Input>,
  first: First & NonThenableStage<First>,
  second: Second & NonThenableStage<Second>,
  third: Third & NonThenableStage<Third>,
): Exclude<ReturnType<Third>, typeof DROP>[];
export function ofcaSync<
  Input,
  First extends Unary<Input, unknown>,
  Second extends Unary<ReturnType<First>, unknown>,
  Third extends Unary<ReturnType<Second>, unknown>,
>(
  source: Iterable<Input>,
  stages: readonly [
    First & NonThenableStage<First>,
    Second & NonThenableStage<Second>,
    Third & NonThenableStage<Third>,
  ],
): Exclude<ReturnType<Third>, typeof DROP>[];
/** Four or more synchronous stages use this broad inference boundary. */
export function ofcaSync<
  Input,
  First extends Unary<Input, unknown>,
  Second extends UnknownStage,
  Third extends UnknownStage,
  Fourth extends UnknownStage,
  Rest extends readonly UnknownStage[],
>(
  source: Iterable<Input>,
  first: First & NonThenableStage<First>,
  second: Second & NonThenableStage<Second>,
  third: Third & NonThenableStage<Third>,
  fourth: Fourth & NonThenableStage<Fourth>,
  ...rest: Rest & CheckedStages<Rest>
): Exclude<unknown, typeof DROP>[];
/** Four or more synchronous stages use this broad inference boundary. */
export function ofcaSync<
  Input,
  First extends Unary<Input, unknown>,
  Second extends UnknownStage,
  Third extends UnknownStage,
  Fourth extends UnknownStage,
  Rest extends readonly UnknownStage[],
>(
  source: Iterable<Input>,
  stages: readonly [
    First & NonThenableStage<First>,
    Second & NonThenableStage<Second>,
    Third & NonThenableStage<Third>,
    Fourth & NonThenableStage<Fourth>,
    ...(Rest & CheckedStages<Rest>),
  ],
): Exclude<unknown, typeof DROP>[];
export function ofcaSync(source: unknown, ...received: unknown[]): unknown[] {
  if (source === null || typeof source === "undefined") {
    throw new TypeError("ofcaSync source must be an array or synchronous iterable");
  }
  const candidate = source as {
    [Symbol.asyncIterator]?: () => unknown;
    [Symbol.iterator]?: () => unknown;
  };
  if (typeof candidate[Symbol.asyncIterator] === "function") {
    throw new TypeError("ofcaSync does not accept asynchronous iterables or streams");
  }
  const mapper = composeStages(stagesFrom(received));
  const output: unknown[] = [];

  const apply = (value: unknown): void => {
    const result = mapper(value);
    if (isThenable(result)) {
      throw new TypeError("ofcaSync stages must not return a thenable");
    }
    if (result !== DROP) output.push(result);
  };

  if (Array.isArray(source)) {
    const items = source as readonly unknown[];
    for (let index = 0; index < items.length; index += 1) apply(items[index]);
    return output;
  }
  if (typeof candidate[Symbol.iterator] !== "function") {
    throw new TypeError("ofcaSync source must be an array or synchronous iterable");
  }
  for (const value of source as Iterable<unknown>) apply(value);
  return output;
}

/**
 * Adapt a value-or-promise mapper to the callback-first kernel. Promise handling
 * exists only at this entry boundary; task admission and release below are callback
 * driven.
 */
export function callbackify<Input, Output>(
  mapper: (value: Input, index: number) => Output | PromiseLike<Output>,
): CallbackMapper<Input, Output> {
  if (typeof mapper !== "function") throw new TypeError("mapper must be a function");

  return (value, index, done) => {
    let called = false;
    const finish = (error?: unknown, result?: Output): void => {
      if (called) return;
      called = true;
      done(error, result);
    };

    let result: Output | PromiseLike<Output>;
    try {
      result = mapper(value, index);
    } catch (error) {
      finish(error, undefined);
      return;
    }

    if (!isThenable(result)) {
      finish(undefined, result);
      return;
    }
    // `isThenable` narrows to `PromiseLike<unknown>`; the mapper's resolved value is
    // known to be `Output`, so this is the single boundary that re-types the promise.
    const pending = result as PromiseLike<Output>;
    try {
      pending.then(
        (resolved) => finish(undefined, resolved),
        (error) => finish(error, undefined),
      );
    } catch (error) {
      finish(error, undefined);
    }
  };
}

function iteratorFrom<Input>(
  source: Iterable<Input> | AsyncIterable<Input> | null | undefined,
): Iterator<Input> | AsyncIterator<Input> {
  if (source === null || typeof source === "undefined") {
    throw new TypeError("ofca source must be iterable or async iterable");
  }
  const candidate = source as {
    [Symbol.asyncIterator]?: () => AsyncIterator<Input>;
    [Symbol.iterator]?: () => Iterator<Input>;
  };
  if (typeof candidate[Symbol.asyncIterator] === "function") return candidate[Symbol.asyncIterator]!();
  if (typeof candidate[Symbol.iterator] === "function") return candidate[Symbol.iterator]!();
  throw new TypeError("ofca source must be iterable or async iterable");
}

/**
 * Process any standard iterable, async iterable, or Node Readable (through its
 * standard async iterator) with bounded callback-first dispatch and ordered output.
 * Each leased slot includes either an active task or a reorder-buffer entry.
 */
export async function* ofca<Input, Output>(
  source: Iterable<Input> | AsyncIterable<Input>,
  mapper: (value: Input, index: number) => Output | PromiseLike<Output> | typeof DROP,
  options: { concurrency?: number } = {},
): AsyncIterable<Exclude<Output, typeof DROP> | undefined> {
  const concurrency = concurrencyOf(options.concurrency);
  const iterator = iteratorFrom<Input>(source);
  const invoke = callbackify<Input, Output | typeof DROP>(mapper);
  const completed = new Map<number, Output | typeof DROP | undefined>();
  let active = 0;
  let dispatched = 0;
  let nextOutput = 0;
  let sourceDone = false;
  let fatalError: unknown;
  let notification = false;
  let wake: (() => void) | undefined;

  const notify = (): void => {
    if (wake) {
      const resolve = wake;
      wake = undefined;
      resolve();
    } else {
      notification = true;
    }
  };

  const waitForCompletion = (): Promise<void> => {
    if (notification) {
      notification = false;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      wake = () => resolve();
    });
  };

  const dispatch = (value: Input, index: number): void => {
    active += 1;
    invoke(value, index, (error, result) => {
      active -= 1;
      if (typeof error !== "undefined" && typeof fatalError === "undefined") fatalError = error;
      completed.set(index, result);
      notify();
    });
  };

  const fill = async (): Promise<void> => {
    while (!sourceDone && typeof fatalError === "undefined" && active + completed.size < concurrency) {
      const next = await iterator.next();
      if (next.done) {
        sourceDone = true;
        return;
      }
      dispatch(next.value, dispatched++);
    }
  };

  try {
    await fill();
    while (active > 0 || completed.size > 0 || !sourceDone) {
      if (typeof fatalError !== "undefined") throw fatalError;

      while (completed.has(nextOutput)) {
        const value = completed.get(nextOutput);
        completed.delete(nextOutput);
        nextOutput += 1;
        if (value !== DROP) yield value as Exclude<Output, typeof DROP> | undefined;
      }

      await fill();
      if (typeof fatalError !== "undefined") throw fatalError;
      if (active === 0 && sourceDone) break;
      if (!completed.has(nextOutput)) await waitForCompletion();
    }
  } finally {
    const close = iterator.return;
    if (typeof close === "function") {
      await (close as () => unknown).call(iterator);
    }
  }
}
