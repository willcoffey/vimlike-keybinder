/**
 * Concurrent global cursor.
 *
 * The global tree and the active mode tree are two independent cursors. A
 * partial global match advances the global cursor but still lets the code reach
 * the mode tree. A completed global action claims the code outright and the
 * mode walk is skipped, leaving the mode cursor untouched.
 *
 * We assert only on emitted commands (public behavior), never on internal
 * cursor fields, so these stay valid regardless of how the cursors are stored.
 *
 * Run: npm test
 */

import { expect, test } from "vitest";
import { KeyBinder } from "../keybinder.ts";

/** Build a binder that records raw tree emissions, bypassing the macro layer. */
function mk() {
  const vlk = new KeyBinder();
  const out: string[] = [];
  // Capture at the source: every command the tree walk emits lands here.
  vlk.takeAction = function (command: string) {
    out.push(command);
  } as typeof vlk.takeAction;
  return { vlk, out };
}

const noUnbound = (out: string[]) => out.filter((c) => c !== "vlk-unbound-key");

/** Compare as a multiset, for assertions that do not pin emission order. */
const sorted = (commands: string[]) => [...commands].sort();

// ---------------------------------------------------------------------------

test("single Esc reaches the mode tree even though global has <Esc><Esc>", () => {
  // The reported bug: global partial match on <Escape> must NOT block the mode
  // tree's own <Escape> binding.
  const { vlk, out } = mk();
  vlk.bind("global:<Escape><Escape>", "interrupt", "");
  vlk.bind("normal:<Escape>", "clear", "");

  vlk.keyPress("<Escape>");
  // Global is mid-branch (no emit); mode fires its leaf.
  expect(noUnbound(out), "first Esc should fire the mode command").toEqual(["clear"]);
});

test("second Esc fires the global leaf only, the mode walk is skipped", () => {
  const { vlk, out } = mk();
  vlk.bind("global:<Escape><Escape>", "interrupt", "");
  vlk.bind("normal:<Escape>", "clear", "");

  vlk.keyPress("<Escape>");
  vlk.keyPress("<Escape>");
  // First Esc: global only branches, so the mode leaf fires. Second Esc: global
  // completes and claims the code, so "clear" does NOT fire a second time.
  expect(noUnbound(out)).toEqual(["clear", "interrupt"]);
});

test("a claimed global action suppresses an overlapping mode binding", () => {
  const { vlk, out } = mk();
  vlk.bind("global:<Shift-H>", "help", "");
  vlk.bind("normal:<Shift-H>", "local-help", "");

  vlk.keyPress("<Shift-H>");
  // Consequence of precedence: a code bound to an action at the global root is
  // unreachable on every mode tree for as long as that global binding exists.
  expect(noUnbound(out)).toEqual(["help"]);
});

test("abandoned global partial does not swallow a following mode key", () => {
  const { vlk, out } = mk();
  vlk.bind("global:<Escape><Escape>", "interrupt", "");
  vlk.bind("normal:<a>", "a-cmd", "");

  vlk.keyPress("<Escape>"); // global partial; mode has no <Esc> -> nothing
  vlk.keyPress("<a>"); // global resets (no <Esc><a>); mode fires
  expect(noUnbound(out)).toEqual(["a-cmd"]);
});

test("global multi-key sequence still resolves when mode has no overlap", () => {
  const { vlk, out } = mk();
  vlk.bind("global:<Escape><Escape>", "interrupt", "");

  vlk.keyPress("<Escape>");
  vlk.keyPress("<Escape>");
  expect(noUnbound(out)).toEqual(["interrupt"]);
});

test("mode multi-key sequence still resolves when a global binding exists", () => {
  const { vlk, out } = mk();
  vlk.bind("global:<Shift-H>", "help", "");
  vlk.bind("normal:<g><g>", "move-home", "");

  vlk.keyPress("<g>");
  vlk.keyPress("<g>");
  expect(noUnbound(out)).toEqual(["move-home"]);
});

test("a global key does not disturb an in-progress mode sequence", () => {
  // normal:<g><g> is a two-key sequence and a single-key global fires in the
  // middle of it. Neither cursor resets the other, so the mode cursor keeps its
  // <g> progress and <g><Shift-H><g> still completes move-home.
  const { vlk, out } = mk();
  vlk.bind("global:<Shift-H>", "help", "");
  vlk.bind("normal:<g><g>", "move-home", "");

  vlk.keyPress("<g>");
  vlk.keyPress("<Shift-H>");
  vlk.keyPress("<g>");
  expect(sorted(noUnbound(out))).toEqual(sorted(["help", "move-home"]));
});

test("vlk-unbound-key fires only when NEITHER tree consumes the key", () => {
  // vlk-unbound-key drives the macro layer's count reset, so it must not fire
  // when a global (or mode) command did fire on the same key.
  const { vlk, out } = mk();
  vlk.bind("global:<Shift-H>", "help", "");
  vlk.bind("normal:<a>", "a-cmd", "");

  vlk.keyPress("<Shift-H>"); // global consumes -> not unbound
  vlk.keyPress("<a>"); // mode consumes -> not unbound
  vlk.keyPress("<z>"); // bound nowhere -> exactly one vlk-unbound-key
  expect(out).toEqual(["help", "a-cmd", "vlk-unbound-key"]);
});
