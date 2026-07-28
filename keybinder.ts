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
interface ParsedSequence {
  codes: string[];
  mode: string;
}

type Node = LeafNode | CommandNode | BasicNode;
interface BasicNode {
  nodes: Record<string, Node>;
}

interface CommandNode {
  nodes: Record<string, Node>;
  command: string;
  help: string;
  args?: any;
}
interface LeafNode {
  nodes: Record<string, never>;
  command: string;
  help: string;
  args?: any;
}
interface Root {
  nodes: Record<string, Node>;
  root: true;
}
interface Mode {
  root: Root;
}
interface Modes {
  global: Mode;
  [mode: string]: Mode;
}
interface Action {
  event: VLKEvent | false;
  move: false | "default" | "branch";
  replay: boolean;
}
/**
 * A single event from the event stream
 */
export interface VLKEvent {
  command: string;
  args?: string | number;
}
export interface RegisterState {
  [id: string]: VLKEvent[];
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
  position: Root | Node;
  /**
   * The position on the global tree, a global action takes precedence over other modes, but
   * partial matches don't
   */
  globalPosition: Root | Node;

  // The last emitted action
  lastAction: VLKEvent | null;
  /**
   * The current mode name, used as the position to reset to after an action is taken or an invalid
   * key is input.
   */
  mode: string;
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

  modes: Modes;
  state: UserState;

  // System handlers that handle commands synchronously inside keybinder before
  // enquing onto the stream. For commands that modify the future behaviour of
  // keybinder such as new bindings or mode switches.
  // @TODO Decide how macro system interacts with system handlers. specifically
  // mode switches
  handlers: Record<string, Function> = {};

  // Should be moved onto the user state
  macro: Macro;

  constructor(enableDefaultKeybindings = false) {
    /** Setup normal mode defaults */
    this.modes = {
      "global": KeyBinder.createDefaultMode(),
      "normal": KeyBinder.createDefaultMode(),
    };

    /** Setup the initial state */
    this.state = {
      position: this.modes["normal"].root,
      globalPosition: this.modes["global"].root,
      mode: "normal",
      lastAction: null,
      debug: { lastAction: "", lastKeyCode: "" },
    };

    this.stream = this.initializeOutputStream();
    if (enableDefaultKeybindings) this.setupKeybindings();
    this.macro = new Macro(this);
    this.macro.attachTransformer(this);
  }

