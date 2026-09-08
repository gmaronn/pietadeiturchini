import { NOTE_NAMES, BASHO_COLOR, mixColor, mapRange, clamp } from '../state/notes.js';
import { state, volFraction } from '../state/state.js';
import { AudioFeatures } from '../audio/features.js';
import { Audio_, lfoRateHz } from '../audio/engine.js';
import { marchingSquares } from './marching.js';
import { marbleData } from './marbleData.js';
import { MAG_RES } from './sobel.js';

// RENDER — curva principale fedele + due bande d'eco piu' tenui.
// CHORD: solo la tonica, specchiata 4x nello stesso spazio (sacrificio di
// coerenza armonica per estetica, come richiesto).
// RESONANCE corretta: si vibra il TRATTO GIA' ESTRATTO (i vertici), mai il
// campionamento che decide dove sta la curva — quindi la topologia resta
// stabile e non si muove mai altro che la linea stessa.
//
// TIMBRO -> MOTO: un suono "caldo" (voce, tonale, flatness bassa) trema con
// un'onda liscia e lenta; uno "freddo" (ferraglia, rumoroso, flatness alta)
// trema in modo frastagliato e nervoso — stessa ampiezza, qualita' di moto
// diversa, cosi' si legge anche senza sentire. Il centroide sposta la
// temperatura del colore (in modalita' colore). Il grave ispessisce il
// tratto (massa), l'acuto accelera il tremore (leggerezza/nervosismo). Un
// attacco (flusso spettrale) da' una scossa breve e netta, non un tremore
// continuo.
export const CONTOUR_RES = 145;
const COLOR_COOL = [0x3a,0x5a,0x78]; // temperatura fredda (centroide alto: metallico/acuto)
const COLOR_WARM = [0xb0,0x5a,0x28]; // temperatura calda (centroide basso: voce/grave)
export let onsetPulse = 0;

export function currentColorFor(cell){
  if(!state.colorMode) return [17,17,17];
  const p = ((cell.pos%12)+12)%12;
  const i0 = Math.floor(p)%12, i1=(i0+1)%12, t = p-Math.floor(p);
  const base = mixColor(BASHO_COLOR[NOTE_NAMES[i0]], BASHO_COLOR[NOTE_NAMES[i1]], t);
  // temperatura: il centroide spettrale tinge leggermente verso caldo/freddo,
  // sopra il colore Basho di base, non lo sostituisce
  const tint = state.micOn || state.playing
    ? mixColor(COLOR_WARM, COLOR_COOL, AudioFeatures.centroid)
    : null;
  return tint ? mixColor(base, tint, 0.30) : base;
}

function staticSampler(magA, magB, t){
  return function(gx, gy){
    const sx = Math.min(MAG_RES-1, Math.floor((gx/CONTOUR_RES)*MAG_RES));
    const sy = Math.min(MAG_RES-1, Math.floor((gy/CONTOUR_RES)*MAG_RES));
    const si = sy*MAG_RES+sx;
    return magA[si]*(1-t) + magB[si]*t;
  };
}

// calcola le bande (segmenti grezzi, SENZA vibrazione) per la cella corrente
export function computeBands(cell){
  const p = ((cell.pos%12)+12)%12;
  const i0 = Math.floor(p)%12, i1=(i0+1)%12, t = p-Math.floor(p);
  const n0 = NOTE_NAMES[i0], n1 = NOTE_NAMES[i1];
  const magA = marbleData.magMaps[n0], magB = marbleData.magMaps[n1];
  if(!magA || !magB) return null;

  const level = clamp(volFraction()*cell.env, 0, 1);
  if(level<=0.004) return null;
  const mainThreshold = clamp(250 - level*270, 0, 255);
  const sampler = staticSampler(magA, magB, t);

  const bands = [];
  const specs = [
    {th: clamp(mainThreshold+34,0,255), alpha:0.30},
    {th: mainThreshold,                 alpha:1.0 },
    {th: clamp(mainThreshold-34,0,255), alpha:0.42}
  ];
  specs.forEach(s=>{
    const flat = [];
    marchingSquares(sampler, CONTOUR_RES, s.th, flat);
    if(flat.length) bands.push({flat, alpha:s.alpha});
  });
  return {bands, level};
}

