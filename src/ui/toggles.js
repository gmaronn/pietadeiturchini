import { state } from '../state/state.js';
import { startPlaying, stopPlaying } from '../state/playback.js';
import { toggleMic, loadAudioFile, Mic, stopMic } from '../audio/pitch.js';
import { resetNoteLabel } from './noteLabel.js';

export function initToggles(){
  const soloBtn = document.getElementById('soloBtn');
  const chordBtn = document.getElementById('chordBtn');
  soloBtn.addEventListener('click', ()=>{
    if(state.playing) stopPlaying();
    state.mode='solo'; soloBtn.classList.add('active'); chordBtn.classList.remove('active');
    document.getElementById('modeCorner').textContent='SOLO';
    resetNoteLabel();
  });
  chordBtn.addEventListener('click', ()=>{
    if(state.playing) stopPlaying();
    state.mode='chord'; chordBtn.classList.add('active'); soloBtn.classList.remove('active');
    document.getElementById('modeCorner').textContent='CHORD';
    resetNoteLabel();
  });

  document.getElementById('micBtn').addEventListener('click', toggleMic);
  document.getElementById('trackBtn').addEventListener('click', ()=>{
    if(Mic.on && Mic.mode==='file'){ stopMic(); return; }
    document.getElementById('audioFileInput').click();
  });
  document.getElementById('audioFileInput').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(file) loadAudioFile(file);
    e.target.value = '';
  });

  document.getElementById('colorModeBtn').addEventListener('click', ()=>{
    state.colorMode = !state.colorMode;
    const btn = document.getElementById('colorModeBtn');
    btn.textContent = state.colorMode ? 'COLORE' : 'B/N';
    btn.classList.toggle('active', state.colorMode);
  });

  document.getElementById('playBtn').addEventListener('click', ()=>{
    if(state.micOn) return;
    if(state.playing) stopPlaying(); else startPlaying();
  });
}
