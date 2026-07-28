/**
 * Whole-system integration.
 *
 * Drives a deliberately awkward binding fixture through every feature of the
 * binder in one run, and folds every emitted command into an order-sensitive
 * hash. The expected command sequence is written out by hand from the fixture
 * and the key script, never derived from the binder, so agreement means the
 * implementation matches a human reading of the rules rather than matching
 * itself.
 *
 * Timing is randomised in two independent places: the gap between keypresses,
 * and how long the consumer takes to process each command. Neither may change
 * the output. The seed is printed so a failure can be reproduced.
 *
 * Two things cannot be predicted and are asserted differently:
 *   - A live <Esc><Esc> lands at a wall-clock dependent point, so it is checked
 *     as a strict prefix of the uninterrupted run.
 *   - Replaying a *recorded* interrupt is deterministic, so two replays of it
 *     must agree exactly.
 *
 * Run: npm test
 */

import { expect, test } from "vitest";
import { KeyBinder } from "../keybinder.ts";

// ---------------------------------------------------------------------------
// helpers

/** Order sensitive fold. Swapping any two commands changes the result. */
function hash(command: string, value: number): number {
  let h = value;
  for (const ch of command) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return h;
}

const hashAll = (commands: string[]) => commands.reduce((v, c) => hash(c, v), 0);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Seeded LCG, so a failing interleaving can be reproduced from the seed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return (max: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % (max + 1);
  };
}

// ---------------------------------------------------------------------------