// applica la vibrazione SOLO ai vertici gia' estratti (non al campionamento).
// due componenti: un'onda liscia (fase/frequenza dell'LFO) e un caos
// frastagliato la cui intensita' segue la flatness spettrale — e' questo
// che distingue a vista una voce (liscia) da un tintinnio metallico (nervoso).
export function jitterFlat(flat, ph, vibAmt, chaosAmt, chaosPh){
  const out = new Array(flat.length);
  for(let i=0;i<flat.length;i+=2){
    const x = flat[i], y = flat[i+1];
    const w1 = Math.sin((x*9.0+y*5.0)*Math.PI*2 + ph*6.2);
    const w2 = Math.cos((x*5.0+y*9.0)*Math.PI*2 + ph*5.4+1.3);
    let dx = w1*vibAmt, dy = w2*vibAmt;
    if(chaosAmt>0.0001){
      const c1 = Math.sin((x*41.0+y*23.0) + chaosPh*17.0) * Math.cos((x*19.0-y*31.0)+chaosPh*11.3);
      const c2 = Math.cos((x*29.0-y*37.0) + chaosPh*14.7) * Math.sin((x*33.0+y*13.0)+chaosPh*9.1);
      dx += c1*chaosAmt; dy += c2*chaosAmt;
    }
    out[i]   = x + dx;
    out[i+1] = y + dy;
  }
  return out;
}

export function currentVib(level){
  // stessa frequenza dell'LFO audio e stesso orologio (l'audio context,
  // quando esiste): e' questo che rende udibile e visibile davvero la
  // stessa oscillazione, non due effetti separati che si assomigliano.
  const now = (Audio_.ctx ? Audio_.ctx.currentTime : performance.now()/1000);
  // l'acuto (alta energia in banda alta) accelera il tremore: leggerezza/nervosismo
  const speedMul = 1 + AudioFeatures.highE*1.6;
  const vibSpeed = lfoRateHz()*speedMul;
  const vibAmt = mapRange(state.resonancePct,0,100, 0.0015, 0.014) * (0.3+level*0.85);
  // caos: cresce con la flatness spettrale (rumoroso/metallico) e con l'attacco in corso
  const chaosAmt = (0.006 + onsetPulse*0.02) * (0.2+level*0.9) * AudioFeatures.flatness;
  return { ph: now*vibSpeed, vibAmt, chaosAmt, chaosPh: now*(vibSpeed*2.3+1.7) };
}

// destCtx: CanvasRenderingContext2D (p5's drawingContext) — si disegna
// direttamente sul contesto 2D nativo per le stesse ragioni di performance
// del riferimento: molte migliaia di segmenti per frame, un solo stroke().
export function drawBandsInto(destCtx, bandsData, destX, destY, destSize, color, flipH, flipV, vib){
  destCtx.save();
  destCtx.translate(destX + (flipH?destSize:0), destY + (flipV?destSize:0));
  destCtx.scale(flipH?-1:1, flipV?-1:1);
  const baseWidth = mapRange(AudioFeatures.lowE, 0, 1, 0.95, 2.1); // il grave ispessisce il tratto
  bandsData.bands.forEach(band=>{
    const pts = jitterFlat(band.flat, vib.ph, vib.vibAmt, vib.chaosAmt, vib.chaosPh);
    destCtx.beginPath();
    for(let i=0;i<pts.length;i+=4){
      destCtx.moveTo(pts[i]*destSize, pts[i+1]*destSize);
      destCtx.lineTo(pts[i+2]*destSize, pts[i+3]*destSize);
    }
    destCtx.strokeStyle = 'rgb('+Math.round(color[0])+','+Math.round(color[1])+','+Math.round(color[2])+')';
    destCtx.lineWidth = baseWidth + onsetPulse*1.1;
    destCtx.lineCap = 'round';
    const a = bandsData.level>0 ? band.alpha * Math.min(1, bandsData.level*1.6 + 0.15) : 0;
    destCtx.globalAlpha = Math.min(1, a + onsetPulse*0.25*band.alpha);
    destCtx.stroke();
  });
  destCtx.restore();
}

export function drawSolo(destCtx, stageSize){
  const cell = state.soloCell;
  const bandsData = computeBands(cell);
  if(!bandsData) return;
  const vib = currentVib(bandsData.level);
  drawBandsInto(destCtx, bandsData, 0, 0, stageSize, currentColorFor(cell), false, false, vib);
}
export function drawChord(destCtx, stageSize){
  // solo la tonica, specchiata 4 volte nello stesso spazio
  const cell = state.chordCells[0];
  const bandsData = computeBands(cell);
  if(!bandsData) return;
  const vib = currentVib(bandsData.level);
  const color = currentColorFor(cell);
  const half = stageSize/2;
  const flips = [[false,false],[true,false],[false,true],[true,true]];
  const quads = [[0,0],[half,0],[0,half],[half,half]];
  flips.forEach(([fh,fv], i)=>{
    const [qx,qy] = quads[i];
    drawBandsInto(destCtx, bandsData, qx, qy, half, color, fh, fv, vib);
  });
}

export function updateOnsetPulse(){
  onsetPulse = Math.max(AudioFeatures.onset, onsetPulse*0.80); // scossa netta, decadimento rapido
}

export function applyCutoffBlur(canvasEl){
  const blurPx = mapRange(state.cutoffPct, 0, 100, 4.5, 0);
  canvasEl.style.filter = blurPx>0.05 ? ('blur('+blurPx.toFixed(2)+'px)') : 'none';
}
