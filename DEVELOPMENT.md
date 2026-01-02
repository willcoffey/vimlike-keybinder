I intend to work on this until I solidify the interface and have the basic functionality I need. 
Beyond that, development is going to be driven by whatever requirements or issues that come up when
using this in my own projects. If there happens to be external interest, I MAY put in some more 
work on it.

# High Priority Features

## Interrupts
Fri Jan  2 18:00:05 EST 2026
---
Fundamental issue with recording
Currently, starting a macro recording rebinds the key to be the stop recording command. But, when
replaying a macro command inputs get delayed until replay is complete. meaning this rebind cannot
happen, so the buffered input behaves differently.

really, there should be no backwards communication from the macro system backwards. Implying 
keybinds must be static for the life of a program

alternatively, instead of Macro buffering commands, it could send a signal to have keybinder buffer
input to be processed later.

Or macro system could be moved

currently

KeyEvent -> toKeyCode -> toCommand -> MacroSystem -> downstream misc
could be
KeyEvent -> toKeyCode -> MacroSystem -> toCommand -> downstream misc



For now, I am going to make a simple version of an interrupt system. To avoid complexity interrupts
cannot be recorded by macros. When issued, they will stop current macro replay, stop current macro
recording, and clear any buffered input.

This has the consequence of keybinder state, and therefore anything downstream not be a pure 
function of it's input. Because the timing of when an abort signal is sent matters. 

Solutions? 
    The issue only arises when you abort a macro replay.
    If you tracked how many commands executed, the interrupt command could specify WHEN to abort.
    This doesn't really solve it, because it's a case of the interrupt effecting previously issued
    commands.
    Is this an issue inherent to interrupts. Do interrupts necessarily effect previous commands?

For a replay log, interrupts could be hoisted to the beginning of the log, so they schedule when to
interrupt. This is only for later replay, not for teeing a livestream to multiple clients

Scenerio
Imagine the case where I am putting inputs on my machine, and the output is being streamed to many
other computers. One of those is going to be a faster computer than me, and therefore have computed
more commands from the looping macro than mine. I issue an interrupt, but how do I ensure my 
state remains consistent with the other computers?

Solution: For now, only tee downstream from macro system.




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
