/**
 * Count register (numeric prefix) repeats a command N times.
 *
 * Drives the full pipeline (KeyBinder -> Macro TransformStream -> downstream),
 * so an active reader must be pulling for the transform to run.
 *
 * Run: npm test
 */

import { expect, test } from "vitest";
import { KeyBinder, VLKEvent } from "../keybinder.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Binder with movement keys and a live downstream recorder. */
function harness() {
  const vlk = new KeyBinder(true); // default bindings give us the digit register
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

  const press = (...codes: string[]) => codes.forEach((c) => vlk.keyPress(c));
  return { vlk, out, press };
}

/** Wait until the downstream output has been quiet for `quiet` ms. */
async function settle(out: string[], quiet = 60) {
  let n = -1;
  while (n !== out.length) {
    n = out.length;
    await sleep(quiet);
  }
}

const moves = (out: string[]) => out.filter((c) => c.startsWith("move-"));

// ---------------------------------------------------------------------------

test("<3><l> repeats move-right three times", async () => {
  const { out, press } = harness();
  press("<3>", "<l>");
  await settle(out);
  expect(moves(out)).toEqual(["move-right", "move-right", "move-right"]);
});

test("multi-digit count <1><2><l> repeats twelve times", async () => {
  const { out, press } = harness();
  press("<1>", "<2>", "<l>");
  await settle(out);
  expect(moves(out).length).toEqual(12);
});

test("count applies only to the next command, then resets", async () => {
  const { out, press } = harness();
  press("<2>", "<l>", "<l>"); // 2x right, then a single right
  await settle(out);
  expect(moves(out)).toEqual(["move-right", "move-right", "move-right"]);
});

test("an unbound key clears a pending count via vlk-unbound-key", async () => {
  const { out, press } = harness();
  press("<3>"); // count = 3
  press("<z>"); // unbound -> vlk-unbound-key -> count reset
  press("<l>"); // should move exactly once
  await settle(out);
  expect(moves(out)).toEqual(["move-right"]);
});

test("small counts run without recursion trouble", async () => {
  const { out, press } = harness();
  press("<5>", "<l>");
  await settle(out);
  expect(moves(out).length).toEqual(5);
});

test("TARGET: a large repeat count does not overflow the stack", async () => {
  // Currently FAILS. The repeat loop in Macro.takeAction recurses synchronously
  // (`await this.takeAction(...)` with no intervening suspension in the non-
  // replay path), so a large count blows the call stack instead of emitting N
  // commands. The count is even clamped to 10000 in the macro layer, and 10000
  // is already enough to overflow. This should become an iterative loop.
  //
  // Driven at the macro layer and awaited directly so the failure surfaces as a
  // catchable rejection rather than an uncaught dangling-promise crash.
  const vlk = new KeyBinder(true);
  const sends: string[] = [];
  vlk.macro.send = (e: VLKEvent) => {
    sends.push(e.command);
  };
  vlk.macro.repeatCount = 10000;

  await vlk.macro.takeAction({ command: "move-right" });
  expect(sends.length, "expected 10000 emissions, no overflow").toEqual(10000);
});
