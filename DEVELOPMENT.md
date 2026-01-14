## Current Priorities (no particular order)

- Refactor macro keybindings to be a register select mode + queue action on register select

### Macro Mode

#### Macro buffering needs update
   because macro replays can effect how user input gets processed into commands, by changing the 
   mode or changing keybindings, I need to buffer raw user input, not commands. I need to move the
   buffer to the keybinder class and have a method for starting and stopping processing of events. 
   
   I also need to think about how one would implement macro mode without the privledged
   synchrnous access to the keybinder class

   I need async methods like `await bind()` and `await setMode` which don't resolve until the change
   has been processed, because until that change is processed behaviour could be unpredictable.
   e.g. if I do `<q><q>` too fast, I could get two record events if the first one wasn't processed
   and the rebinding of `q` didn't occur 
    
    


#### Notes on register mode refactor
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


### Misc thoughts
If you want to have macros be able to abort depending on downstream clients the stream needs to be
synchrounous throughout Macro mode. Essentially the same issue as system handlers for mode 
switching. 

 Think of vim macros

e.g. `qq@qq@q` in vim should recurse endlessly, but aborts when hitting the limit of the buffer. 

For compatibility with multiple clients this would be another concern. You would have to assume that
the downstream client will deterministically output the abort signal. This signal would not show up 
in macro register. 


shouldn't be doing the macro controller async. should assume macro and keybinder exist on same
process. switch to a while(!done) pattern



Need to think about pattern of

action modifier modifier
e.g.
yank 3 word

or
record macro - into register q

