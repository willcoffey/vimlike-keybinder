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
