I intend to work on this until I solidify the interface and have the basic functionality I need. 
Beyond that, development is going to be driven by whatever requirements or issues that come up when
using this in my own projects. If there happens to be external interest, I MAY put in some more 
work on it.

---

## Current Priorities (no particular order)

### Refactor keybinding system
Mode should be a part of key sequence, in a format like
`normal:<Ctrl-a><z>`

There should be an `unbind` method.

There should be an additional help argument. 
`bind("normal:<Ctrl-a><z>", "zoom", "", "Zoom the currently focused pane to fill the screen)`
I'm not sure how I want to handle `args`. `args` should be rarely defined, but help should always
be defined. But at the same time I prefer to have help be the final argument.

I could do
`bind({ sequence, command, args, help })`
but that's a lot of extra definition

I could overload the function such that if it takes in only 3 arguments, it presumes help is the
last one.

### Global keybinding tree
Implemented global mode, but still needs testing and related functions
 - Unify global mode with other mode processing.
 - update binding method for `global:<Escape><Escape>` format

### Macro Mode
 - Saving & Loading macros: This is implemented in basic proof of concept, but needs to be documented
 - Need to update system bindings so that they get recorded by macro mode


### Modes that return to a different root
For example, register select mode would return to normal mode once a register is selected.
See `returnPosition` and how it's used by global mode.

### API for removing bindings

### Enumeration of commands at current position

### Input mode
For passing through key presses to a target. I don't intend to serialize the whole KeyEvent due to
browser security reasons with replay, and I want to maintain compatibility with terminal which will
have different formats.

### Documentation
 - Pick some good documentation from some other library / site as a template. MDN?
 - I completed interrupts and system handlers, but need to document how they work.

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
