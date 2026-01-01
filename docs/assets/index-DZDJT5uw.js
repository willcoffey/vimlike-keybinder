(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const n of i.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function t(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(r){if(r.ep)return;r.ep=!0;const i=t(r);fetch(r.href,i)}})();const h={Shift:!0,Control:!0,Alt:!0,Meta:!0};class a{stream;streamController;modes;state;macro;constructor(){this.modes={normal:a.createDefaultMode()},this.state={position:this.modes.normal.root,mode:"normal",lastCodeWasValid:!1,debug:{lastAction:"",lastKeyCode:""}},this.stream=this.initializeOutputStream(),this.macro=new c,this.macro.attachTransformer(this)}initializeOutputStream(){const e=this;return new ReadableStream({start(t){e.streamController=t},pull(t){},cancel(){}})}browserKeyUp(e){if(h[e.key])return;const t=a.keybordEventToCode(e);if(e.preventDefault(),!!t)return this.keyPress(t)}keyPress(e){this.state.debug.lastKeyCode=e;let t=!1;{const{action:s,args:r,nodes:i}=this.state.position;if(i[e])this.state.position=i[e],t=!0;else{if(s)return this.takeAction(s,r),this.moveToRootOfCurrentMode(),this.keyPress(e);if(this.state.position!==this.modes[this.state.mode].root)return this.moveToRootOfCurrentMode(),this.keyPress(e)}}{const{action:s,args:r,nodes:i}=this.state.position;if(s&&l(i))this.moveToRootOfCurrentMode(),this.takeAction(s,r);else if(!(s&&!l(i))){if(!(!s&&!l(i)))throw this.moveToRootOfCurrentMode(),"Somehow ended up at a node with no action and no nodes"}}return!t&&this.state.lastCodeWasValid?(this.takeAction("vlk-noop"),this.state.lastCodeWasValid=!1):t&&(this.state.lastCodeWasValid=!0),t}enumerateCurrentActions(){for(const e in this.state.position.nodes)console.log(e)}static keybordEventToCode(e){let t=e.key;return h[e.key]?"":(e.ctrlKey&&(t="Ctrl-"+t),e.shiftKey&&(t="Shift-"+t),e.altKey&&(t="Alt-"+t),e.metaKey&&(t="Meta-"+t),`<${t}>`)}moveToRootOfCurrentMode(){this.state.position=this.modes[this.state.mode].root}takeAction(e,t){this.state.debug.lastAction=`${e} ${t??""}`,this.streamController?.enqueue({action:e,args:t})}bindKeys(e,t,s,r){const i=a.parseKeySequence(t);if(!i)throw"Invalid key sequence";this.modes[e]||(this.modes[e]=a.createDefaultMode());let n=this.modes[e].root;for(const o of i)n.nodes[o]||(n.nodes[o]={nodes:{}}),n=n.nodes[o];n.action=s,n.args=r}static parseKeySequence(e){const t=e.match(/<.*?>/g);return!t||!t.length?!1:t}bindCodeSequence(e,t,s,r){const i=e.match(/<.*?>/g);if(!i||!i.length)return;this.modes[s]||(this.modes[s]=a.createDefaultMode());let n=this.modes[s].root;for(const o of i)n.nodes?.[o]||(n.nodes=n.nodes??{},n.nodes[o]={nodes:{},args:r}),n=n.nodes[o];n.action=t}bindSequence(e,t,s){const r=e.match(/<.*?>/g);if(!r||!r.length)return;this.modes[s]||(this.modes[s]=a.createDefaultMode());let i=this.modes[s].root;for(const n of r)i.nodes?.[n]||(i.nodes=i.nodes??{},i.nodes[n]={nodes:{}}),i=i.nodes[n];i.action=t}static createDefaultMode(){return{root:{nodes:{}}}}}function l(d){if(!d)return!0;for(const e in d)return!1;return!0}class c{static RegisterKeys="abcdefghijklmnopqrstuvwxyz";registers={};selected="";recording=!1;replaying=!1;buffer=[];recordingTarget="";normalKeybindings;recordingKeybindings;repeatCount=0;test={recording:!1,replaying:!1};send=console.log;vlk;constructor(){}bindRepeatKeys(e,t="normal"){this.vlk=e;for(let s=0;s<10;s++)e.bindCodeSequence(`<${s}>`,"vlk-macro-update-repeat",t,[s])}bindKeys(e,t="normal"){e.bindKeys(t,"<Shift-@><s-@>","vlk-macro-replay");for(const s of c.RegisterKeys)e.bindKeys("normal",`<q><${s}>`,"vlk-macro-start-recording",s),e.bindKeys("normal",`<Shift-@><${s}>`,"vlk-macro-replay",s);this.normalKeybindings=e.modes.normal.root.nodes["<q>"],this.recordingKeybindings={nodes:{},action:"vlk-macro-end-recording"}}async takeAction({action:e,args:t},s=0){const r=this.repeatCount>0?this.repeatCount:1;switch(this.replaying&&await g(20),e){case"vlk-noop":this.repeatCount=0,this.send({action:"vlk-macro-state-change"});return;case"vlk-macro-update-repeat":const i=Number(t);isNaN(i)||(this.repeatCount=this.repeatCount*10+i,this.repeatCount>1e4&&(this.repeatCount=1e4)),this.send({action:"vlk-macro-state-change"});return;case"vlk-macro-start-recording":if(this.repeatCount=0,this.recording)throw"Cannot start a recording while recording a macro";this.recording=!0,this.recordingTarget=`${t}`,this.registers[this.recordingTarget]=[],this.vlk.modes.normal.root.nodes["<q>"]=this.recordingKeybindings,this.send({action:"vlk-macro-state-change"});return;case"vlk-macro-end-recording":this.registers[this.recordingTarget].pop(),this.recording=!1,this.vlk.modes.normal.root.nodes["<q>"]=this.normalKeybindings,this.send({action:"vlk-macro-state-change"});return;case"vlk-macro-replay":if(this.replaying=!0,this.repeatCount=0,s<20)for(let n=0;n<r;n++)await this.replayMacro(`${t}`,s+1);else console.log("ERR: Max macro replay depth reached");for(;this.buffer.length;)this.send(this.buffer.shift());this.replaying=!1;return;default:this.repeatCount=0;for(let n=0;n<r;n++)this.send({action:e,args:t})}}async replayMacro(e,t){for(const s of this.registers[e]??[])await this.takeAction(s,t)}attachTransformer(e){this.bindKeys(e),this.bindRepeatKeys(e);const t=this,s=new TransformStream({start(r){t.send=i=>r.enqueue(i)},transform(r){t.recording&&t.registers[t.recordingTarget].push(r),t.replaying?t.buffer.push(r):t.takeAction(r)}});e.stream=e.stream.pipeThrough(s)}}async function g(d){return new Promise(e=>{setTimeout(e,d)})}const u=`<style>
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
      <div id="register-header">Macros</div>

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
`;class m extends HTMLElement{shadow;vlk;state={x:0,y:0,zoomed:!1};constructor(){super(),this.vlk=new a,this.watchVlkDebug(),this.setupKeybindings(),this.handleCommands()}watchVlkDebug(){const e=this.render.bind(this),t={set(r,i,n){const o=Reflect.set(r,i,n);return e(),o}},s=new Proxy(this.vlk.state.debug,t);this.vlk.state.debug=s}connectedCallback(){this.shadow=this.attachShadow({mode:"open"}),this.shadow.innerHTML=u,this.getOrThrow("container").addEventListener("keydown",e=>{this.vlk.browserKeyUp(e)})}setupKeybindings({vlk:e}=this){e.bindSequence("<Shift-R>","debug","normal"),e.bindSequence("<Shift-H>","enumerate","normal"),e.bindSequence("<l>","move-right","normal"),e.bindSequence("<h>","move-left","normal"),e.bindSequence("<j>","move-down","normal"),e.bindSequence("<k>","move-up","normal"),e.bindSequence("<g><g>","move-home","normal"),e.bindSequence("<Shift-G>","move-end","normal"),e.bindSequence("<Ctrl-a><z>","zoom","normal")}async handleCommands(){for await(const e of this.vlk.stream)this.commands[e.action]&&await this.commands[e.action].call(this,e),this.render()}commands={debug:e=>{console.log(this)},"move-right":this.move.bind(this,25,0),"move-left":this.move.bind(this,-25,0),"move-down":this.move.bind(this,0,25),"move-up":this.move.bind(this,0,-25),"move-home":()=>{this.state.x=0,this.state.y=0,this.render()},"move-end":()=>{this.state.x=675,this.state.y=475},zoom:this.zoom,enumerate:()=>{this.vlk.enumerateCurrentActions()}};render(){try{const e=this.getOrThrow("cursor"),{vlk:t}=this;this.state.zoomed?(e.style.left="0px",e.style.top="0px",e.style.width="700px",e.style.height="500px"):(e.style.left=`${this.state.x}px`,e.style.top=`${this.state.y}px`,e.style.width="25px",e.style.height="25px");const s=this.getOrThrow("recording");t.macro.recording?(s.innerHTML="true",s.style.backgroundColor="red"):(s.innerHTML="false",s.style.backgroundColor="lightgray");const r=t.state.debug;this.getOrThrow("mode").innerHTML=t.state.mode,this.getOrThrow("repeatCount").innerHTML=`${t.macro.repeatCount}`,this.getOrThrow("lastAction").innerHTML=r.lastAction,this.getOrThrow("lastKeyCode").innerHTML=r.lastKeyCode.replace(/</g,"&lt;");for(const i of this.shadow.querySelectorAll(".register")){const n=i.innerHTML;t.macro.registers[n]?.length?i.classList.add("selected"):i.classList.remove("selected")}}catch(e){console.log(e)}}getOrThrow(e){const t=this.shadow.getElementById(e);if(!t)throw`Missing element with id "${e}"`;return t}zoom(){this.state.zoomed=!this.state.zoomed}move(e,t){let{x:s,y:r}=this.state;this.state.zoomed=!1,s=s+e,r=r+t,s<0&&(s=0),r<0&&(r=0),s>675&&(s=675),r>475&&(r=475),this.state.x=s,this.state.y=r}}customElements.define("vlk-test",m);
