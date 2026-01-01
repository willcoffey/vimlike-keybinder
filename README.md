### Summary
`vimlike-keybinder` or `vlk` is a library for binding sequences of keypresses to commands. It is
inspired by how `vim` handles keybinding, but not meant to be a clone. It supports modes, recording
and replaying macros, and repeating commands by prefixing them with numbers.

### Demo
[Test element](https://willcoffey.github.io/vimlike-keybinder/)
see source for keybindings, but basics are `h`, `j`, `k`, `l` for movement. `q` to start and stop 
recording a macro and `@q` to replay a macro

### Limitations
 - Does not support chording
 - Modifier keys cannot be bound alone
 - No localization
 - No way to interrupt a macro

### Usage
The basic usage is to associate key sequences with commands, then handle the commands as they are
output. `vlk` is an async iterator which will yield commands when a key sequence is input. 
Alternatively, `vlk.stream` is a ReadableStream of commands.

This pattern makes it easy to bind multiple keys to the same command, have macros be independent of
keybindings, easily ensure sequential processing of commands, and create buttons or other inputs
that can send commands.

A simple example from `min.ts`
```typescript
import { KeyBinder, VLKEvent } from "../keybinder.ts";
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

  for await (const { command, args } of vlk) {
    switch (command) {
      case "alert":
        alert("Hello");
        break;
      case "set-mode":
        /** Should make internal method */
        vlk.state.mode = args;
        vlk.moveToRootOfCurrentMode();
        break;
      case "log-modes":
        console.log(vlk.modes);
    }
  }
}
```


