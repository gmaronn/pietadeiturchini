import { state } from './state.js';
import { setCellTarget, triggerAttack, triggerRelease } from './cell.js';
import { CHORD_IVALS } from './position.js';
import { freqForPos } from './notes.js';
import { ensureAudio, Audio_, audioNoteOn, audioNoteOff, audioSetFreq } from '../audio/engine.js';

export function startPlaying(){
  ensureAudio();
  if(Audio_.ctx.state==='suspended') Audio_.ctx.resume();
  state.playing = true;
  if(state.mode==='solo'){
    setCellTarget(state.soloCell, state.pitchPos, true);
    triggerAttack(state.soloCell);
    audioNoteOn('main', freqForPos(state.soloCell.pos));
  } else {
    state.chordCells.forEach((cell,i)=>{
      setCellTarget(cell, state.pitchPos+CHORD_IVALS[i], true);
      triggerAttack(cell);
      audioNoteOn('chord'+i, freqForPos(cell.pos));
    });
  }
  updatePlayButtonUI();
}
export function stopPlaying(){
  state.playing = false;
  if(state.mode==='solo'){ triggerRelease(state.soloCell); audioNoteOff('main'); }
  else { state.chordCells.forEach((c,i)=>{ triggerRelease(c); audioNoteOff('chord'+i); }); }
  updatePlayButtonUI();
}
export function updatePlayButtonUI(){
  const btn = document.getElementById('playBtn');
  btn.classList.toggle('playing', state.playing);
  btn.textContent = state.playing ? '■  FERMA' : '▶  SUONA';
}
export function updatePitchLive(pos){
  if(state.micOn) return;
  if(!state.playing){
    setCellTarget(state.soloCell, pos, true);
    state.chordCells.forEach((cell,i)=> setCellTarget(cell, pos+CHORD_IVALS[i], true));
    return;
  }
  // muovere la manopola mentre suona e' sempre uno slide continuo (lento)
  if(state.mode==='solo'){
    setCellTarget(state.soloCell, pos, false);
    audioSetFreq('main', freqForPos(pos));
  } else {
    state.chordCells.forEach((cell,i)=>{
      setCellTarget(cell, pos+CHORD_IVALS[i], false);
      audioSetFreq('chord'+i, freqForPos(pos+CHORD_IVALS[i]));
    });
  }
}
