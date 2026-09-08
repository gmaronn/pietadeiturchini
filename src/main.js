import p5 from 'p5';
import './style.css';

import { state } from './state/state.js';
import { updateCellMorph, updateEnvelope } from './state/cell.js';
import { loadAllMarbles } from './render/sobel.js';
import { marbleData } from './render/marbleData.js';
import { drawSolo, drawChord, applyCutoffBlur, updateOnsetPulse } from './render/draw.js';
import { Audio_ } from './audio/engine.js';
import { updateAudioFeatures } from './audio/features.js';
import { Mic, updateMic, stepMicEnvelope } from './audio/pitch.js';
import { initKnobs } from './ui/knobs.js';
import { initToggles } from './ui/toggles.js';
import { updateNoteLabel } from './ui/noteLabel.js';
import { exportJPEG, exportSVG, exportPNG300 } from './ui/export.js';

import marbleC from './assets/marbles/C.jpg';
import marbleCs from './assets/marbles/Cs.jpg';
import marbleD from './assets/marbles/D.jpg';
import marbleDs from './assets/marbles/Ds.jpg';
import marbleE from './assets/marbles/E.jpg';
import marbleF from './assets/marbles/F.jpg';
import marbleFs from './assets/marbles/Fs.jpg';
import marbleG from './assets/marbles/G.jpg';
import marbleGs from './assets/marbles/Gs.jpg';
import marbleA from './assets/marbles/A.jpg';
import marbleAs from './assets/marbles/As.jpg';
import marbleB from './assets/marbles/B.jpg';

const MARBLE_URLS = {
  "C":marbleC, "C#":marbleCs, "D":marbleD, "D#":marbleDs, "E":marbleE, "F":marbleF,
  "F#":marbleFs, "G":marbleG, "G#":marbleGs, "A":marbleA, "A#":marbleAs, "B":marbleB
};

const STAGE_SIZE = 640;

const sketch = (p)=>{
  p.setup = ()=>{
    const canvas = p.createCanvas(STAGE_SIZE, STAGE_SIZE);
    canvas.parent('stage-holder');
    canvas.id('stage');
    p.frameRate(60);

    loadAllMarbles(MARBLE_URLS).then(magMaps=>{
      marbleData.magMaps = magMaps;
      marbleData.ready = true;
    });

    initKnobs();
    initToggles();
    wireExportButtons(canvas.elt);
  };

  p.draw = ()=>{
    if(!marbleData.ready) return;

    if(Mic.on) updateMic();
    const micEnvCurrent = stepMicEnvelope();
    if(Audio_.ctx) updateAudioFeatures();
    updateOnsetPulse();

    if(state.mode==='solo'){
      updateEnvelope(state.soloCell);
      updateCellMorph(state.soloCell);
      if(Mic.on) state.soloCell.env = Math.max(state.soloCell.env*0.15, micEnvCurrent);
    } else {
      state.chordCells.forEach(c=>{
        updateEnvelope(c);
        updateCellMorph(c);
        if(Mic.on) c.env = Math.max(c.env*0.15, micEnvCurrent);
      });
    }

    const ctx = p.drawingContext;
    ctx.clearRect(0,0,p.width,p.height);
    if(state.mode==='solo') drawSolo(ctx, p.width); else drawChord(ctx, p.width);
    applyCutoffBlur(p.canvas);
    updateNoteLabel();
  };
};

function wireExportButtons(canvasEl){
  document.getElementById('exportBtn').addEventListener('click', ()=> exportJPEG(canvasEl));
  document.getElementById('exportSvgBtn').addEventListener('click', exportSVG);
  document.getElementById('exportPngBtn').addEventListener('click', exportPNG300);
}

new p5(sketch);
