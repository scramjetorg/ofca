import {
  DROP,
  callbackify,
  compose,
  ofca,
  ofcaSync,
  type CallbackMapper,
} from "@scramjet/ofca";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Assert<Condition extends true> = Condition;

const sync = compose((value: number) => String(value), (value: string) => value.length);
const mixed = compose((value: number) => String(value), async (value: string) => `${value}!`);
const syncResult: number = sync(1);
const mixedResult: PromiseLike<string> = mixed(1);
const syncOutput: number[] = ofcaSync([1, 2], (value: number) => value * 2);
const droppedSyncOutput = ofcaSync(
  [1, 2],
  (value: number) => value === 1 ? DROP : value * 2,
);
const sequentialSyncOutput: number[] = ofcaSync(
  [1],
  (value: number) => String(value),
  (value: string) => value.length,
);
const sequentialArraySyncOutput: number[] = ofcaSync([1], [
  (value: number) => String(value),
  (value: string) => value.length,
]);
const threeStageSyncOutput: boolean[] = ofcaSync(
  [1],
  (value: number) => String(value),
  (value: string) => value.length,
  (value: number) => value > 0,
);
const longSyncOutput: unknown[] = ofcaSync(
  [1],
  (value: number) => String(value),
  (value: string) => value.length,
  (value: number) => value > 0,
  (value: boolean) => value ? 1 : 0,
);
const longArraySyncOutput: unknown[] = ofcaSync([1], [
  (value: number) => String(value),
  (value: string) => value.length,
  (value: number) => value > 0,
  (value: boolean) => value ? 1 : 0,
] as const);
const callback: CallbackMapper<number, number> = callbackify((value: number) => value + 1);
const asyncOutput: AsyncIterable<number | undefined> = ofca(
  [1, 2],
  async (value: number) => value === 1 ? DROP : value * 2,
  { concurrency: 2 },
);
async function* asyncSource() {
  yield 1;
}
const asyncSourceOutput: AsyncIterable<number | undefined> = ofca(asyncSource(), (value: number) => value);

// The broad fallback starts at four stages, so this one-stage async mapper is rejected.
// @ts-expect-error sync application rejects a promise-returning stage
ofcaSync([1], async (value: number) => value);
// @ts-expect-error sync application rejects a promise-returning array stage
ofcaSync([1], [
  async (value: number) => value,
] as const);
ofcaSync(
  [1],
  (value: number) => String(value),
  (value: string) => value.length,
  (value: number) => value > 0,
  // @ts-expect-error the broad fallback also rejects a promise-returning stage
  async (value: boolean) => value,
);
ofcaSync([1], [
  (value: number) => String(value),
  (value: string) => value.length,
  (value: number) => value > 0,
  // @ts-expect-error the broad array fallback rejects a promise-returning stage
  async (value: boolean) => value,
] as const);
// @ts-expect-error source must be iterable
ofcaSync(1, (value: number) => value);
// @ts-expect-error composition stages must be sequentially compatible
compose((value: number) => String(value), (value: boolean) => value);

type SyncIsPlain = Assert<Equal<typeof sync, (value: number) => number>>;
type MixedIsPromise = Assert<Equal<typeof mixed, (value: number) => Promise<string>>>;
type DroppedSyncOutputExcludesDrop = Assert<Equal<typeof droppedSyncOutput, number[]>>;

void syncResult;
void mixedResult;
void syncOutput;
void droppedSyncOutput;
void sequentialSyncOutput;
void sequentialArraySyncOutput;
void threeStageSyncOutput;
void longSyncOutput;
void longArraySyncOutput;
void callback;
void asyncOutput;
void asyncSourceOutput;
void (null as unknown as SyncIsPlain);
void (null as unknown as MixedIsPromise);
void (null as unknown as DroppedSyncOutputExcludesDrop);
