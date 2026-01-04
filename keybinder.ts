/**
 * Modes should have optional return root. replace macro rebinding with a register-select mode and
 * a simple rebind. avoid the issue of rebinding many keys.
 *
 * Things to think about
 *  - contemplation of dynamic rebinding inside macro mode
 *  - timeout for nodes with an action and leaves
 *  - order matters for modifiers. I.e. <Shift-Meta-A> vs <Meta-Shift-A>
 *  - recursion depth for macro replay etc
 *    - vim has a way to know if a macro reached the end and breaks. I don't think I will replicate
 *    - some fancy call stack tracking?
 *    - Run inifinitely, but have a mechanism for user interrupts.
 *
 *    for interrupt, when Macro gets interrupted it could send an event like
 *    { command : "<interrupt>", args: 2212 }
 *    which represents the macro being interrupted after replaying that many actions. That would
 *    allow future deterministic replay
 *
 *  - global mode for universal bindings like <Esc><Esc> to reset all or
 *    <Shift-H> to enumerate actions at any position?
 *  - Element for manual input i.e. <Shift-:>
 *  - reserved actions? You will never see `vlk-record-macro` since it is consumed
 *    by macro mode
 *  - are there events, such as `vlk-macro-replay-end` that should only generate internally, and
 *  would cause errors if bound to a key sequence?
 *  - testing
 *  - contemplate stream flow control implications
 *  - insert mode
 *  - binding descriotions for enumerated menus
 *    i.e. bindSequence("<h>", "help", "normal", "Displays the help page with keybindings and app info")
 */
interface Node {
  nodes: Record<string, Node>;
  command?: string;
  args?: any;
}

/**
 * A single event from the event stream
 */
export interface VLKEvent {
  command: string;
  args: string | number;
}
type Root = Pick<Node, "nodes" | "command" | "args">;
interface Mode {
  root: Node;
}

/**
 * Modifier keys are ignored on their own, can only modify other key presses
 * this is not the current state, just a dict of key codes that should be ignored
 */
const BrowserModifierKeys: Record<string, true> = {
  Shift: true,
  Control: true,
  Alt: true,
  Meta: true,
};

/**
 * Encapsulates all of the state that can be modified from user interactions with the keybinder.
 * I.e. state that can be effected by key presses.
 */
export interface UserState {
  /**
   * The current node
   */
  position: Node | Root;
  /**
   * The current mode name, used as the position to reset to after an action is taken or an invalid
   * key is input.
   */
  mode: string;
  /*
   * True or false if the last keypress resulted in taking an action. Needed so when an unbound
   * key is pressed an action can be emitted, but only on the first instance
   */
  lastCodeWasValid: boolean;
  debug: {
    lastKeyCode: string;
    lastAction: string;
  };
}

/**
 * KeyBinder is a vim inspired modal keybinder library.
 *
 * Keybinder contains the following state
 *  - The keybindings, represented as a forest of trees
 *  - The current node position in a tree
 *  - The current mode, which determines which root node to position at after an invalid input or
 *    when the ESC key is pressed.
 *  - The current string of inputs before hitting an action node (used for numeric prefixes to
 *    repeat an action N number of times)
 */
export class KeyBinder {
  stream: ReadableStream<VLKEvent>;
  streamController!: ReadableStreamDefaultController;
  modes: Record<string, Mode>;
  state: UserState;
  handlers: Record<string, Function> = {};

  // Should be moved onto the user state
  macro: Macro;

  constructor() {
    /** Setup normal mode defaults */
    this.modes = { "normal": KeyBinder.createDefaultMode() };

    /** Setup the initial state */
    this.state = {
      position: this.modes["normal"].root,
      mode: "normal",
      lastCodeWasValid: false,
      debug: { lastAction: "", lastKeyCode: "" },
    };

    this.stream = this.initializeOutputStream();
    this.macro = new Macro(this);
    this.macro.attachTransformer(this);
  }

