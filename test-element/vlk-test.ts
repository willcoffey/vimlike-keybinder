import { KeyBinder, VLKEvent } from "../keybinder.ts";
import html from "./vlk-test.html?raw";
interface AppState {
  x: number;
  y: number;
  zoomed: boolean;
}
interface CommandHandler {
  (event: VLKEvent): any;
}

class VlkTest extends HTMLElement {
  shadow!: ShadowRoot;
  vlk: KeyBinder;
  state: AppState = {
    x: 0,
    y: 0,
    zoomed: false,
  };

  constructor() {
    super();
    this.vlk = new KeyBinder();
    this.watchVlkDebug();
    this.setupKeybindings();
    this.handleCommands();
    this.loadMacroState();
  }

  loadMacroState() {
    const state = `
        {
          "q": [
            { "command": "move-down" },
            { "command": "move-right" },
            { "command": "move-up" },
            { "command": "move-left" }
          ]
        }`;
    this.vlk.macro.load(state);
  }

  /**
   * Creates a proxy object to react changes in vlk.state.debug and update
   * html
   */
  watchVlkDebug() {
    const render = this.render.bind(this);
    const handler: ProxyHandler<any> = {
      set(target, prop, receiver) {
        const result = Reflect.set(target, prop, receiver);
        render();
        return result;
      },
    };
    const proxiedDebug = new Proxy(this.vlk.state.debug, handler);
    this.vlk.state.debug = proxiedDebug;
  }

  /**
   * Invoked when the custom element is first connected to the document's DOM.
   * shadow cannot be attached before this is run.
   */
  connectedCallback() {
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.innerHTML = html;
    this.getOrThrow("cursor-box").addEventListener("keydown", (e) => {
      const hadEffect = this.vlk.handleKeyEvent(e);
      if(hadEffect) this.render()
    });
  }

  /**
   * Create mapings of key sequences to commands, with optional simple arguments
   *  - does not include macro keybindings done internally in vlk
   */
  setupKeybindings({ vlk } = this) {
    vlk.bind("<Shift-R>", "debug", "normal");
    //vlk.bindKeys("<Shift-R>", "debug", "normal");
    //vlk.bindKeys("<Shift-H>", "enumerate", "normal");
    vlk.bindKeys("<l>", "move-right", "normal");
    vlk.bindKeys("<h>", "move-left", "normal");

    vlk.bindKeys("<Shift-\\>>", "move-right", "normal");
    vlk.bindKeys("<Shift-\\<>", "move-left", "normal");

    vlk.bindKeys("<j>", "move-down", "normal");
    vlk.bindKeys("<k>", "move-up", "normal");
    vlk.bindKeys("<g><g>", "move-home", "normal");
    vlk.bindKeys("<Shift-G>", "move-end", "normal");
    vlk.bindKeys("<Ctrl-a><z>", "zoom", "normal");
  }

  /**
   * Reads commands from the key event stream. Waits for the command execution to complete before
   * processing next command.
   */
  async handleCommands() {
    for await (const event of this.vlk) {
      if (this.commands[event.command]) {
        await this.commands[event.command].call(this, event);
      }
      this.render();
    }
  }

  /**
   * I am by no means sold on using an object for mapping the string commands to functions. It's
   * cleaner than a switch, but not a fan of the binding. Will leave till later to decide on a
   * standard way.
   */
  commands: Record<string, CommandHandler> = {
    "debug": (event) => {
      console.log(this.vlk.macro.registers);
    },
    "move-right": this.move.bind(this, 1, 0),
    "move-left": this.move.bind(this, -1, 0),
    "move-down": this.move.bind(this, 0, 1),
    "move-up": this.move.bind(this, 0, -1),
    "move-home": () => {
      this.state.x = 0;
      this.state.y = 0;
      this.render();
    },
    "move-end": () => {
      this.state.x = 20;
      this.state.y = 20;
    },
    "zoom": this.zoom,
    "enumerate": this.enumerateCurrentBindings,
  };

  enumerateCurrentBindings() {
    const actions = this.vlk.enumerateCurrentActions();
    const globals = this.vlk.enumerateCurrentActions(this.vlk.globalMode.root);
    const el = this.getOrThrow("help");
    el.innerHTML = "";

    // Add the global actions
    const globalSep = document.createElement("div");
    globalSep.classList.add("help-seperator");
    globalSep.textContent = "Global Bindings";
    el.appendChild(globalSep);
    for (const { command, help, sequence } of globals) {
      const code = document.createElement("div");
      const text = document.createElement("div");
      code.classList.add("key-code");
      text.classList.add("help-text");
      code.textContent = sequence;
      text.textContent = help;
      el.appendChild(code);
      el.appendChild(text);
    }

    // Add the position bindings
    const positionSep = document.createElement("div");
    positionSep.classList.add("help-seperator");
    positionSep.textContent = "Position Bindings";
    el.appendChild(positionSep);
    for (const { command, help, sequence } of actions) {
      const code = document.createElement("div");
      const text = document.createElement("div");
      code.classList.add("key-code");
      text.classList.add("help-text");
      code.textContent = sequence;
      text.textContent = help;
      el.appendChild(code);
      el.appendChild(text);
    }
  }

  render() {
    console.log("Render")
    this.enumerateCurrentBindings();
    try {
      const cursor = this.getOrThrow("cursor");
      const { vlk } = this;
      // If zoomed, fill the container
      if (this.state.zoomed) {
        cursor.style.gridColumn = "1 / 22";
        cursor.style.gridRow = "1 / 22";
      } else {
        cursor.style.gridColumn = `${this.state.x + 1}`;
        cursor.style.gridRow = `${this.state.y + 1}`;
      }

      // Macro recording status
      const recording = this.getOrThrow("recording");
      if (vlk.macro.recording) {
        recording.innerHTML = "true";
        recording.style.backgroundColor = "red";
      } else {
        recording.innerHTML = "false";
        recording.style.backgroundColor = "lightgray";
      }

      const debug = vlk.state.debug;
      this.getOrThrow("mode").innerHTML = vlk.state.mode;
      this.getOrThrow("repeatCount").innerHTML = `${vlk.macro.repeatCount}`;
      this.getOrThrow("lastAction").innerHTML = debug.lastAction;
      //this.getOrThrow("lastKeyCode").replaceChildren(document.createTextNode(debug.lastKeyCode));
      this.getOrThrow("lastKeyCode").innerHTML = debug.lastKeyCode.replace(/</g, "&lt;");
      // Apply selected class to any macro register letters that have content
      for (const register of this.shadow.querySelectorAll(".register")) {
        const id = register.innerHTML;
        const content = vlk.macro.registers[id];
        if (content?.length) {
          register.classList.add("selected");
          if (register instanceof HTMLElement) {
            register.onclick = () => {
              vlk.takeAction("vlk-macro-replay", id);
            };
          }
        } else {
          register.classList.remove("selected");
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  getOrThrow(id: string): HTMLElement {
    const el = this.shadow.getElementById(id);
    if (!el) throw `Missing element with id "${id}"`;
    return el;
  }

  zoom() {
    this.state.zoomed = !this.state.zoomed;
  }

  move(left: number, top: number) {
    let { x, y } = this.state;
    this.state.zoomed = false;
    x = x + left;
    y = y + top;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x > 20) x = 20;
    if (y > 20) y = 20;
    this.state.x = x;
    this.state.y = y;
  }
}
customElements.define("vlk-test", VlkTest);
