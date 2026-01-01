(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const n of i.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function t(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(r){if(r.ep)return;r.ep=!0;const i=t(r);fetch(r.href,i)}})();const h={Shift:!0,Control:!0,Alt:!0,Meta:!0};class l{stream;streamController;modes;state;macro;constructor(){this.modes={normal:l.createDefaultMode()},this.state={position:this.modes.normal.root,mode:"normal",lastCodeWasValid:!1,debug:{lastAction:"",lastKeyCode:""}},this.stream=this.initializeOutputStream(),this.macro=new c,this.macro.attachTransformer(this)}async*[Symbol.asyncIterator](){const e=this.stream.getReader();for(;;){const{value:t,done:s}=await e.read();if(t&&(yield t),s)break}}initializeOutputStream(){const e=this;return new ReadableStream({start(t){e.streamController=t},pull(t){},cancel(){}})}handleKeyEvent(e){if(h[e.key])return;const t=l.keybordEventToCode(e);if(!t)return;this.keyPress(t)&&e.preventDefault()}keyPress(e){this.state.debug.lastKeyCode=e;let t=!1;{const{command:s,args:r,nodes:i}=this.state.position;if(i[e])this.state.position=i[e],t=!0;else{if(s)return this.takeAction(s,r),this.moveToRootOfCurrentMode(),this.keyPress(e);if(this.state.position!==this.modes[this.state.mode].root)return this.moveToRootOfCurrentMode(),this.keyPress(e)}}{const{command:s,args:r,nodes:i}=this.state.position;if(s&&d(i))this.moveToRootOfCurrentMode(),this.takeAction(s,r);else if(!(s&&!d(i))){if(!(!s&&!d(i)))throw this.moveToRootOfCurrentMode(),"Somehow ended up at a node with no command and no nodes"}}return!t&&this.state.lastCodeWasValid?(this.takeAction("vlk-noop"),this.state.lastCodeWasValid=!1):t&&(this.state.lastCodeWasValid=!0),t}enumerateCurrentActions(){for(const e in this.state.position.nodes)console.log(e)}static keybordEventToCode(e){let t=e.key;return h[e.key]?"":(e.ctrlKey&&(t="Ctrl-"+t),e.shiftKey&&(t="Shift-"+t),e.altKey&&(t="Alt-"+t),e.metaKey&&(t="Meta-"+t),`<${t}>`)}moveToRootOfCurrentMode(){this.state.position=this.modes[this.state.mode].root}takeAction(e,t){this.state.debug.lastAction=`${e} ${t??""}`,this.streamController?.enqueue({command:e,args:t})}static parseKeySequence(e){const t={escape:!1,open:!1,key:""},s=[];for(const r of e)t.escape?(t.key+=r,t.escape=!1):!t.open&&r==="<"?(t.open=!0,t.key=r):t.open&&r===">"?(t.open=!1,t.key+=r,s.push(t.key)):t.open&&r==="\\"?t.escape=!0:t.open&&(t.key+=r);return!s||!s.length?!1:s}bindKeys(e,t,s,r){const i=l.parseKeySequence(e);if(!i)throw"Invalid key sequence";this.modes[s]||(this.modes[s]=l.createDefaultMode());let n=this.modes[s].root;for(const a of i)n.nodes[a]||(n.nodes[a]={nodes:{}}),n=n.nodes[a];n.command=t,n.args=r}static createDefaultMode(){return{root:{nodes:{}}}}}function d(o){if(!o)return!0;for(const e in o)return!1;return!0}class c{static RegisterKeys="abcdefghijklmnopqrstuvwxyz";registers={};selected="";recording=!1;replaying=!1;buffer=[];recordingTarget="";normalKeybindings;recordingKeybindings;repeatCount=0;test={recording:!1,replaying:!1};send=console.log;vlk;constructor(){}bindRepeatKeys(e,t="normal"){this.vlk=e;for(let s=0;s<10;s++)e.bindKeys(`<${s}>`,"vlk-macro-update-repeat",t,[s])}bindKeys(e,t="normal"){e.bindKeys("<Shift-@><s-@>","vlk-macro-replay",t);for(const s of c.RegisterKeys)e.bindKeys(`<q><${s}>`,"vlk-macro-start-recording",t,s),e.bindKeys(`<Shift-@><${s}>`,"vlk-macro-replay",t,s);this.normalKeybindings=e.modes.normal.root.nodes["<q>"],this.recordingKeybindings={nodes:{},command:"vlk-macro-end-recording"}}async takeAction({command:e,args:t},s=0){const r=this.repeatCount>0?this.repeatCount:1;switch(this.replaying&&await g(20),e){case"vlk-noop":this.repeatCount=0,this.send({command:"vlk-macro-state-change"});return;case"vlk-macro-update-repeat":const i=Number(t);isNaN(i)||(this.repeatCount=this.repeatCount*10+i,this.repeatCount>1e4&&(this.repeatCount=1e4)),this.send({command:"vlk-macro-state-change"});return;case"vlk-macro-start-recording":if(this.repeatCount=0,this.recording)throw"Cannot start a recording while recording a macro";this.recording=!0,this.recordingTarget=`${t}`,this.registers[this.recordingTarget]=[],this.vlk.modes.normal.root.nodes["<q>"]=this.recordingKeybindings,this.send({command:"vlk-macro-state-change"});return;case"vlk-macro-end-recording":this.registers[this.recordingTarget].pop(),this.recording=!1,this.vlk.modes.normal.root.nodes["<q>"]=this.normalKeybindings,this.send({command:"vlk-macro-state-change"});return;case"vlk-macro-replay":if(this.repeatCount=0,s<4)for(let n=0;n<r;n++)await this.replayMacro(`${t}`,s+1);else console.log("ERR: Max macro replay depth reached");return;default:this.repeatCount=0;for(let n=0;n<r;n++)this.send({command:e,args:t})}}async replayMacro(e,t){for(const s of this.registers[e]??[])await this.takeAction(s,t)}attachTransformer(e){this.bindKeys(e),this.bindRepeatKeys(e);const t=this,s=new TransformStream({start(r){t.send=i=>{r.enqueue(i)}},transform(r){t.replaying?t.buffer.push(r):r.command==="vlk-macro-replay"?(t.replaying=!0,t.takeAction(r).then(async()=>{for(;t.buffer.length;)await t.takeAction(t.buffer.shift());t.replaying=!1,t.recording&&t.registers[t.recordingTarget].push(r)})):(t.recording&&t.registers[t.recordingTarget].push(r),t.takeAction(r))}});e.stream=e.stream.pipeThrough(s)}}async function g(o){return new Promise(e=>{setTimeout(e,o)})}const m=`<style>
  #app {
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: fit-content;
  }
  #container {
    overflow: hidden;
    height: 500px;
    width: 700px;
    border-radius: 5px;
    border-radius: 5px;
    padding: 10px;
    border: 2px solid black;
    border: 2px solid black;
    background-color: lightgray;
    box-sizing: content-box;
  }
  #container:focus {
    border: 2px solid blue;
  }
  #cursor {
    position: relative;
    width: 25px;
    height: 25px;
    background-color: green;
    border-radius: 5px;
    transition-property: left, top, width, height;
    transition-duration: 0.1s, 0.1s, 0.5s, 0.5s;
  }
  #state-display {
    background-color: lightgray;
    border-radius: 5px;
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
    grid-template-rows: repeat(7, 1fr);
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
  <div id="container" tabindex="0">
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

      <div class="selected" style="grid-column: 1"></div>
      <div style="grid-column: 2 / 4">
        = Defined
      </div>
      <div class="register-label"></div>
      <div style="grid-column: 5 / 7">
        = Empty
      </div>
    </div>
  </div>
</div>
`;class p extends HTMLElement{shadow;vlk;state={x:0,y:0,zoomed:!1};constructor(){super(),this.vlk=new l,this.watchVlkDebug(),this.setupKeybindings(),this.handleCommands()}watchVlkDebug(){const e=this.render.bind(this),t={set(r,i,n){const a=Reflect.set(r,i,n);return e(),a}},s=new Proxy(this.vlk.state.debug,t);this.vlk.state.debug=s}connectedCallback(){this.shadow=this.attachShadow({mode:"open"}),this.shadow.innerHTML=m,this.getOrThrow("container").addEventListener("keydown",e=>{this.vlk.handleKeyEvent(e)})}setupKeybindings({vlk:e}=this){e.bindKeys("<Shift-R>","debug","normal"),e.bindKeys("<Shift-H>","enumerate","normal"),e.bindKeys("<l>","move-right","normal"),e.bindKeys("<h>","move-left","normal"),e.bindKeys("<Shift-\\>>","move-right","normal"),e.bindKeys("<Shift-\\<>","move-left","normal"),e.bindKeys("<j>","move-down","normal"),e.bindKeys("<k>","move-up","normal"),e.bindKeys("<g><g>","move-home","normal"),e.bindKeys("<Shift-G>","move-end","normal"),e.bindKeys("<Ctrl-a><z>","zoom","normal")}async handleCommands(){for await(const e of this.vlk)this.commands[e.command]&&await this.commands[e.command].call(this,e),this.render()}commands={debug:e=>{console.log(this)},"move-right":this.move.bind(this,25,0),"move-left":this.move.bind(this,-25,0),"move-down":this.move.bind(this,0,25),"move-up":this.move.bind(this,0,-25),"move-home":()=>{this.state.x=0,this.state.y=0,this.render()},"move-end":()=>{this.state.x=675,this.state.y=475},zoom:this.zoom,enumerate:()=>{this.vlk.enumerateCurrentActions()}};render(){try{const e=this.getOrThrow("cursor"),{vlk:t}=this;this.state.zoomed?(e.style.left="0px",e.style.top="0px",e.style.width="700px",e.style.height="500px"):(e.style.left=`${this.state.x}px`,e.style.top=`${this.state.y}px`,e.style.width="25px",e.style.height="25px");const s=this.getOrThrow("recording");t.macro.recording?(s.innerHTML="true",s.style.backgroundColor="red"):(s.innerHTML="false",s.style.backgroundColor="lightgray");const r=t.state.debug;this.getOrThrow("mode").innerHTML=t.state.mode,this.getOrThrow("repeatCount").innerHTML=`${t.macro.repeatCount}`,this.getOrThrow("lastAction").innerHTML=r.lastAction,this.getOrThrow("lastKeyCode").innerHTML=r.lastKeyCode.replace(/</g,"&lt;");for(const i of this.shadow.querySelectorAll(".register")){const n=i.innerHTML;t.macro.registers[n]?.length?(i.classList.add("selected"),i instanceof HTMLElement&&(i.onclick=()=>{t.takeAction("vlk-macro-replay",n)})):i.classList.remove("selected")}}catch(e){console.log(e)}}getOrThrow(e){const t=this.shadow.getElementById(e);if(!t)throw`Missing element with id "${e}"`;return t}zoom(){this.state.zoomed=!this.state.zoomed}move(e,t){let{x:s,y:r}=this.state;this.state.zoomed=!1,s=s+e,r=r+t,s<0&&(s=0),r<0&&(r=0),s>675&&(s=675),r>475&&(r=475),this.state.x=s,this.state.y=r}}customElements.define("vlk-test",p);
