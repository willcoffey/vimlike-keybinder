/**
 * Determinism under random input timing.
 *
 * The same LOGICAL sequence of keypresses must produce the same downstream
 * command stream regardless of the wall-clock gaps between presses. This is the
 * key invariant of the replay-buffering design: input that lands mid-replay is
 * buffered and processed after, so ordering never depends on timing.
 *
 * The gaps are randomized across a range that straddles the replay step size
 * (~20ms), so some runs interleave input with an in-flight replay and some do
 * not. If any run diverges, buffering/ordering has a race.
 *
 * Run: npm test
 */

import { expect, test } from "vitest";
import { KeyBinder, RegisterState, VLKEvent } from "../keybinder.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function harness(registers: RegisterState) {
  const vlk = new KeyBinder(true);
  vlk.bindKeys("<l>", "move-right", "normal");
  vlk.bindKeys("<j>", "move-down", "normal");

  const out: string[] = [];
  const reader = vlk.stream.getReader();
  (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) out.push((value as VLKEvent).command);
    }
  })();

  vlk.macro.load(structuredClone(registers));
  return { vlk, out };
}

async function settle(out: string[], quiet = 60) {
  let n = -1;
  while (n !== out.length) {
    n = out.length;
    await sleep(quiet);
  }
}

/** Run the fixed logical sequence, sleeping `gap()` ms between each press. */
async function runSequence(gap: () => number): Promise<string[]> {
  const { vlk, out } = harness({
    a: [{ command: "move-right" }, { command: "move-down" }],
  });
  // Includes a count and a macro replay so buffering is exercised: the keys
  // after <Shift-@><a> may arrive while the replay is still stepping.
  const seq = ["<l>", "<3>", "<Shift-@>", "<a>", "<j>", "<l>", "<j>"];
  for (const code of seq) {
    vlk.keyPress(code);
    await sleep(gap());
  }
  await settle(out, 80);
  return out.filter((c) => c !== "vlk-macro-state-change");
}

// ---------------------------------------------------------------------------

test("output is identical across zero-delay, fixed, and random timings", async () => {
  const baseline = await runSequence(() => 0);

  // Sanity: the sequence really does what we think (3x replay of a in the mid).
  expect(baseline).toEqual([
    "move-right", // <l>
    "move-right", "move-down", // replay a  (x1)
    "move-right", "move-down", // replay a  (x2)
    "move-right", "move-down", // replay a  (x3)
    "move-down", // <j>
    "move-right", // <l>
    "move-down", // <j>
  ]);

  const gaps: Array<() => number> = [
    () => 5,
    () => 20,
    () => 25,
    () => 40,
    () => Math.floor(Math.random() * 30), // straddles the replay step
    () => Math.floor(Math.random() * 30),
    () => Math.floor(Math.random() * 30),
    () => Math.floor(Math.random() * 30),
  ];

  for (let i = 0; i < gaps.length; i++) {
    const result = await runSequence(gaps[i]);
    expect(result, `timing variant ${i} diverged`).toEqual(baseline);
  }
});

test("repeated identical runs are stable (no accumulated state leak)", async () => {
  const first = await runSequence(() => Math.floor(Math.random() * 25));
  for (let i = 0; i < 6; i++) {
    const again = await runSequence(() => Math.floor(Math.random() * 25));
    expect(again, `run ${i} diverged`).toEqual(first);
  }
});
