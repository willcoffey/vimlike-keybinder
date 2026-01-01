I intend to work on this until I solidify the interface and have the basic functionality I need. 
Beyond that, development is going to be driven by whatever requirements or issues that come up when
using this in my own projects. If there happens to be external interest, I MAY put in some more 
work on it.

## Current Priorities (no particular order)

### Input mode
For passing through key presses to a target. I don't intend to serialize the whole KeyEvent due to
browser security reasons with replay, and I want to maintain compatibility with terminal which will
have different formats.

### Global keybinding tree
For commands that should be taken regardless of mode or position. First check global tree for 
binding before checking mode tree.
Examples:
    `<Shift-H`> - Enumerate bindings at current position to display to user
    `<Esc><Esc>` - Interrupt and return to normal mode

### Interrupts
Need a way to interrupt macros that will take too long to complete. Also need to decide on some
rules for macro recursion. Challenge with how to make deterministic, since when the interrupt 
happens matters and isn't tracked. Maybe Macro system tracks number of commands executed, and logs
this when an interrupt occurs?

### package.json
Finalize dev and build options. Setup entry point etc so it can be npm installed. setup tests

### Test infra
Mainly use recorded macros with `vlk-test` to perform tests.

### Types
Finalize naming and types. Finalize how arguemnts work and get bound to commands. Maybe have option
for arguments to be a hash that is used to fetch external data. I.e. argument is short string OR 
content address for anything larger. But, in principle there should not be the anything larger, 
since a key sequence is all the information being input to the system.

### Localization & Accessibility
