import { state } from '../state/state.js';
import { NOTE_NAMES, BASHO_COLOR, rgbStr } from '../state/notes.js';

// ETICHETTA NOTA — piccola, vicino al knob PITCH.
// Nota sul porting: nel file di riferimento esistevano due definizioni di
// updateNoteFrame() (una orfana, che puntava a un elemento #noteFrame mai
// presente nel markup attuale, e questa — l'unica realmente attiva perche'
// ridefinita dopo). Qui resta solo la versione corretta.
let lastFrameKey = '';
export function resetNoteLabel(){ lastFrameKey = ''; }

export function updateNoteLabel(){
  const cell = state.mode==='solo' ? state.soloCell : state.chordCells[0];
  const idx = Math.round(((cell.pos%12)+12)%12) % 12;
  const note = NOTE_NAMES[idx];
  const key = note;
  if(key===lastFrameKey) return;
  lastFrameKey = key;
  const color = BASHO_COLOR[note];
  document.getElementById('swatchMini').style.background = rgbStr(color);
  document.getElementById('moodMini').textContent = note;
}
