import { mapRange } from '../state/notes.js';
import { state, volFraction } from '../state/state.js';
import { FIXED_ATTACK_MS, FIXED_RELEASE_MS } from '../state/cell.js';

// AUDIO ENGINE — onda a dente di sega (ricca di armonici): solo cosi' il
// filtro e la risonanza si sentono davvero. Un'onda sinusoidale pura non
// mostra risonanza percepibile.
export const Audio_ = { ctx:null, master:null, activeOsc:{}, started:false, lfoOsc:null, lfoGain:null };

export function cutoffFreq(){ return 150*Math.pow(7000/150, state.cutoffPct/100); }
export function resonanceQ(){ return 0.5 + (state.resonancePct/100)*19.5; }
// stessa identica curva usata dalla vibrazione visiva (vedi currentVib nel render):
// e' questo che tiene udibile e visibile davvero sincronizzati, non solo simili.
export function lfoRateHz(){ return mapRange(state.resonancePct,0,100, 0.15, 3.4); }
export function lfoDepthHz(){ return mapRange(state.resonancePct,0,100, 0, cutoffFreq()*0.35); }

export function ensureAudio(){
  if(Audio_.started) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  Audio_.ctx = new AC();
  Audio_.master = Audio_.ctx.createGain();
  Audio_.master.gain.value = 0.5;
  Audio_.master.connect(Audio_.ctx.destination);

  const bufLen = Audio_.ctx.sampleRate*2;
  const buf = Audio_.ctx.createBuffer(1,bufLen,Audio_.ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last=0;
  for(let i=0;i<bufLen;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; data[i]=last*3.2; }
  const noiseSrc = Audio_.ctx.createBufferSource();
  noiseSrc.buffer=buf; noiseSrc.loop=true;
  const noiseFilter = Audio_.ctx.createBiquadFilter();
  noiseFilter.type='bandpass'; noiseFilter.frequency.value=1800; noiseFilter.Q.value=0.6;
  const noiseGain = Audio_.ctx.createGain();
  noiseGain.gain.value = 0.010;
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(Audio_.master);
  noiseSrc.start();

  // LFO condiviso: modula davvero il cutoff nel tempo (non e' un filtro statico).
  // La stessa frequenza/fase guida anche la vibrazione visiva, cosi' quello che
  // si sente e quello che si vede sono davvero la stessa oscillazione.
  Audio_.lfoOsc = Audio_.ctx.createOscillator();
  Audio_.lfoOsc.type = 'sine';
  Audio_.lfoOsc.frequency.value = lfoRateHz();
  Audio_.lfoGain = Audio_.ctx.createGain();
  Audio_.lfoGain.gain.value = lfoDepthHz();
  Audio_.lfoOsc.connect(Audio_.lfoGain);
  Audio_.lfoOsc.start();

  Audio_.started = true;
}

export function audioNoteOn(id, freq){
  if(!Audio_.started) return;
  const ctx = Audio_.ctx;
  const osc = ctx.createOscillator();
  osc.type='sawtooth'; osc.frequency.value=freq;
  const filt = ctx.createBiquadFilter();
  filt.type='lowpass';
  filt.frequency.value = cutoffFreq();
  filt.Q.value = resonanceQ();
  Audio_.lfoGain.connect(filt.frequency); // il cutoff di QUESTA voce ora oscilla davvero
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  const peak = volFraction() * 0.22; // il dente di sega e' piu' "denso": guadagno base piu' basso
  g.gain.linearRampToValueAtTime(Math.max(0.0001,peak), ctx.currentTime + FIXED_ATTACK_MS/1000);
  osc.connect(filt).connect(g).connect(Audio_.master);
  osc.start();
  Audio_.activeOsc[id] = {osc,g,filt};
}
export function audioNoteOff(id){
  const rec = Audio_.activeOsc[id];
  if(!rec || !Audio_.started) return;
  const ctx = Audio_.ctx, {osc,g,filt}=rec;
  const now=ctx.currentTime, cur=g.gain.value;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(cur, now);
  const relDur = FIXED_RELEASE_MS/1000;
  g.gain.linearRampToValueAtTime(0.0001, now+relDur);
  osc.stop(now+relDur+0.05);
  try{ Audio_.lfoGain.disconnect(filt.frequency); }catch(e){}
  delete Audio_.activeOsc[id];
}
export function audioSetFreq(id, freq){
  const rec = Audio_.activeOsc[id];
  if(rec) rec.osc.frequency.setTargetAtTime(freq, Audio_.ctx.currentTime, 0.02);
}
export function audioSetVolumeLive(){
  const peak = volFraction() * 0.22;
  Object.values(Audio_.activeOsc).forEach(rec=>{
    if(rec.g) rec.g.gain.setTargetAtTime(Math.max(0.0001,peak), Audio_.ctx.currentTime, 0.05);
  });
}
export function updateAllFilters(){
  const f = cutoffFreq(), q = resonanceQ();
  if(Audio_.lfoOsc){
    Audio_.lfoOsc.frequency.setTargetAtTime(lfoRateHz(), Audio_.ctx.currentTime, 0.05);
    Audio_.lfoGain.gain.setTargetAtTime(lfoDepthHz(), Audio_.ctx.currentTime, 0.05);
  }
  Object.values(Audio_.activeOsc).forEach(rec=>{
    if(rec.filt){
      rec.filt.frequency.setTargetAtTime(f, Audio_.ctx.currentTime, 0.03);
      rec.filt.Q.setTargetAtTime(q, Audio_.ctx.currentTime, 0.03);
    }
  });
}
