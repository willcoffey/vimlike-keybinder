(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&n(i)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();const h={Shift:!0,Control:!0,Alt:!0,Meta:!0};class d{stream;streamController;modes;state;handlers={};macro;constructor(e=!1){this.modes={global:d.createDefaultMode(),normal:d.createDefaultMode()},this.state={position:this.modes.normal.root,globalPosition:this.modes.global.root,mode:"normal",lastAction:null,debug:{lastAction:"",lastKeyCode:""}},this.stream=this.initializeOutputStream(),e&&this.setupKeybindings(),this.macro=new p(this),this.macro.attachTransformer(this)}setupKeybindings(){this.bind("global:<Shift-H>","enumerate","Show command help for current position"),this.bind("global:<Escape><Escape>","vlk-macro-interrupt","Abort the replay of any macros and clear all buffered input");for(let e=0;e<10;e++)this.bind(`normal:<${e}>`,`vlk-macro-update-repeat:${e}`,`Add a trailing ${e} to the repeat register`);this.bind("normal:<Shift-M><s>","vlk-macro-serialize","Log the serialized state of the macro registers to the console"),this.bind("normal:<Shift-@><Shift-@>","vlk-macro-replay","Replay the last run macro");for(const e of p.RegisterKeys)this.bind(`normal:<q><${e}>`,`vlk-macro-record-start:${e}`,`Record a macro in the '${e}' register`),this.bind(`normal:<Shift-@><${e}>`,`vlk-macro-replay:${e}`,`Replay the macro in the '${e}' register`)}async*[Symbol.asyncIterator](){const e=this.stream.getReader();for(;;){const{value:t,done:n}=await e.read();if(t&&(yield t),n)break}}bindSystemHandler(e,t){this.handlers[e]=t}initializeOutputStream(){const e=this;return new ReadableStream({start(t){e.streamController=t},pull(t){},cancel(){}})}handleKeyEvent(e){if(h[e.key])return;const t=d.keybordEventToCode(e);if(!t)return;const n=this.keyPress(t);return n&&e.preventDefault(),n}keyPress(e){this.state.debug.lastKeyCode=e;const t=d.resolveCursor(e,this.state.globalPosition,this.modes.global.root);let n=t.consumed;this.state.globalPosition=t.position;for(const r of t.events)this.takeAction(r.command,r.args);if(!t.claimed){const r=d.resolveCursor(e,this.state.position,this.modes[this.state.mode].root);n=n||r.consumed,this.state.position=r.position;for(const s of r.events)this.takeAction(s.command,s.args)}return!n&&this.state.lastAction?.command!=="vlk-unbound-key"&&this.takeAction("vlk-unbound-key"),n}static resolveCursor(e,t,n){const r=[];for(;;){const{event:s,replay:i,move:o}=d.determineNextAction(e,t);if(o==="branch"?t=t.nodes[e]:o==="default"&&(t=n),s&&r.push(s),!i){const a=!!s;return{position:t,events:r,claimed:a,consumed:a||o==="branch"}}}}static determineNextAction(e,t){if(t.nodes[e]){const n=t.nodes[e];return u(n)?{event:{command:n.command,args:n.args},replay:!1,move:"default"}:{event:!1,replay:!1,move:"branch"}}else return f(t)?{event:!1,replay:!1,move:!1}:g(t)?{event:{command:t.command,args:t.args},replay:!0,move:"default"}:{event:!1,replay:!0,move:"default"}}static moveToNode(e,t){const n=e.nodes?.[t];return n||!1}enumerateCurrentActions(e=this.state.position,t=""){const n=[];for(const r in e.nodes){const s=e.nodes[r];g(s)&&n.push({sequence:t+r,command:s.command,args:s.args,help:s.help}),u(s)||n.push.apply(n,this.enumerateCurrentActions(s,t+r))}return n}static keybordEventToCode(e){let t=e.key;return h[e.key]?"":(e.metaKey&&(t="Meta-"+t),e.altKey&&(t="Alt-"+t),e.shiftKey&&(t="Shift-"+t),e.ctrlKey&&(t="Ctrl-"+t),`<${t}>`)}takeAction(e,t){this.state.debug.lastAction=`${e} ${t??""}`,this.state.lastAction={command:e,args:t},this.handlers[e]&&this.handlers[e].call(this,t),this.streamController?.enqueue({command:e,args:t})}static parseKeySequence(e){const t={escape:!1,open:!1,key:""},n=[];for(const r of e)t.escape?(t.key+=r,t.escape=!1):!t.open&&r==="<"?(t.open=!0,t.key=r):t.open&&r===">"?(t.open=!1,t.key+=r,n.push(t.key)):t.open&&r==="\\"?t.escape=!0:t.open&&(t.key+=r);return!n||!n.length?!1:n}static parseSequence(e){e[0]==="<"&&(e="normal:"+e);const t={mode:"",codes:[]},n={escape:!1,open:!1,chunk:"",modeParsed:!1};for(const r of e)n.escape?(n.chunk+=r,n.escape=!1):r==="\\"?n.escape=!0:!n.modeParsed&&r===":"?(n.modeParsed=!0,t.mode=n.chunk,n.chunk=""):n.modeParsed?!n.open&&r==="<"?(n.open=!0,n.chunk=r):n.open&&r===">"?(n.open=!1,n.chunk+=">",t.codes.push(n.chunk)):n.open&&(n.chunk+=r):n.chunk+=r;return t}static parseCommandString(e){const t=e.match(/^([^:]+)(:|$)(.*)$/);if(!t)throw"Failed to parse command string";return[t[1],t[3]]}bind(e,t,n){const{mode:r,codes:s}=d.parseSequence(e),[i,o]=d.parseCommandString(t);this.modes[r]||(this.modes[r]=d.createDefaultMode());let a=this.modes[r].root;for(const l of s)a.nodes[l]||(a.nodes[l]={nodes:{}}),a=a.nodes[l];a.command=i,a.help=n,a.args=o}bindKeys(e,t,n,r){const s=d.parseKeySequence(e);if(!s)throw"Invalid key sequence";this.modes[n]||(this.modes[n]=d.createDefaultMode());let i=this.modes[n].root;for(const o of s)i.nodes[o]||(i.nodes[o]={nodes:{}}),i=i.nodes[o];i.command=t,i.args=r}static createDefaultMode(){return{root:{nodes:{},root:!0}}}}function g(c){return!!c.command}function f(c){return!!c.root}function u(c){for(const e in c.nodes)return!1;return!0}class p{static RegisterKeys="abcdefghijklmnopqrstuvwxyz";registers={};selected="";recording=!1;commandCount=0;interrupts={};replaying=!1;interrupt=!1;buffer=[];busy=!1;recordingTarget="";normalKeybindings;recordingKeybindings;repeatCount=0;send=console.log;vlk;constructor(e){this.vlk=e;const t=e.modes.normal.root.nodes["<q>"],n={nodes:{},command:"vlk-macro-record-end"};this.vlk.bindSystemHandler("vlk-macro-record-start",function(){e.modes.normal.root.nodes["<q>"]=n}),this.vlk.bindSystemHandler("vlk-macro-record-end",function(){e.modes.normal.root.nodes["<q>"]=t}),this.vlk.bindSystemHandler("set-mode",function(r){e.modes[r]?(e.state.mode=r,e.state.position=e.modes[r].root):console.log(`Mode "${r}" does not exist`)})}serialize(){console.log(JSON.stringify(this.registers,null,2))}load(e){this.registers=e}runSystemHandler(e,t){this.vlk.handlers[e]&&this.vlk.handlers[e].call(this.vlk,t)}countCommand(e){(this.replaying||this.recording)&&e!=="vlk-macro-interrupt-at"&&this.commandCount++,this.interrupts[this.commandCount]&&(this.interrupt=this.interrupts[this.commandCount])}async takeAction({command:e,args:t},n=0,r=!1){r&&this.runSystemHandler(e,t),this.countCommand(e);const s=this.repeatCount>0?this.repeatCount:1;switch(e){case"vlk-macro-interrupt-at":if(this.replaying){const o=Number(t);this.interrupts[o+this.commandCount]=n}else throw"Cannot schedule an interrupt outside of a macro replay";return;case"vlk-macro-serialize":this.serialize();return;case"vlk-unbound-key":this.repeatCount=0,await this.send({command:"vlk-macro-state-change"});return;case"vlk-macro-update-repeat":const i=Number(t);isNaN(i)||(this.repeatCount=this.repeatCount*10+i,this.repeatCount>1e4&&(this.repeatCount=1e4)),await this.send({command:"vlk-macro-state-change"});return;case"vlk-macro-record-start":if(this.repeatCount=0,this.commandCount=0,this.recording)throw"Cannot start a recording while recording a macro";this.recording=!0,this.recordingTarget=`${t}`,this.registers[this.recordingTarget]=[],await this.send({command:"vlk-macro-state-change"});return;case"vlk-macro-record-end":this.commandCount=0,this.registers[this.recordingTarget].pop(),this.recording=!1,await this.send({command:"vlk-macro-state-change"});return;case"vlk-macro-replay":this.repeatCount=0,t||(t=this.selected),this.selected=`${t}`;for(let o=0;o<s;o++)await this.replayMacro(`${t}`,n+1);return;default:{let o=s;for(;await this.send({command:e,args:t}),!(--o===0||this.interrupt);)this.countCommand(e);this.repeatCount=0;return}}}handleUserEvent(e){if(this.busy&&e.command!=="vlk-macro-interrupt"){this.buffer.push(e);return}const t={command:e.command,args:e.args};switch(e.command){case"vlk-macro-interrupt":this.replaying&&(this.interrupt=!0,this.recording&&this.registers[this.recordingTarget].unshift({command:"vlk-macro-interrupt-at",args:this.commandCount}),this.buffer=[]);return;case"vlk-macro-replay":this.busy=!0,this.replaying=!0,this.recording&&this.registers[this.recordingTarget].push(t),this.recording||(this.commandCount=-1),this.takeAction(t,this.recording?1:0).catch(n=>console.error("macro replay",n)).finally(()=>{this.interrupt=!1,this.interrupts={},this.replaying=!1,this.finishDispatch()});return;default:this.recording&&this.registers[this.recordingTarget].push(t),this.busy=!0,this.takeAction(t).catch(n=>console.error("macro dispatch",n)).finally(()=>this.finishDispatch())}}finishDispatch(){for(this.busy=!1;this.buffer.length&&!this.busy;)this.handleUserEvent(this.buffer.shift())}async replayMacro(e,t){if(t>4){console.log("Max macro depth reached, not replaying");return}for(let n=0;n<(this.registers[e]??[]).length;n++){const r=this.registers[e][n];if(this.interrupt===!1)await this.takeAction(r,t,!0);else{if(this.interrupt===!0)return;if(t>this.interrupt)return;t===this.interrupt&&(await this.takeAction(r,t,!0),this.interrupt=!1)}}}attachTransformer(e){const t=this,n=new TransformStream,r=n.writable.getWriter();this.send=async s=>(await r.ready,r.write(s)),e.stream.pipeTo(new WritableStream({write(s){t.handleUserEvent(s)}})).catch(s=>console.error("keybinder input stream",s)),e.stream=n.readable}}const v=[{command:"move-down"},{command:"move-right"},{command:"move-up"},{command:"move-left"}],y=[{command:"vlk-macro-interrupt-at",args:76},{command:"move-down"},{command:"move-right"},{command:"move-down"},{command:"move-right"},{command:"move-right"},{command:"move-right"},{command:"move-right"},{command:"move-down"},{command:"move-down"},{command:"move-down"},{command:"vlk-macro-replay",args:"q"},{command:"move-right"},{command:"move-right"},{command:"move-right"},{command:"vlk-macro-update-repeat",args:"3"},{command:"vlk-macro-replay",args:"q"},{command:"move-down"},{command:"move-down"},{command:"move-down"},{command:"move-down"},{command:"move-left"},{command:"move-left"},{command:"move-left"},{command:"vlk-macro-update-repeat",args:"1"},{command:"vlk-macro-update-repeat",args:"0"},{command:"vlk-macro-update-repeat",args:"0"},{command:"vlk-macro-update-repeat",args:"0"},{command:"vlk-macro-update-repeat",args:"0"},{command:"vlk-macro-replay",args:"q"},{command:"move-right"},{command:"move-right"},{command:"move-right"},{command:"move-down"},{command:"move-down"},{command:"move-right"},{command:"move-right"},{command:"vlk-macro-replay",args:"q"},{command:"move-down"},{command:"move-down"},{command:"move-right"},{command:"move-right"},{command:"move-down"},{command:"move-down"},{command:"move-down"},{command:"move-down"},{command:"move-down"},{command:"move-down"},{command:"move-right"},{command:"move-right"},{command:"move-right"},{command:"move-right"},{command:"move-right"},{command:"move-right"}],b={q:v,w:y},k=`<style>
  #app {
    margin: auto;
    display: grid;
    width: fit-content;
    height: 90vh;
    width: 90vw;
    grid-template-columns: 2fr 1fr;
    grid-template-rows: 3fr 1fr;
    gap: 10px;
  }
  #app > div {
    border-radius: 5px;
    border: 2px solid black;
    box-sizing: border-box;
  }
  #cursor-box {
    display: grid;
    grid-gap: 5px;
    grid-template-rows: repeat(21, 1fr);
    grid-template-columns: repeat(21, 1fr);
    overflow: hidden;
    padding: 10px;
    background-color: darkgrey;
  }
  #cursor-box:focus {
    border: 2px solid blue;
  }
  #cursor {
    position: relative;
    grid-row: 1;
    grid-column: 1;
    width: 100%;
    height: 100%;
    background-color: green;
    border-radius: 5px;
  }
  #help {
    display: grid;
    background-color: lightgray;
    grid-template-columns: 1fr 3fr;
    grid-auto-rows: max-content;
    gap: 5px;
    height: 100%;
    overflow-y: scroll;
    grid-row: span 2;
    padding: 10px;
  }
  #help > div {
    border-radius: 2px;
  }
  .key-code {
    padding: 10px;
    font-family: monospace;
    font-size: 1.2em;
    border: 2px solid darkgrey;
  }
  .help-seperator {
    background-color: darkgrey;
    text-align: center;
    font-family: arial;
    font-size: 1.5em;
    grid-column: 1 / 3;
    padding: 2px;
    border-radius: 5px;
  }
  .help-text {
    border: 2px solid darkgrey;
    padding: 2px;
  }
  #state-display {
    grid-row: 2;
    background-color: lightgray;
    border: 2px solid black;
    padding: 10px;
    display: grid;
    gap: 5px;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(2, 1fr);
  }

  #state-display > div {
    border: 1px solid darkgray;
    border-radius: 5px;
    overflow: hidden;
  }
  #registers {
    display: grid;
    padding: 2px;
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: 1fr repeat(5, max-content) 1fr;
    grid-column: 4 / 6;
    grid-row: 1 / 3;
    gap: 2px;
  }
  #registers > div {
    overflow: hidden;
    font-family: monospace;
    text-align: center;
    color: #fff;
    font-weight: bolder;
    padding: 0px;
    border-radius: 2px;
  }

  .register-label {
    background-color: darkgray;
  }
  .selected {
    background-color: green;
    cursor: pointer;
  }
  .last-used {
    border: 2px solid orange;
  }
  #register-header {
    grid-column: 1 / 7;
    font-family: arial;
    background-color: black;
  }
  .single-property {
    display: flex;
    flex-direction: column;
  }
  .big-label {
    width: 100%;
    font-family: arial;
    font-size: 0.8em;
    text-align: center;
    background-color: darkgray;
    font-weight: bold;
  }
  .property {
    font-family: monospace;
    width: 100%;
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
<div id="app">
  <div id="cursor-box" tabindex="0">
    <div id="cursor"></div>
  </div>
  <div id="state-display">
    <div class="single-property">
      <div class="big-label">Mode</div>
      <div class="property" id="mode"></div>
    </div>

    <div class="single-property">
      <div class="big-label">Repeat Count</div>
      <div class="property" id="repeatCount"></div>
    </div>

    <div class="single-property" style="grid-column: 2/4; grid-row: 1/2">
      <div class="big-label">Last Action</div>
      <div class="property" id="lastAction"></div>
    </div>

    <div class="single-property">
      <div class="big-label">Recording Macro</div>
      <div class="property" id="recording"></div>
    </div>

    <div class="single-property">
      <div class="big-label">Last Key Code</div>
      <div class="property" id="lastKeyCode"></div>
    </div>

    <div id="registers">
      <div id="register-header">Macros - click to play</div>

      <div class="register-label register">a</div>
      <div class="register-label register">b</div>
      <div class="register-label register">c</div>
      <div class="register-label register">d</div>
      <div class="register-label register">e</div>
      <div class="register-label register">f</div>
      <div class="register-label register">g</div>
      <div class="register-label register">h</div>
      <div class="register-label register">i</div>
      <div class="register-label register">j</div>
      <div class="register-label register">k</div>
      <div class="register-label register">l</div>
      <div class="register-label register">m</div>
      <div class="register-label register">n</div>
      <div class="register-label register">o</div>
      <div class="register-label register">p</div>
      <div class="register-label register">q</div>
      <div class="register-label register">r</div>
      <div class="register-label register">s</div>
      <div class="register-label register">t</div>
      <div class="register-label register">u</div>
      <div class="register-label register">v</div>
      <div class="register-label register">w</div>
      <div class="register-label register">x</div>
      <div class="register-label register">y</div>
      <div class="register-label register">z</div>

      <div class="selected" style="grid-column: 1 / 4">
        Defined
      </div>
      <div class="register-label" style="grid-column: 4 / 7">
        Empty
      </div>
    </div>
  </div>
  <div id="help">
    <div class="help-seperator">Global Bindings</div>
    <div class="key-code">&lt;Shift-H&gt;</div>
    <div class="help-text">Show the keybindings for the current position in the binding tree</div>
    <div class="key-code">&lt;Shift-H&gt;</div>
    <div class="help-text">Show the keybindings for the current position in the binding tree</div>
    <div class="key-code">&lt;Shift-H&gt;</div>
    <div class="help-text">
      This is a very long help message in order to confirm that the flex box works. Let's hope it's
      still readable and not annoying. Show the keybindings for the current position in the binding
      tree
    </div>
    <div class="key-code">&lt;Shift-H&gt;</div>
    <div class="help-text">
      This is a very long help message in order to confirm that the flex box works. Let's hope it's
      still readable and not annoying. Show the keybindings for the current position in the binding
      tree
    </div>
    <div class="help-seperator">Position Bindings</div>
    <div class="key-code">&lt;Shift-H&gt; &lt;Shift-H&gt; &lt;Shift-H&gt;</div>
    <div class="help-text">
      This is a very long help message in order to confirm that the flex box works. Let's hope it's
      still readable and not annoying. Show the keybindings for the current position in the binding
      tree
    </div>
    <div class="key-code">&lt;Shift-H&gt;</div>
    <div class="help-text">
      This is a very long help message in order to confirm that the flex box works. Let's hope it's
      still readable and not annoying. Show the keybindings for the current position in the binding
      tree
    </div>
    <div class="key-code">&lt;Shift-H&gt;</div>
    <div class="help-text">
      This is a very long help message in order to confirm that the flex box works. Let's hope it's
      still readable and not annoying. Show the keybindings for the current position in the binding
      tree
    </div>
  </div>
</div>
`,w=c=>new Promise(e=>setTimeout(e,c)),x=30;class C extends HTMLElement{shadow;vlk;state={x:0,y:0,zoomed:!1};constructor(){super(),this.vlk=new d(!0),this.watchVlkDebug(),this.setupKeybindings(),this.handleCommands(),this.loadMacroState()}loadMacroState(){this.vlk.macro.load(b)}watchVlkDebug(){const e=this.render.bind(this),t={set(r,s,i){const o=Reflect.set(r,s,i);return e(),o}},n=new Proxy(this.vlk.state.debug,t);this.vlk.state.debug=n}connectedCallback(){this.shadow=this.attachShadow({mode:"open"}),this.shadow.innerHTML=k,this.getOrThrow("cursor-box").addEventListener("keydown",e=>{this.vlk.handleKeyEvent(e)&&this.render()}),this.vlk.takeAction("vlk-macro-replay","w")}setupKeybindings({vlk:e}=this){e.bind("<Shift-R>","debug","normal"),e.bindKeys("<l>","move-right","normal"),e.bindKeys("<h>","move-left","normal"),e.bindKeys("<Shift-\\>>","move-right","normal"),e.bindKeys("<Shift-\\<>","move-left","normal"),e.bindKeys("<j>","move-down","normal"),e.bindKeys("<k>","move-up","normal"),e.bindKeys("<g><g>","move-home","normal"),e.bindKeys("<Shift-G>","move-end","normal"),e.bindKeys("<Ctrl-a><z>","zoom","normal")}async handleCommands(){for await(const e of this.vlk)this.commands[e.command]&&await this.commands[e.command].call(this,e),this.render(),await w(x)}commands={debug:e=>{console.log(this.vlk.macro.registers)},"move-right":this.move.bind(this,1,0),"move-left":this.move.bind(this,-1,0),"move-down":this.move.bind(this,0,1),"move-up":this.move.bind(this,0,-1),"move-home":()=>{this.state.x=0,this.state.y=0,this.render()},"move-end":()=>{this.state.x=20,this.state.y=20},zoom:this.zoom,enumerate:this.enumerateCurrentBindings};enumerateCurrentBindings(){const e=this.vlk.enumerateCurrentActions(),t=this.vlk.enumerateCurrentActions(this.vlk.state.globalPosition),n=this.getOrThrow("help");n.innerHTML="";const r=document.createElement("div");r.classList.add("help-seperator"),r.textContent="Global Bindings",n.appendChild(r);for(const{command:i,help:o,sequence:a}of t){const l=document.createElement("div"),m=document.createElement("div");l.classList.add("key-code"),m.classList.add("help-text"),l.textContent=a,m.textContent=o,n.appendChild(l),n.appendChild(m)}const s=document.createElement("div");s.classList.add("help-seperator"),s.textContent="Position Bindings",n.appendChild(s);for(const{command:i,help:o,sequence:a}of e){const l=document.createElement("div"),m=document.createElement("div");l.classList.add("key-code"),m.classList.add("help-text"),l.textContent=a,m.textContent=o,n.appendChild(l),n.appendChild(m)}}render(){console.log("Render"),this.enumerateCurrentBindings();try{const e=this.getOrThrow("cursor"),{vlk:t}=this;this.state.zoomed?(e.style.gridColumn="1 / 22",e.style.gridRow="1 / 22"):(e.style.gridColumn=`${this.state.x+1}`,e.style.gridRow=`${this.state.y+1}`);const n=this.getOrThrow("recording");t.macro.recording?(n.innerHTML="true",n.style.backgroundColor="red"):(n.innerHTML="false",n.style.backgroundColor="lightgray");const r=t.state.debug;this.getOrThrow("mode").innerHTML=t.state.mode,this.getOrThrow("repeatCount").innerHTML=`${t.macro.repeatCount}`,this.getOrThrow("lastAction").innerHTML=r.lastAction,this.getOrThrow("lastKeyCode").innerHTML=r.lastKeyCode.replace(/</g,"&lt;");for(const s of this.shadow.querySelectorAll(".register")){const i=s.innerHTML;t.macro.registers[i]?.length?(s.classList.add("selected"),s instanceof HTMLElement&&(s.onclick=()=>{t.takeAction("vlk-macro-replay",i)})):s.classList.remove("selected")}}catch(e){console.log(e)}}getOrThrow(e){const t=this.shadow.getElementById(e);if(!t)throw`Missing element with id "${e}"`;return t}zoom(){this.state.zoomed=!this.state.zoomed}move(e,t){let{x:n,y:r}=this.state;this.state.zoomed=!1,n=n+e,r=r+t,n<0&&(n=0),r<0&&(r=0),n>20&&(n=20),r>20&&(r=20),this.state.x=n,this.state.y=r}}customElements.define("vlk-test",C);