  async *[Symbol.asyncIterator]() {
    const reader = this.stream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (value) yield value;
      if (done) break;
    }
  }

  /**
   * Binds a function to run when a command is emitted that will execute synchronously before any
   * commands are enqueued to the stream. This is needed for anything that effects the keybinder
   * state, such as rebinds and mode changes
   *
   * commands get enqueued once the handler completes
   */
  bindSystemHandler(command: string, handler: Function) {
    this.handlers[command] = handler;
  }

  /**
   * Create an output stream and hoist the controller out to be used to enqueue actions elsewhere
   */
  initializeOutputStream(): ReadableStream {
    const vlk = this;
    return new ReadableStream({
      start(controller) {
        vlk.streamController = controller;
      },
      pull(controller) {},
      cancel() {
        /** This method is called when reader cancels */
      },
    });
  }

  /**
   * Called for browser keyup events. Get's the keycode with modifier keys into usable format then
   * calls the KeyBinder key function.
   */
  handleKeyEvent(e: KeyboardEvent) {
    if (BrowserModifierKeys[e.key]) return;
    const code = KeyBinder.keybordEventToCode(e);
    if (!code) return;
    const keyWasBound = this.keyPress(code);
    if (keyWasBound) e.preventDefault();
    return;
  }

  /**
   * A single keypress can result in multiple actions. Possible outcomes are outlined below
   *
   * - No next node for this code, but there is an action at current position
   *  - Take the action at the current position
   *  - Move to root of current mode and redo keypress
   *
   * - No next node for code, not root node, and there is no action
   *   - Move to root of current mode and redo keypress
   *
   * - No next node for code, at root node
   *   - If last keypress was bound, emit a reset (this is so macro mode can reset the count)
   *   - otherwise, do nothing
   *
   * - There is a next node and it is a leaf
   *   - Move to that node and take the action, return to root of mode
   *
   * - There is a next node, but it is not a leaf
   *   - Move to that node
   */
  keyPress(code: string): boolean {
    this.state.debug.lastKeyCode = code;
    let codeWasBound = false;

    {
      const { command, args, nodes } = this.state.position;
      if (!nodes[code]) {
        if (command) {
          this.takeAction(command, args);
          this.moveToRootOfCurrentMode();
          return this.keyPress(code);
        }
        if (this.state.position !== this.modes[this.state.mode].root) {
          this.moveToRootOfCurrentMode();
          return this.keyPress(code);
        }
      } else {
        this.state.position = nodes[code];
        codeWasBound = true;
      }
    }

    {
      /** Action and additional nodes for the new position we just moved to */
      const { command, args, nodes } = this.state.position;
      if (command && isEmpty(nodes)) {
        // If there is an command for this code, and it's a leaf, take the command.
        this.moveToRootOfCurrentMode();
        this.takeAction(command, args);
      } else if (command && !isEmpty(nodes)) {
        /**
         * @TODO - How to handle?
         * currently this command will only be triggered when another keypress occurs
         */
      } else if (!command && !isEmpty(nodes)) {
        // If there is no command, but there are additionl nodes, do nothing.
      } else {
        this.moveToRootOfCurrentMode();
        throw "Somehow ended up at a node with no command and no nodes";
      }
    }

    if (!codeWasBound && this.state.lastCodeWasValid) {
      this.takeAction("vlk-noop");
      this.state.lastCodeWasValid = false;
    } else if (codeWasBound) {
      this.state.lastCodeWasValid = true;
    }
    return codeWasBound;
  }

  enumerateCurrentActions() {
    for (const code in this.state.position.nodes) {
      console.log(code);
    }
  }

  static keybordEventToCode(e: KeyboardEvent): string {
    let key = e.key;
    if (BrowserModifierKeys[e.key]) return "";
    if (e.ctrlKey) key = "Ctrl-" + key;
    if (e.shiftKey) key = "Shift-" + key;
    if (e.altKey) key = "Alt-" + key;
    if (e.metaKey) key = "Meta-" + key;
    return `<${key}>`;
  }

  moveToRootOfCurrentMode() {
    this.state.position = this.modes[this.state.mode].root;
  }

  takeAction(command: string, args?: any) {
    this.state.debug.lastAction = `${command} ${args ?? ""}`;
    if (this.handlers[command]) {
      this.handlers[command].call(this, args);
    }
    this.streamController?.enqueue({ command, args });
  }

  static parseKeySequence(sequence: string): string[] | false {
    const state = {
      escape: false,
      open: false,
      key: "",
    };
    const keys: string[] = [];

    for (const char of sequence) {
      if (state.escape) {
        state.key += char;
        state.escape = false;
      } else {
        if (!state.open && char === "<") {
          state.open = true;
          state.key = char;
        } else if (state.open && char === ">") {
          state.open = false;
          state.key += char;
          keys.push(state.key);
        } else if (state.open && char === "\\") {
          state.escape = true;
        } else if (state.open) {
          state.key += char;
        }
      }
    }
    if (!keys || !keys.length) return false;
    return keys;
  }

  bindKeys(sequence: string, command: string, mode: string, args?: any) {
    const codes = KeyBinder.parseKeySequence(sequence);
    if (!codes) throw "Invalid key sequence";
    if (!this.modes[mode]) this.modes[mode] = KeyBinder.createDefaultMode();

    let node: Node | Root = this.modes[mode].root;
    /**
     * Creates nodes for all keys in the sequence, which looks something like
     * [ '<s-a>', '<f>', '<d>']
     */
    for (const code of codes) {
      if (!node.nodes[code]) {
        node.nodes[code] = {
          nodes: {},
        };
      }
      node = node.nodes[code];
    }
    node.command = command;
    node.args = args;
  }

  static createDefaultMode(): Mode {
    return {
      root: { nodes: {} },
    };
  }
}