  setupKeybindings() {
    /** Global keybindings */
    this.bind(
      "global:<Shift-H>",
      "enumerate",
      `Show command help for current position`,
    );
    this.bind(
      "global:<Escape><Escape>",
      "vlk-macro-interrupt",
      `Abort the replay of any macros and clear all buffered input`,
    );

    /** Count register */
    for (let i = 0; i < 10; i++) {
      this.bind(
        `normal:<${i}>`,
        `vlk-macro-update-repeat:${i}`,
        `Add a trailing ${i} to the repeat register`,
      );
    }
    this.bind(
      `normal:<Shift-M><s>`,
      "vlk-macro-serialize",
      "Log the serialized state of the macro registers to the console",
    );
    this.bind(
      `normal:<Shift-@><Shift-@>`,
      "vlk-macro-replay",
      "Replay the last run macro",
    );
    /** start recording and replay specific macro */
    for (const key of Macro.RegisterKeys) {
      this.bind(
        `normal:<q><${key}>`,
        `vlk-macro-record-start:${key}`,
        `Record a macro in the '${key}' register`,
      );
      this.bind(
        `normal:<Shift-@><${key}>`,
        `vlk-macro-replay:${key}`,
        `Replay the macro in the '${key}' register`,
      );
    }
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

  handleKeyEvent(e: KeyboardEvent) {
    if (BrowserModifierKeys[e.key]) return;
    const code = KeyBinder.keybordEventToCode(e);
    if (!code) return;
    const keyWasBound = this.keyPress(code);
    if (keyWasBound) e.preventDefault();
    return keyWasBound;
  }

  /**
   * Handles a key press event by traversing the global tree and active mode
   * tree. Global is walked first, and mode tree is walked if no global action
   * is taken.
   *
   * ---
   *
   * A single keypress can result in multiple actions. Possible outcomes are
   * outlined below
   *
   * - The global walk claims the code, meaning this code reached an action
   *   - Emit that action
   *   - Skip the mode walk entirely, leaving the mode cursor where it was
   *
   * - The global walk does not claim the code
   *   - Emit any global events, such as an action flushed on the way back to
   *     the root, which was earned by earlier codes rather than this one
   *   - Walk the mode tree from its current position, whether the global cursor
   *     branched, flushed, or did nothing
   *
   * - Neither cursor claimed or consumed the code
   *   - Emit vlk-unbound-key, if that was not the last event emitted
   *   - Report the key as unbound, leaving the browser default alone
   */
  keyPress(code: string): boolean {
    this.state.debug.lastKeyCode = code;

    /** Determine events and next position for the global cursro */
    const globalWalk = KeyBinder.resolveCursor(
      code,
      this.state.globalPosition,
      this.modes.global.root,
    );
    let consumed = globalWalk.consumed;
    /** Update position before events, in case events use position */
    this.state.globalPosition = globalWalk.position;
    /** Emit the events */
    for (const event of globalWalk.events) this.takeAction(event.command, event.args);

    /**
     * modes only get processed if a global action was not emitted
     */
    if (!globalWalk.claimed) {
      const modeWalk = KeyBinder.resolveCursor(
        code,
        this.state.position,
        this.modes[this.state.mode].root,
      );
      consumed = consumed || modeWalk.consumed;
      this.state.position = modeWalk.position;
      for (const event of modeWalk.events) this.takeAction(event.command, event.args);
    }

    /** If the key was unbound, emit unbound event only if it wasn't the last emit */
    if (!consumed && this.state.lastAction?.command !== "vlk-unbound-key") {
      this.takeAction("vlk-unbound-key");
    }
    return consumed;
  }

  /**
   * Traverses tree using provided code. returns
   * position - updated position in tree based on code
   *
   * events - actions to be emitted, multiple events arise from being on a node
   * with an action + command and a code that is not a leaf hear, but is bound
   * to an action at the root of the mode
   *
   * consumed - if this code was bound. not necessarily at current position due
   * to replay possibility.
   *
   * claimed - if this code triggered an action. can be false even when events
   * are returned if the event was from the current position having an action
   * and branches. and this code being unbound therefore triggering the action
   * at the current node, but not because the current code itself triggered
   * something.
   */
  static resolveCursor(code: string, position: Root | Node, root: Root) {
    const events: VLKEvent[] = [];
    /** A root never requests a fallback, so this runs at most twice */
    while (true) {
      const { event, replay, move } = KeyBinder.determineNextAction(code, position);
      if (move === "branch") {
        position = position.nodes[code];
      } else if (move === "default") {
        position = root;
      }
      if (event) events.push(event);
      /**
       * An unbound key from inside (i.e. not root) the tree gets replayed at
       * the root. This is how multiple events can be emitted from a single code
       *
       * Only the final call returns a value, and only final call effects the
       * claimed status.
       */
      if (!replay) {
        const claimed = !!event;
        return { position, events, claimed, consumed: claimed || move === "branch" };
      }
    }
  }

  /**
   * Determines what the next action should be
   */
  static determineNextAction(code: string, node: Node): Action {
    if (!node.nodes[code]) {
      // What to do when there is no branch for the code
      if (isRoot(node)) {
        /**
         * If there is no node for this action, and it is the root node, nothing
         * should be done
         */
        return {
          event: false,
          replay: false,
          move: false,
        };
      } else if (hasCommand(node)) {
        /**
         * If this node has a command, and there is no branch for the code, then
         * the command should be performed, the position reset, and the code
         * reprocessed at the new position
         */
        return {
          event: { command: node.command, args: node.args },
          replay: true,
          move: "default",
        };
      } else {
        /**
         * If there is no command and no branch for the code, position should be
         * moved and the command replayed
         */
        return {
          event: false,
          replay: true,
          move: "default",
        };
      }
    } else {
      const nextPosition = node.nodes[code];
      if (isLeaf(nextPosition)) {
        /**
         * If the branch leads to a leaf node, then the command should be taken
         * and the position updated
         */
        return {
          event: { command: nextPosition.command, args: nextPosition.args },
          replay: false,
          move: "default",
        };
      } else {
        /**
         * If the branch leads to a node with branches, then the position should
         * be moved to the next node
         */
        return {
          event: false,
          replay: false,
          move: "branch",
        };
      }
    }
  }

  /**
   * Brainstorming global mode
   *
   * result of a keypress on a tree can be
   *   - unbound basic node - repeat key at root IF not at root
   *   - unbound command node - take action, repeat key at root IF not at root
   *   - move to leaf, take action
   *   - move to node
   *
   *   return value
   *
   *   { command: command, repeat: boolean,
   *
   *   need to decide on expected behaviour
   *   global:<Escape><Escape> = interrupt
   *   normal:<Escape> = clear selection
   *
   *   What happens when the user presses <Escape>? Does it clear selection? Or wait till a non
   *   Escape key is pressed to take that action?
   *
   *   Initial use case was for
   *
   *   global:<Ctrl-Shift-H> - Show help for current position. Which should not effect the position
   *   in the current tree
   *
   *   could "global" be treated as nodes that exist at all nodes of other trees, with the return
   *   point of wherever they branched when the user diverged onto the global tree?
   *
   *   This would necetate that, code sequences at the root of the global tree cannot be bound
   *   ANYWHERE on any other tree
   *
   *   Is it expected behaviour that global mode returns to node of seperation and not root of
   *   current mode?
   *
   *   What are some examples of global key bindings?
   *
   *   <Escape><Escape> - Interrupt - Would make sense to return to root
   *   <Ctrl-Shift-H> - Show help for current position - Would make sense to return to seperation point
   *
   *   Could give options
   *
   *   i.e.
   *
   *   vlk.bind("global:<Ctrl-Shift-H>", "show-help", "", "diverged")
   *   vlk.bind("global:<Escape><Escape>", "show-help", "", "normal:<Root>")
   */

  /**
   * Moves to the leaf addressed by `code` from `position`. If the leaf does
   * not exist return false
   */
  static moveToNode(position: Node, code: string): Node | false {
    const next = position.nodes?.[code];
    return next ? next : false;
  }

  /**
   * Used to display help
   */
  enumerateCurrentActions(root: Node = this.state.position, sequence: string = ""): any[] {
    const actions: any[] = [];
    for (const code in root.nodes) {
      const node = root.nodes[code];
      if (hasCommand(node)) {
        actions.push({
          sequence: sequence + code,
          command: node.command,
          args: node.args,
          help: node.help,
        });
      }
      if (!isLeaf(node)) {
        actions.push.apply(actions, this.enumerateCurrentActions(node, sequence + code));
      }
    }
    return actions;
  }

  static keybordEventToCode(e: KeyboardEvent): string {
    let key = e.key;
    if (BrowserModifierKeys[e.key]) return "";
    if (e.metaKey) key = "Meta-" + key;
    if (e.altKey) key = "Alt-" + key;
    if (e.shiftKey) key = "Shift-" + key;
    if (e.ctrlKey) key = "Ctrl-" + key;
    return `<${key}>`;
  }

  takeAction(command: string, args?: any) {
    this.state.debug.lastAction = `${command} ${args ?? ""}`;
    this.state.lastAction = { command, args };
    if (this.handlers[command]) this.handlers[command].call(this, args);
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

  static parseSequence(sequence: string): ParsedSequence {
    /** If the sequence begins with codes, prepend normal mode onto it as default */
    if (sequence[0] === "<") sequence = "normal:" + sequence;
    const parsed: ParsedSequence = {
      mode: "",
      codes: [],
    };
    const state = {
      escape: false,
      open: false,
      chunk: "",
      modeParsed: false,
    };
    for (const char of sequence) {
      if (state.escape) {
        /** If this is an escaped character, simply add it to current chunk */
        state.chunk += char;
        state.escape = false;
      } else if (char === "\\") {
        /** If the next character is being escaped, don't add the \ to the chunk */
        state.escape = true;
      } else if (!state.modeParsed && char === ":") {
        /** If this is the end of the mode section set mode */
        state.modeParsed = true;
        parsed.mode = state.chunk;
        state.chunk = "";
      } else if (!state.modeParsed) {
        /** If parsing the mode, simply append the chunk */
        state.chunk += char;
      } else if (!state.open && char === "<") {
        /** If this is the opening < of a code, reset the chunk value to just < */
        state.open = true;
        state.chunk = char;
      } else if (state.open && char === ">") {
        /** If this is the closing > then add the code to the array of codes for the sequence */
        state.open = false;
        state.chunk += ">";
        parsed.codes.push(state.chunk);
      } else if (state.open) {
        /** Mode section parsed and char is inside <> then just add it to chunk */
        state.chunk += char;
      }
    }
    return parsed;
  }

  static parseCommandString(commandString: string): [string, string | undefined] {
    const parts = commandString.match(/^([^:]+)(:|$)(.*)$/);
    if (!parts) throw "Failed to parse command string";
    return [parts[1], parts[3]];
  }

  bind(sequence: string, commandString: string, help: string) {
    const { mode, codes } = KeyBinder.parseSequence(sequence);
    const [command, args] = KeyBinder.parseCommandString(commandString);
    if (!this.modes[mode]) this.modes[mode] = KeyBinder.createDefaultMode();

    let node: Node = this.modes[mode].root;
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
    (node as LeafNode | CommandNode).command = command;
    (node as LeafNode | CommandNode).help = help;
    (node as LeafNode | CommandNode).args = args;
    //console.log(command, args);
  }

  bindKeys(sequence: string, command: string, mode: string, args?: any) {
    const codes = KeyBinder.parseKeySequence(sequence);
    if (!codes) throw "Invalid key sequence";
    if (!this.modes[mode]) this.modes[mode] = KeyBinder.createDefaultMode();

    let node: Node = this.modes[mode].root;
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
    (node as LeafNode | CommandNode).command = command;
    (node as LeafNode | CommandNode).args = args;
  }

  static createDefaultMode(): Mode {
    const mode: Partial<Mode> = {
      root: {
        nodes: {},
        root: true,
      },
    };
    return mode as Mode;
  }
}

function hasCommand(node: Node): node is CommandNode | LeafNode {
  if ((node as CommandNode | LeafNode).command) return true;
  return false;
}

function isRoot(node: Node): node is Root {
  if ((node as Root).root) return true;
  return false;
}

function isLeaf(node: Node): node is LeafNode {
  for (const k in node.nodes) return false;
  return true;
}

function isEmpty(obj: any): Boolean {
  if (!obj) return true;
  for (const k in obj) return false;
  return true;
}

class Macro {
  static RegisterKeys = "abcdefghijklmnopqrstuvwxyz";
  // registers are locations where events are stored
  registers: RegisterState = {};

  // The selected register will be used as the target when a replay or record
  // event occurs. I.e. <q><q> or <Shift-@><q>
  selected: string = "";

  // If true, all events get record except replay events while recording and
  // the trailing end macro event when ending a recording
  recording: boolean = false;

  // While recording, this get's incremented for every replayed command. This way when an interrupt
  // occurs the count when it happened can be recorded so that replays are still deterministic
  commandCount: number = 0;
  interrupts: Record<number, number> = {};

  // If true, incoming chunks don't get processed until the replay is complete
  replaying: boolean = false;

  interrupt: boolean | number = false;

  // All the events that came in while a replay was running or a
  // consumer was blocking
  buffer: VLKEvent[] = [];

  // True while waiting for event to be processed downstream, blocks further
  // processing of events / macro replays
  busy: boolean = false;
  // Whatever register was selected when record-macro occured
  recordingTarget = "";

  // When a macro recording is started, the keybindings tree is modified to
  normalKeybindings!: Node;
  recordingKeybindings!: Node;

  // How many times to repeat any command that is coming through. Done by macro controller
  // because of how repeating macros need to function
  repeatCount: number = 0;

  send: (event: VLKEvent) => void | Promise<void> = console.log;
  vlk!: KeyBinder;

  constructor(vlk: KeyBinder) {
    this.vlk = vlk;

    /** Change keybindings during macro recording */
    const normalKeybindings = vlk.modes["normal"].root.nodes["<q>"];
    const recordingKeybindings = { nodes: {}, command: "vlk-macro-record-end" };
    this.vlk.bindSystemHandler("vlk-macro-record-start", function () {
      vlk.modes["normal"].root.nodes["<q>"] = recordingKeybindings;
    });
    this.vlk.bindSystemHandler("vlk-macro-record-end", function () {
      vlk.modes["normal"].root.nodes["<q>"] = normalKeybindings;
    });

    this.vlk.bindSystemHandler("set-mode", function (mode: string) {
      if (vlk.modes[mode]) {
        vlk.state.mode = mode;
        vlk.state.position = vlk.modes[mode].root;
      } else {
        console.log(`Mode "${mode}" does not exist`);
      }
    });
  }

  /**
   * Serialize macros that are currently recorded
   * @TODO decide on what to serialize and limitations, e.g. recording state, repeat count, etc
   */
  serialize() {
    console.log(JSON.stringify(this.registers, null, 2));
  }

  /** Counterpart to serialize */
  load(registerState: Record<string, VLKEvent[]>) {
    this.registers = registerState;
  }

  /**
   * Runs any system handler registered for a command. This is the only place
   * Macro calls back into keybinder state, and it runs before the command is
   * sent on.
   *
   * Only replayed commands reach here. A command from a live keypress already
   * ran its handler inside KeyBinder.takeAction, during the walk, so that a
   * rebind or mode switch is in effect before the next key is read. Replayed
   * commands come from a register and never pass through there.
   */
  runSystemHandler(command: string, args?: string | number) {
    // @TODO implement a better way of doing the system handlers
    if (this.vlk.handlers[command]) {
      this.vlk.handlers[command].call(this.vlk, args);
    }
  }

  /**
   * Advances the instruction count and picks up any interrupt scheduled at the
   * new position. Counting only happens during a replay or a recording, and
   * interrupts themselves are not counted.
   */
  countCommand(command: string) {
    if ((this.replaying || this.recording) && command !== "vlk-macro-interrupt-at") {
      this.commandCount++;
    }
    if (this.interrupts[this.commandCount]) {
      /**
       * The interrupt actually needs more info:
       * 1. that it is a interrupt-at
       * 2. the depth of the interrupt
       */
      this.interrupt = this.interrupts[this.commandCount];
    }
  }

  /**
   * Called for any action coming from keybinder and when replaying or repeating
   * commands by count register or macro replay
   */
  async takeAction({ command, args }: VLKEvent, depth = 0, replayed = false) {
    if (replayed) this.runSystemHandler(command, args);
    this.countCommand(command);
    //if (this.replaying) await sleep(20);
    const count = this.repeatCount > 0 ? this.repeatCount : 1;
    switch (command) {
      case "vlk-macro-interrupt-at":
        /**
         * Schedule an interrupt at the specified position.
         */
        if (this.replaying /* This should always be true */) {
          const count = Number(args);
          this.interrupts[count + this.commandCount] = depth;
        } else {
          throw "Cannot schedule an interrupt outside of a macro replay";
        }
        return;
      case "vlk-macro-serialize":
        this.serialize();
        return;
      case "vlk-unbound-key":
        /**
         * vlk-unbound-key is emitted when a key press matched nothing on either
         * tree. It clears the count register.
         * TBD if it should be consumed or not.
         */
        this.repeatCount = 0;
        await this.send({ command: "vlk-macro-state-change" });
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
        await this.send({ command: "vlk-macro-state-change" });
        return;
      case "vlk-macro-record-start":
        // Start recording
        this.repeatCount = 0;
        this.commandCount = 0;
        if (this.recording) throw "Cannot start a recording while recording a macro";
        this.recording = true;
        this.recordingTarget = `${args}`;
        this.registers[this.recordingTarget] = [];
        await this.send({ command: "vlk-macro-state-change" });
        return;
      case "vlk-macro-record-end":
        // Stop the current recording
        this.commandCount = 0;
        this.registers[this.recordingTarget].pop();
        this.recording = false;
        await this.send({ command: "vlk-macro-state-change" });
        return;
      case "vlk-macro-replay":
        this.repeatCount = 0;
        // When no macro is specified, use the last run macro
        if (!args) args = this.selected;
        this.selected = `${args}`;
        for (let i = 0; i < count; i++) {
          await this.replayMacro(`${args}`, depth + 1);
        }
        return;
      default: {
        /**
         * All non-macro related events, pass them on to the next consumer
         * `count` times. Each repetition after the first re-runs the
         * bookkeeping, so an interrupt scheduled part way through a repeat
         * lands on the right instruction and stops the rest.
         */
        let remaining = count;
        while (true) {
          await this.send({ command, args });
          if (--remaining === 0 || this.interrupt) break;
          this.countCommand(command);
        }
        this.repeatCount = 0;
        return;
      }
    }
  }

  handleUserEvent(event: VLKEvent) {
    if (this.busy && event.command !== "vlk-macro-interrupt") {
      this.buffer.push(event);
      return;
    }
    const macroEvent = {
      command: event.command,
      args: event.args,
    };

    switch (event.command) {
      case "vlk-macro-interrupt":
        /**
         * If a replay is currently being run, set the interrupt flag so that no more instructions
         * from that replay get processed. If recording unshift an interrupt command to the
         * start of the macro that schedules an interrupt to occur at the correct command count to
         * keep macro replay deterministic. Clear any buffered input.
         */
        if (this.replaying) {
          this.interrupt = true;
          if (this.recording) {
            this.registers[this.recordingTarget].unshift({
              command: "vlk-macro-interrupt-at",
              args: this.commandCount,
            });
          }
          this.buffer = [];
        }
        return;
      case "vlk-macro-replay":
        /**
         * Start a replay by setting replay flag to true and sending the replay event to the command
         * handler. User input will be buffered until the replay completes.
         */
        this.busy = true;
        this.replaying = true;
        if (this.recording) this.registers[this.recordingTarget].push(macroEvent);
        if (!this.recording) this.commandCount = -1;
        /** If recording, do depth 1 to make depth limit the same as when replaying */
        this.takeAction(macroEvent, this.recording ? 1 : 0)
          .catch((err) => console.error("macro replay", err))
          .finally(() => {
            /**
             * Once the replay completes clear all flags and replay state variables,
             * then process all user input that occured while the replay was running
             */
            this.interrupt = false;
            this.interrupts = {};
            this.replaying = false;
            this.finishDispatch();
          });
        return;
      default:
        if (this.recording) this.registers[this.recordingTarget].push(macroEvent);
        this.busy = true;
        this.takeAction(macroEvent)
          .catch((err) => console.error("macro dispatch", err))
          .finally(() => this.finishDispatch());
    }
  }

  /**
   * Clears the in flight flag and processes anything that arrived while it was
   * set. Dispatching a buffered event sets the flag again, so the drain stops
   * there and resumes when that dispatch completes.
   */
  finishDispatch() {
    this.busy = false;
    while (this.buffer.length && !this.busy) this.handleUserEvent(this.buffer.shift()!);
  }

  async replayMacro(macro: string, depth: number) {
    if (depth > 4) {
      console.log("Max macro depth reached, not replaying");
      return;
    }
    //for (const event of this.registers[macro] ?? []) {
    for (let i = 0; i < (this.registers[macro] ?? []).length; i++) {
      const event = this.registers[macro][i];
      if (this.interrupt === false) {
        // No interrupt, proceed as normal
        await this.takeAction(event, depth, true);
      } else if (this.interrupt === true) {
        // Hard interrupt, always abort
        return;
      } else {
        // Interrupt until a certain depth is reached
        if (depth > this.interrupt) return;
        else if (depth === this.interrupt) {
          await this.takeAction(event, depth, true);
          this.interrupt = false;
        }
      }
    }
  }

  /**
   * Attaches the macro system to the keybinder stream output
   *
   * limits processing speed by waiting for consumer to read, so that interrupts
   * can function when consumer is slow to process events. macro replay
   * doesn't build up a massive number of queued actions
   */
  attachTransformer(kb: KeyBinder) {
    const macro = this;
    const output = new TransformStream<VLKEvent, VLKEvent>();
    const writer = output.writable.getWriter();

    this.send = async (event: VLKEvent) => {
      await writer.ready;
      return writer.write(event);
    };

    kb.stream
      .pipeTo(
        new WritableStream({
          write(event: VLKEvent) {
            macro.handleUserEvent(event);
          },
        }),
      )
      .catch((err) => console.error("keybinder input stream", err));

    kb.stream = output.readable;
  }
}

async function sleep(ms: number) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}
