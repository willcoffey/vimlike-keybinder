/**
 * Performance smoke test — recursive macro expansion.
 *
 * Drives the macro engine's real recursion path (takeAction -> replayMacro ->
 * takeAction ...) with a self-recursive register: a long body followed by a
 * self-replay. Recursion is capped at depth 4, so a body of B commands emits
 * exactly 4*B commands.
 *
 * Sized to ~10ms of execution on this machine (B=56000 -> 224000 emitted).
 * Compute is isolated from transport: `macro.send` is replaced with a plain
 * counter, so this measures the engine, not the stream/consumer.
 *
 * The timing is logged, not hard-asserted (machine-dependent); the ceiling only
 * catches a gross (>20x) regression. The emitted COUNT is asserted exactly, so
 * this also guards the depth-limit contract.
 *
 * Run: npm test
 */

import { expect, test } from "vitest";
import { KeyBinder, VLKEvent } from "../keybinder.ts";

const B = 56000; // body length; emits 4*B commands at the depth-4 cap
const EXPECTED = 4 * B;
const CEILING_MS = 200; // ~20x the ~10ms target; only trips on a real regression

/** One run: returns [emitted count, elapsed ms]. */
async function run(): Promise<[number, number]> {
  const vlk = new KeyBinder(true);
  let emitted = 0;
  vlk.macro.send = (() => {
    emitted++;
  }) as (e: VLKEvent) => void;

  const body: VLKEvent[] = [];
  for (let i = 0; i < B; i++) body.push({ command: "move-right" });
  body.push({ command: "vlk-macro-replay", args: "r" });
  vlk.macro.load({ r: body });

  // Silence the engine's depth-limit console.log during the measured run.
  const log = console.log;
  console.log = () => {};
  const t0 = performance.now();
  await vlk.macro.replayMacro("r", 1);
  const dt = performance.now() - t0;
  console.log = log;

  return [emitted, dt];
}

test("recursive macro expands to 224k commands within the time budget", async () => {
  await run(); // warm up JIT
  const [emitted, dt] = await run();

  console.log(
    `perf: emitted ${emitted} commands in ${dt.toFixed(2)}ms ` +
      `(${(emitted / dt).toFixed(0)} cmd/ms)`,
  );

  if (emitted !== EXPECTED) {
    throw new Error(`expected ${EXPECTED} emissions, got ${emitted}`);
  }
  if (dt > CEILING_MS) {
    throw new Error(`perf regression: ${dt.toFixed(2)}ms > ${CEILING_MS}ms`);
  }
});