function isEmpty(obj: any): Boolean {
  if (!obj) return true;
  for (const k in obj) return false;
  return true;
}

class Macro {
  static RegisterKeys = "abcdefghijklmnopqrstuvwxyz";
  // registers are locations where events are stored
  registers: Record<string, VLKEvent[]> = {};

  // The selected register will be used as the target when a replay or record
  // event occurs. I.e. <q><q> or <Shift-@><q>
  selected: string = "";

  // If true, all events get record except replay events while recording and
  // the trailing end macro event when ending a recording
  recording: boolean = false;

  // If true, incoming chunks don't get processed until the replay is complete
  replaying: boolean = false;

  interrupt: boolean = false;

  // All the events that came in while a replay was running
  buffer: VLKEvent[] = [];

  // Whatever register was selected when record-macro occured
  recordingTarget = "";

  // When a macro recording is started, the keybindings tree is modified to
  normalKeybindings!: Node;
  recordingKeybindings!: Node;

  // How many times to repeat any command that is coming through. Done by macro controller
  // because of how repeating macros need to function
  repeatCount: number = 0;

  send: Function = console.log;
  vlk!: KeyBinder;

  constructor(vlk: KeyBinder) {
    this.vlk = vlk;
    this.bindRepeatKeys(vlk);
    this.bindKeys(vlk);


    /** Change keybindings during macro recording */
    const normalKeybindings = vlk.modes["normal"].root.nodes["<q>"];
    const recordingKeybindings = { nodes: {}, command: "vlk-macro-record-end" };
    this.vlk.bindSystemHandler("vlk-macro-record-start", function () {
      vlk.modes["normal"].root.nodes["<q>"] = recordingKeybindings;
    });
    this.vlk.bindSystemHandler("vlk-macro-record-end", function () {
      vlk.modes["normal"].root.nodes["<q>"] = normalKeybindings;
    });
  }

  /** @TOOD Refactor together */
  bindRepeatKeys(kb: KeyBinder, mode: string = "normal") {
    this.vlk = kb;
    for (let i = 0; i < 10; i++) {
      kb.bindKeys(`<${i}>`, "vlk-macro-update-repeat", mode, [i]);
    }
  }
  bindKeys(kb: KeyBinder, mode: string = "normal") {
    kb.bindKeys(`<Escape><Escape>`, "vlk-macro-interrupt", mode);
    kb.bindKeys(`<Shift-@><s-@>`, "vlk-macro-replay", mode);
    /** start recording and replay specific macro */
    for (const key of Macro.RegisterKeys) {
      kb.bindKeys(`<q><${key}>`, "vlk-macro-record-start", mode, key);
      kb.bindKeys(`<Shift-@><${key}>`, "vlk-macro-replay", mode, key);
    }
  }

