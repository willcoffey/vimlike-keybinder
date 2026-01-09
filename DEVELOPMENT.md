I intend to work on this until I solidify the interface and have the basic functionality I need. 
Beyond that, development is going to be driven by whatever requirements or issues that come up when
using this in my own projects. If there happens to be external interest, I MAY put in some more 
work on it.

---

## Current Priorities (no particular order)

- Refactor globalMode to be handled like other modes
- Refactor macro keybindings to be a register select mode + queue action on register select
- Refactor all keybinds to use new api and remove old api


### Macro Mode
 - Saving & Loading macros: This is implemented in basic proof of concept, but needs to be documented
 - Need to update system bindings so that they get recorded by macro mode
    The issue with recording is that the macro system only enqueues actions downstream, but system
    handlers exist upstream. Currently hacked in direct calls to the system handler, but there 
    should be a better solution. Likely just calling `takeAction` on `vlk` but with an option to
    not pass actions downstream 

#### Notes on interrupts and recursive macros
I implemented a system that should make interrupted replay be deterministic, but have not tested it
completely. However, there is still an issue with recursive macros, a macro that plays itself while
being recorded. If you record a macro, then have it play itself, and record more actions,
 you will get different behaviour later when your replay it, since it has changed from the inital
replay during recording. This could be addressed by adding an argument to `vlk-replay-macro` that
limits how many instructions of the macro to replay.


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
