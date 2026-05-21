## Global tree shadows mode bindings

Current behavior: `keyPress` tries global tree first; if it branches, returns
immediately without consulting the current mode. Mode-specific bindings on
keys used by global sequences are unreachable.

Repro: global `<Escape><Escape>` + mode `<Escape>` leaf → mode binding never fires.

Expected: walk both trees in parallel; mode wins over global on conflict.

Design decisions needed:
- Exact mode leaf fires immediately, even if global has a longer sequence using same prefix?
- State shape needs parallel positions (mode + global) instead of single `position` + `onGlobalTree` flag.
- Behavior on mode-branch + global-leaf at same depth.

Scope: ~40-80 lines in `keyPress` + state. Add tests for shadowing cases.