  /**
   * Called for any action coming from keybinder and when replaying or repeating
   * commands by count register or macro replay
   */
  async takeAction({ command, args }: VLKEvent, depth = 0) {
    if (this.interrupt) return;

    const count = this.repeatCount > 0 ? this.repeatCount : 1;
    if (this.replaying) await sleep(20);
    switch (command) {
      case "vlk-noop":
        /**
         * The noop command is used to clear the count register when an unbound key is pressed
         * TBD if it should be consumed or not.
         */
        this.repeatCount = 0;
        this.send({ command: "vlk-macro-state-change" });
        return;
      case "vlk-macro-update-repeat":
        /*
         * Increases the count register. Consumed by macro manager.
         */
        const val = Number(args);
        if (!isNaN(val)) {
          this.repeatCount = this.repeatCount * 10 + val;
          if (this.repeatCount > 10000) this.repeatCount = 10000;
        }
        this.send({ command: "vlk-macro-state-change" });
        return;
      case "vlk-macro-record-start":
        // Start recording
        this.repeatCount = 0;
        if (this.recording) throw "Cannot start a recording while recording a macro";
        this.recording = true;
        this.recordingTarget = `${args}`;
        this.registers[this.recordingTarget] = [];
        this.send({ command: "vlk-macro-state-change" });
        return;
      case "vlk-macro-record-end":
        // Stop the current recording
        this.registers[this.recordingTarget].pop();
        this.recording = false;
        this.send({ command: "vlk-macro-state-change" });
        return;
      case "vlk-macro-replay":
        this.repeatCount = 0;
        if (depth < 4) {
          for (let i = 0; i < count; i++) await this.replayMacro(`${args}`, depth + 1);
        } else {
          console.log("ERR: Max macro replay depth reached");
        }
        return;
      default:
        /**
         * All non-macro related events, simply pass them on to next consumer
         */
        this.repeatCount = 0;
        for (let i = 0; i < count; i++) this.send({ command, args });
    }

    // If it is an command that gets enqueue, do it
  }

  async replayMacro(macro: string, depth: number) {
    for (const event of this.registers[macro] ?? []) {
      await this.takeAction(event, depth);
    }
  }

  attachTransformer(kb: KeyBinder) {
    this.bindKeys(kb);
    this.bindRepeatKeys(kb);
    const macro = this;
    const stream = new TransformStream({
      start(controller) {
        macro.send = (event: VLKEvent) => {
          controller.enqueue(event);
        };
      },

      transform(event: VLKEvent) {
        /**
         * Handle interrupt event at highest priority. If replaying, set interrupt and clear buffer.
         * Otherwise, do nothing
         */
        if (event.command === "vlk-macro-interrupt") {
          if (macro.replaying) {
            macro.buffer = [];
            macro.interrupt = true;
            macro.recording = false;
            return;
          } else {
            return;
          }
        }

        if (macro.replaying) {
          /**
           * Record all events into buffer to be processed once replay is complete
           */
          macro.buffer.push(event);
        } else {
          // Push event if recording. This happens before processing, so the start recording event
          // won't be recorded.
          if (macro.recording) macro.registers[macro.recordingTarget].push(event);
          if (event.command === "vlk-macro-replay") {
            /**
             * If starting a replay, set replay state and process the replay. Once the replay has
             * resolved, process any buffered input and clear replay state
             */
            macro.replaying = true;
            macro.takeAction(event).then(async () => {
              while (macro.buffer.length) {
                const bufferedEvent = macro.buffer.shift()!;
                if (macro.recording) macro.registers[macro.recordingTarget].push(bufferedEvent);
                await macro.takeAction(bufferedEvent!);
              }
              macro.replaying = false;
              macro.interrupt = false;
            });
          } else {
            macro.takeAction(event);
          }
        }
      },
    });
    kb.stream = kb.stream.pipeThrough(stream);
  }
}

async function sleep(ms: number) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}
