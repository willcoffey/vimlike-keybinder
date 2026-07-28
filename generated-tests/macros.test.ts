/**
 * Macro record / replay — including nested, recursive, mutual recursion, depth
 * limiting, count x replay, and live interrupt.
 *
 * Two paths are exercised:
 *   - RECORDING via keypresses  -> asserts register CONTENTS.
 *   - REPLAY of loaded registers -> asserts emitted output. Loading with
 *     macro.load() gives clean, well-defined register content (the way the demo
 *     app seeds macros) and avoids the messy record-while-replaying path.
 *
 * Run: npm test
 */

import { expect, test } from "vitest";
import { KeyBinder, RegisterState, VLKEvent } from "../keybinder.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `perCommand` makes the consumer deliberately slow. Because the macro layer
 * waits on the consumer before sending the next command, a non-zero value paces
 * the whole replay to it, which is what gives a keypress a chance to land while
 * a replay is still running.
 */
function harness(registers?: RegisterState, perCommand = 0) {
  const vlk = new KeyBinder(true);
  vlk.bindKeys("<l>", "move-right", "normal");
  vlk.bindKeys("<j>", "move-down", "normal");
  vlk.bindKeys("<k>", "move-up", "normal");

  const out: string[] = [];
  const reader = vlk.stream.getReader();
  (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) out.push((value as VLKEvent).command);
      if (perCommand) await sleep(perCommand);
    }
  })();

  if (registers) vlk.macro.load(structuredClone(registers));
  const press = (...codes: string[]) => codes.forEach((c) => vlk.keyPress(c));
  return { vlk, out, press };
}

async function settle(out: string[], quiet = 60) {
  let n = -1;
  while (n !== out.length) {
    n = out.length;
    await sleep(quiet);
  }
}

const moves = (out: string[]) => out.filter((c) => c.startsWith("move-"));

// ---- recording path -------------------------------------------------------

test("recording <q><a> ... <q> captures the pressed commands in register a", async () => {
  const { vlk, out, press } = harness();
  press("<q>", "<a>"); // start recording into register a
  press("<l>", "<j>"); // recorded body
  press("<q>"); // stop
  await settle(out);

  expect(vlk.macro.registers["a"]).toEqual([
    { command: "move-right", args: undefined },
    { command: "move-down", args: undefined },
  ]);
  // The body still passes through live while recording.
  expect(moves(out)).toEqual(["move-right", "move-down"]);
});

test("recording does not include the trailing stop key", async () => {
  const { vlk, out, press } = harness();
  press("<q>", "<b>", "<l>", "<q>");
  await settle(out);
  expect(vlk.macro.registers["b"].length).toEqual(1);
});

// ---- replay of loaded registers ------------------------------------------

test("replaying a register emits its commands in order", async () => {
  const { out, press } = harness({
    a: [{ command: "move-right" }, { command: "move-down" }],
  });
  press("<Shift-@>", "<a>");
  await settle(out);
  expect(moves(out)).toEqual(["move-right", "move-down"]);
});

test("nested replay: a register that replays another expands inline", async () => {
  const { out, press } = harness({
    a: [{ command: "move-right" }],
    b: [
      { command: "move-down" },
      { command: "vlk-macro-replay", args: "a" },
      { command: "move-down" },
    ],
  });
  press("<Shift-@>", "<b>");
  await settle(out);
  expect(moves(out)).toEqual(["move-down", "move-right", "move-down"]);
});

test("self-recursive macro terminates at the depth limit", async () => {
  // r replays itself forever; the depth guard (>4) stops it. The exact count is
  // deterministic: one emission per depth 1..4.
  const { out, press } = harness({
    r: [{ command: "move-right" }, { command: "vlk-macro-replay", args: "r" }],
  });
  press("<Shift-@>", "<r>");
  await settle(out, 80);
  expect(moves(out)).toEqual(["move-right", "move-right", "move-right", "move-right"]);
});

test("mutual recursion a<->b terminates deterministically", async () => {
  const { out, press } = harness({
    a: [{ command: "move-right" }, { command: "vlk-macro-replay", args: "b" }],
    b: [{ command: "move-down" }, { command: "vlk-macro-replay", args: "a" }],
  });
  press("<Shift-@>", "<a>");
  await settle(out, 80);
  expect(moves(out)).toEqual(["move-right", "move-down", "move-right", "move-down"]);
});

test("count x replay: <3><Shift-@><a> runs the macro three times", async () => {
  const { out, press } = harness({
    a: [{ command: "move-right" }, { command: "move-down" }],
  });
  press("<3>", "<Shift-@>", "<a>");
  await settle(out, 80);
  expect(moves(out)).toEqual([
    "move-right", "move-down",
    "move-right", "move-down",
    "move-right", "move-down",
  ]);
});

test("live interrupt (<Esc><Esc>) aborts a replay paced by a slow consumer", async () => {
  // A 30 command replay against a consumer taking 5ms each runs for ~150ms, so
  // the Escape lands while the producer is still waiting on the consumer. With
  // a fast consumer the whole replay would drain on the microtask queue before
  // any keypress could be seen, and there would be nothing left to interrupt.
  const body: VLKEvent[] = [];
  for (let i = 0; i < 30; i++) body.push({ command: "move-right" });
  const { out, press } = harness({ a: body }, 5);

  press("<Shift-@>", "<a>");
  await sleep(70);
  press("<Escape>", "<Escape>");
  await settle(out, 80);

  const n = moves(out).length;
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(30);
});
