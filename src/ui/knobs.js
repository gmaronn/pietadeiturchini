import { state } from '../state/state.js';
import { pitchLabel } from '../state/notes.js';
import { updatePitchLive } from '../state/playback.js';
import { updateAllFilters, audioSetVolumeLive } from '../audio/engine.js';

const KNOB_DEFS = {
  cutoff:    {min:0, max:100,  key:'cutoffPct',    el:'knobCutoff',    val:'valCutoff',    fmt:v=>Math.round(v)+'%'},
  resonance: {min:0, max:100,  key:'resonancePct', el:'knobResonance', val:'valResonance', fmt:v=>Math.round(v)+'%'},
  volume:    {min:0, max:100,  key:'volumePct',    el:'knobVolume',    val:'valVolume',    fmt:v=>Math.round(v)+'%'},
  pitch:     {min:0, max:11.99,key:'pitchPos',     el:'knobPitch',     val:'valPitch',     fmt:v=>pitchLabel(v)}
};

function setKnobVisual(name){
  const def = KNOB_DEFS[name];
  const v = state[def.key];
  const frac = (v-def.min)/(def.max-def.min);
  const deg = -135 + frac*270;
  document.getElementById(def.el).style.setProperty('--markerRotate', deg+'deg');
  document.getElementById(def.val).textContent = def.fmt(v);
}

export function initKnobs(){
  Object.keys(KNOB_DEFS).forEach(name=>{
    const def = KNOB_DEFS[name];
    const knobEl = document.getElementById(def.el);
    let dragging=false, startY=0, startVal=0;
    const onMove = (clientY)=>{
      const delta = startY-clientY;
      const range = def.max-def.min;
      const sensitivity = range/160;
      let v = startVal + delta*sensitivity;
      v = Math.max(def.min, Math.min(def.max, v));
      state[def.key] = v;
      setKnobVisual(name);
      if(name==='pitch') updatePitchLive(v);
      if(name==='cutoff' || name==='resonance') updateAllFilters();
      if(name==='volume') audioSetVolumeLive();
    };
    const canDrag = ()=> !(name==='pitch' && state.micOn);
    knobEl.addEventListener('mousedown', (e)=>{ if(!canDrag()) return; dragging=true; startY=e.clientY; startVal=state[def.key]; e.preventDefault(); });
    window.addEventListener('mousemove', (e)=>{ if(dragging) onMove(e.clientY); });
    window.addEventListener('mouseup', ()=>{ dragging=false; });
    knobEl.addEventListener('touchstart', (e)=>{ if(!canDrag()) return; dragging=true; startY=e.touches[0].clientY; startVal=state[def.key]; e.preventDefault(); }, {passive:false});
    window.addEventListener('touchmove', (e)=>{ if(dragging){ onMove(e.touches[0].clientY); e.preventDefault(); } }, {passive:false});
    window.addEventListener('touchend', ()=>{ dragging=false; });
    setKnobVisual(name);
  });
}
