### Summary
`vimlike-keybinder` or `vlk` is a library for binding sequences of keypresses to commands. It is
inspired by how `vim` handles keybinding, but not meant to be a clone. It supports modes, global
bindings that apply in every mode, recording and replaying macros, and repeating commands by
prefixing them with numbers.

### Demo
[Test element](https://willcoffey.github.io/vimlike-keybinder/)


See source for keybindings, but basics are `h`, `j`, `k`, `l` for movement, prefixed with a number
to repeat. `q` then a letter starts recording a macro and `q` stops it, `@` then that letter replays
it, and `@@` replays the last one. `Esc Esc` interrupts a macro that is still running.

### Limitations
 - Does not support chording
 - Modifier keys cannot be bound alone
 - Modifiers must be written in the order `Ctrl`, `Shift`, `Alt`, `Meta`
 - No localization

### Usage
The basic usage is to associate key sequences with commands, then handle the commands as they are
output. `vlk` is an async iterator which will yield commands when a key sequence is input. 
Alternatively, `vlk.stream` is a ReadableStream of commands.

This pattern makes it easy to bind multiple keys to the same command, have macros be independent of
keybindings, easily ensure sequential processing of commands, and create buttons or other inputs
that can send commands.

Commands are not produced faster than they are consumed, so a slow consumer paces a macro replay
instead of being flooded by it. Anything that changes how later keys are read, such as switching
mode, belongs in `vlk.bindSystemHandler` rather than in the consumer, because handlers run while the
keypress is still being processed. `set-mode` is one of these and is built in.

Construct with `new KeyBinder(true)` to also get the built in macro, count register and global
bindings.

A simple example from `min.ts`
```typescript
import { KeyBinder } from "../keybinder.ts";
window.addEventListener("load", init);

async function init() {
  const vlk = new KeyBinder();
  document.body.addEventListener("keydown", vlk.handleKeyEvent.bind(vlk));

  // Normal mode bindings
  vlk.bindKeys("<a>", "alert", "normal");
  vlk.bindKeys("<l>", "set-mode", "normal", "log");

  // log mode bindings
  vlk.bindKeys("<Ctrl-a><l>", "log-modes", "log");
  vlk.bindKeys("<Escape>", "set-mode", "log", "normal");

  /**
   * set-mode is not handled here. It changes how later keys are read, so it is
   * a built in system handler that runs while the keypress is still being
   * processed, before the command reaches this loop.
   */
  for await (const { command } of vlk) {
    switch (command) {
      case "alert":
        alert("Hello");
        break;
      case "log-modes":
        console.log(vlk.modes);
    }
  }
}
```
