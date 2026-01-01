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
        vlk.state.mode = `${args}`;
        vlk.moveToRootOfCurrentMode();
        break;
      case "log-modes":
        console.log(vlk.modes);
    }
  }
}