test("every feature, hand-computed expected output, randomised timing", async () => {
  const seed = (Math.random() * 1e9) | 0;
  const rand = rng(seed);
  const log = console.log;
  console.log = () => {}; // silence the depth-limit notice

  try {
    const vlk = new KeyBinder(true);

    /**
     * <a> holds a command AND has a child, so <a> alone never fires until a
     * later code fails to extend it. <d><e><e><p> is deep. <w> warps the
     * cursor mid-tree. <i>/<Escape> move between modes.
     */
    vlk.bind("normal:<a>", "A", "");
    vlk.bind("normal:<a><b>", "AB", "");
    vlk.bind("normal:<d><e><e><p>", "DEEP", "");
    vlk.bind("normal:<w>", "warp", "");
    vlk.bind("normal:<x>", "X", "");
    vlk.bind("normal:<y>", "Y", "");
    vlk.bind("normal:<i>", "to-edit", "");
    vlk.bind("edit:<t>", "T", "");
    vlk.bind("edit:<Escape>", "to-normal", "");
    vlk.bind("global:<Ctrl-g>", "G", "");

    /** System handlers mutate binder state during the walk */
    vlk.bindSystemHandler("warp", function (this: KeyBinder) {
      this.state.position = this.modes["normal"].root.nodes["<d>"];
    });
    vlk.bindSystemHandler("to-edit", function (this: KeyBinder) {
      this.state.mode = "edit";
      this.state.position = this.modes["edit"].root;
    });
    vlk.bindSystemHandler("to-normal", function (this: KeyBinder) {
      this.state.mode = "normal";
      this.state.position = this.modes["normal"].root;
    });

    /** Recursive and mutually recursive registers, plus a long one to abort */
    vlk.macro.load({
      c: [{ command: "X" }, { command: "vlk-macro-replay", args: "c" }],
      d: [{ command: "Y" }, { command: "vlk-macro-replay", args: "e" }],
      e: [{ command: "X" }, { command: "vlk-macro-replay", args: "d" }],
      f: Array.from({ length: 30 }, () => ({ command: "X" })),
    });

    /** Consumer with randomised processing time. Backpressure paces to it. */
    const out: string[] = [];
    (async () => {
      for await (const event of vlk) {
        await sleep(rand(4));
        out.push(event.command);
      }
    })();

    const press = async (...codes: string[]) => {
      for (const code of codes) {
        await sleep(rand(3));
        vlk.keyPress(code);
      }
    };

    /** Quiet once nothing is queued, in flight, or arriving */
    const settle = async () => {
      let n = -1;
      while (n !== out.length || vlk.macro.busy || vlk.macro.buffer.length) {
        n = out.length;
        await sleep(40);
      }
    };

    const expected: string[] = [];

    // -- deep sequences, deferred actions, unbound keys, global precedence ---

    await press("<d>", "<e>", "<e>", "<p>");
    expected.push("DEEP");

    await press("<a>", "<b>"); // <a> defers, <b> reaches the leaf
    expected.push("AB");

    await press("<a>", "<x>"); // <x> cannot extend <a>, so A flushes first
    expected.push("A", "X");

    await press("<z>"); // bound nowhere; macro turns it into a state change
    expected.push("vlk-macro-state-change");

    await press("<z>"); // second in a run is suppressed
    await press("<Ctrl-g>"); // global claims it outright
    expected.push("G");

    await press("<Shift-H>"); // the default global binding
    expected.push("enumerate");

    await settle();

    // -- a system handler moving the cursor mid-tree -------------------------

    await press("<w>"); // handler parks the cursor on the <d> node
    expected.push("warp");
    await press("<e>", "<e>", "<p>"); // completes DEEP without pressing <d>
    expected.push("DEEP");

    await settle();

    // -- modes ---------------------------------------------------------------

    await press("<i>");
    expected.push("to-edit");
    await press("<t>");
    expected.push("T");
    await press("<x>"); // bound in normal, not in edit
    expected.push("vlk-macro-state-change");
    await press("<Escape>"); // global goes mid-sequence, edit still fires
    expected.push("to-normal");
    await press("<y>");
    expected.push("Y");

    await settle();

    // -- count register ------------------------------------------------------

    await press("<3>", "<x>");
    expected.push("vlk-macro-state-change", "X", "X", "X");

    await press("<1>", "<2>", "<y>");
    expected.push("vlk-macro-state-change", "vlk-macro-state-change");
    for (let i = 0; i < 12; i++) expected.push("Y");

    await press("<5>", "<z>"); // unbound key clears the pending count
    expected.push("vlk-macro-state-change", "vlk-macro-state-change");
    await press("<x>"); // proves the 5 was discarded
    expected.push("X");

    await settle();

    // -- record and replay ---------------------------------------------------

    await press("<q>", "<a>"); // record into a
    expected.push("vlk-macro-state-change");
    await press("<x>", "<y>");
    expected.push("X", "Y");
    await press("<q>"); // <q> was rebound to stop by a system handler
    expected.push("vlk-macro-state-change");
    await settle();
    expect(vlk.macro.registers["a"].map((e) => e.command)).toEqual(["X", "Y"]);

    await press("<Shift-@>", "<a>");
    expected.push("X", "Y");
    await settle();

    await press("<2>", "<Shift-@>", "<a>"); // count multiplies a replay
    expected.push("vlk-macro-state-change", "X", "Y", "X", "Y");
    await settle();

    await press("<Shift-@>", "<Shift-@>"); // vim's @@, replays the last register
    expected.push("X", "Y");
    await settle();

    // -- a macro that replays another ----------------------------------------

    await press("<q>", "<b>");
    expected.push("vlk-macro-state-change");
    await press("<Shift-@>", "<a>"); // recorded as a replay, not as X,Y
    expected.push("X", "Y");
    await settle();
    await press("<q>");
    expected.push("vlk-macro-state-change");
    await settle();
    expect(vlk.macro.registers["b"]).toEqual([{ command: "vlk-macro-replay", args: "a" }]);

    await press("<Shift-@>", "<b>"); // expands inline
    expected.push("X", "Y");
    await settle();

    // -- recursion and the depth limit ---------------------------------------

    await press("<Shift-@>", "<c>"); // self recursive, aborts past depth 4
    expected.push("X", "X", "X", "X");
    await settle();

    await press("<Shift-@>", "<d>"); // d -> e -> d -> e, same limit
    expected.push("Y", "X", "Y", "X");
    await settle();

    // -- everything above is deterministic; check it before timing games ------

    const deterministic = out.slice();
    expect(deterministic).toEqual(expected);
    expect(hashAll(deterministic)).toBe(hashAll(expected));

    // -- live interrupt: prefix only -----------------------------------------

    const beforeLive = out.length;
    await press("<Shift-@>", "<f>"); // 30 commands, consumer is slow
    await sleep(30);
    await press("<Escape>", "<Escape>");
    await settle();

    const live = out.slice(beforeLive);
    expect(live.length).toBeGreaterThan(0);
    expect(live.length).toBeLessThan(30);
    expect(live).toEqual(Array(live.length).fill("X"));

    // -- record an interrupt, then replay it twice: exact --------------------

    await press("<q>", "<g>");
    await settle();
    await press("<Shift-@>", "<f>");
    await sleep(30);
    await press("<Escape>", "<Escape>");
    await settle();
    await press("<q>");
    await settle();

    /** The recording front loads a scheduled interrupt for the same position */
    expect(vlk.macro.registers["g"][0].command).toBe("vlk-macro-interrupt-at");

    const runOne = out.length;
    await press("<Shift-@>", "<g>");
    await settle();
    const first = out.slice(runOne);

    const runTwo = out.length;
    await press("<Shift-@>", "<g>");
    await settle();
    const second = out.slice(runTwo);

    expect(first).toEqual(second);
    expect(hashAll(first)).toBe(hashAll(second));
    expect(first.length).toBeLessThan(30);
    expect(first).toEqual(Array(first.length).fill("X"));

    // -- return value drives preventDefault -----------------------------------

    expect(vlk.keyPress("<x>")).toBe(true);
    expect(vlk.keyPress("<Ctrl-Alt-nope>")).toBe(false);
  } finally {
    console.log = log;
  }
});
