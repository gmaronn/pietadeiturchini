import { state } from '../state/state.js';
import { applyPosition } from '../state/position.js';
import { stopPlaying } from '../state/playback.js';
import { ensureAudio, Audio_ } from './engine.js';

// PITCH DETECTION — MIC / TRACCIA
export const Mic = { stream:null, source:null, analyser:null, buf:null, freqBuf:null, on:false, mode:null, trackEl:null };

export function setManualControlsEnabled(on){
  document.getElementById('pitchUnit').classList.toggle('disabled', !on);
  document.getElementById('playRow').classList.toggle('disabled', !on);
}

export async function toggleMic(){
  if(Mic.on && Mic.mode==='mic'){ stopMic(); return; }
  if(Mic.on && Mic.mode==='file'){ stopMic(); }
  try{
    ensureAudio();
    if(state.playing) stopPlaying();
    const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}});
    Mic.stream = stream;
    Mic.source = Audio_.ctx.createMediaStreamSource(stream);
    Mic.analyser = Audio_.ctx.createAnalyser();
    Mic.analyser.fftSize = 2048;
    Mic.buf = new Float32Array(Mic.analyser.fftSize);
    Mic.freqBuf = new Uint8Array(Mic.analyser.frequencyBinCount);
    Mic.source.connect(Mic.analyser);
    Mic.mode = 'mic';
    Mic.on = true; state.micOn = true;
    document.getElementById('micBtn').classList.add('active','listening');
    document.getElementById('hzIndicator').classList.add('on');
    setManualControlsEnabled(false);
  }catch(e){ alert('Microfono non disponibile: '+e.message); }
}

export async function loadAudioFile(file){
  ensureAudio();
  if(Audio_.ctx.state==='suspended') Audio_.ctx.resume();
  if(state.playing) stopPlaying();
  if(Mic.on) stopMic();
  const audioEl = new Audio();
  audioEl.loop = true;
  audioEl.src = URL.createObjectURL(file);
  try{ await audioEl.play(); }catch(e){ alert('Impossibile riprodurre il file: '+e.message); return; }
  const source = Audio_.ctx.createMediaElementSource(audioEl);
  const analyser = Audio_.ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  analyser.connect(Audio_.ctx.destination);
  Mic.analyser = analyser;
  Mic.buf = new Float32Array(analyser.fftSize);
  Mic.freqBuf = new Uint8Array(analyser.frequencyBinCount);
  Mic.trackEl = audioEl;
  Mic.mode = 'file';
  Mic.on = true; state.micOn = true;
  document.getElementById('trackBtn').classList.add('active','listening');
  document.getElementById('hzIndicator').classList.add('on');
  setManualControlsEnabled(false);
}

export let micEnvCurrent=0, micEnvTarget=0;

export function stopMic(){
  if(Mic.mode==='mic' && Mic.stream){ Mic.stream.getTracks().forEach(t=>t.stop()); Mic.stream=null; }
  if(Mic.mode==='file' && Mic.trackEl){ Mic.trackEl.pause(); Mic.trackEl.src=''; Mic.trackEl=null; }
  Mic.on = false; Mic.mode = null; state.micOn = false;
  document.getElementById('micBtn').classList.remove('active','listening');
  document.getElementById('trackBtn').classList.remove('active','listening');
  document.getElementById('hzIndicator').classList.remove('on');
  micEnvTarget = 0;
  setManualControlsEnabled(true);
}

function autoCorrelate(buf, sampleRate){
  const SIZE = buf.length;
  let rms=0;
  for(let i=0;i<SIZE;i++) rms += buf[i]*buf[i];
  rms = Math.sqrt(rms/SIZE);
  if(rms<0.01) return {freq:-1, rms};
  let r1=0, r2=SIZE-1, thres=0.2;
  for(let i=0;i<SIZE/2;i++){ if(Math.abs(buf[i])<thres){ r1=i; break; } }
  for(let i=1;i<SIZE/2;i++){ if(Math.abs(buf[SIZE-i])<thres){ r2=SIZE-i; break; } }
  const trimmed = buf.slice(r1,r2);
  const newSize = trimmed.length;
  const c = new Array(newSize).fill(0);
  for(let lag=0; lag<newSize; lag++){
    for(let i=0;i<newSize-lag;i++) c[lag]+=trimmed[i]*trimmed[i+lag];
  }
  let d=0; while(c[d]>c[d+1]) d++;
  let maxval=-1,maxpos=-1;
  for(let i=d;i<newSize;i++){ if(c[i]>maxval){ maxval=c[i]; maxpos=i; } }
  let T0=maxpos;
  if(T0<=0) return {freq:-1, rms};
  const x1=c[T0-1]||c[T0], x2=c[T0], x3=c[T0+1]||c[T0];
  const a=(x1+x3-2*x2)/2, b=(x3-x1)/2;
  if(a) T0 = T0 - b/(2*a);
  return {freq: sampleRate/T0, rms};
}
function freqToNoteIndex(freq){
  const n = 12*Math.log2(freq/440)+69;
  return ((Math.round(n)%12)+12)%12;
}

export function updateMic(){
  if(!Mic.on) return;
  Mic.analyser.getFloatTimeDomainData(Mic.buf);
  Mic.analyser.getByteFrequencyData(Mic.freqBuf);
  const {freq, rms} = autoCorrelate(Mic.buf, Audio_.ctx.sampleRate);
  let total=0, high=0;
  for(let i=0;i<Mic.freqBuf.length;i++){
    total += Mic.freqBuf[i];
    if(i > Mic.freqBuf.length*0.18) high += Mic.freqBuf[i];
  }
  state.micRichness = total>0 ? Math.min(1,(high/total)*2.2) : 0;
  // "c'e' suono" dipende SOLO dall'energia (RMS): affidabile per qualunque
  // sorgente, percussiva/inarmonica compresa. "Che nota mostrare" dipende
  // dall'intonazione (autocorrelazione), che invece su un colpo di metallo o
  // un accordo di chitarra spesso non trova nulla di chiaro — in quel caso
  // NON trattiamo il suono come silenzio: teniamo l'ultima forma mostrata,
  // ma l'inviluppo sale comunque e il timbro (flatness/bande/attacco) resta
  // pienamente visibile.
  const silent = rms < 0.009;
  micEnvTarget = silent ? 0 : Math.min(1, rms*7);
  if(!silent){
    if(freq>0){
      state.micHz = freq;
      document.getElementById('hzIndicator').textContent = freq.toFixed(1)+' Hz';
      const idx = freqToNoteIndex(freq);
      const wasSounding = micEnvCurrent > 0.04;
      // sempre morph continuo: "wasSounding" sceglie solo se e' rapido (nota nuova dal silenzio)
      // o lento (scivolamento dentro la stessa emissione sonora)
      applyPosition(idx, !wasSounding);
    } else {
      document.getElementById('hzIndicator').textContent = '(senza intonazione)';
    }
  } else {
    document.getElementById('hzIndicator').textContent = '— Hz';
  }
}

export function stepMicEnvelope(){
  micEnvCurrent += (micEnvTarget - micEnvCurrent)*0.12;
  return micEnvCurrent;
}
