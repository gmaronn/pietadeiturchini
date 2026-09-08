import { clamp } from '../state/notes.js';
import { Audio_ } from './engine.js';

// ANALISI TIMBRICA — sempre sull'uscita master (mic, traccia o sintesi
// interna: unica fonte, comportamento coerente qualunque sia la sorgente).
// - centroide spettrale -> "temperatura" del suono (acuto/freddo vs grave/caldo)
// - flatness spettrale (entropia di Wiener) -> tonale/voce vs rumoroso/metallico
// - energia per banda -> grave/medio/acuto
// - flusso spettrale -> rilevazione di attacchi/impatti (il "tintinnio" della
//   ferraglia deve leggersi come scosse discrete, non come tremore continuo)
export const AudioFeatures = { centroid:0, flatness:0, lowE:0.33, midE:0.33, highE:0.33, onset:0, rms:0 };

let masterAnalyser=null, masterBuf=null, prevSpectrum=null, fluxAvg=0;

function ensureMasterAnalyser(){
  if(masterAnalyser || !Audio_.ctx) return;
  masterAnalyser = Audio_.ctx.createAnalyser();
  masterAnalyser.fftSize = 1024;
  masterAnalyser.smoothingTimeConstant = 0.35;
  Audio_.master.connect(masterAnalyser); // derivazione: non tocca il percorso verso gli altoparlanti
  masterBuf = new Uint8Array(masterAnalyser.frequencyBinCount);
}

export function updateAudioFeatures(){
  ensureMasterAnalyser();
  if(!masterAnalyser) return;
  masterAnalyser.getByteFrequencyData(masterBuf);
  const N = masterBuf.length;
  const sampleRate = Audio_.ctx.sampleRate;
  let sumMag=0, sumFreqMag=0, sumLog=0, sumSq=0;
  let lowE=0, midE=0, highE=0;
  for(let i=0;i<N;i++){
    const mag = masterBuf[i]/255;
    const freq = i*sampleRate/(2*N);
    sumMag += mag; sumSq += mag*mag;
    sumFreqMag += freq*mag;
    sumLog += Math.log(mag+1e-4);
    if(freq<250) lowE+=mag; else if(freq<2000) midE+=mag; else highE+=mag;
  }
  AudioFeatures.rms = Math.sqrt(sumSq/N);
  const centroidHz = sumMag>0.05 ? sumFreqMag/sumMag : 0;
  AudioFeatures.centroid = clamp(centroidHz/6000, 0, 1);
  const gmean = Math.exp(sumLog/N), amean = (sumMag/N)+1e-4;
  AudioFeatures.flatness = clamp(gmean/amean, 0, 1);
  const totalE = lowE+midE+highE+1e-6;
  AudioFeatures.lowE = lowE/totalE; AudioFeatures.midE = midE/totalE; AudioFeatures.highE = highE/totalE;

  if(prevSpectrum){
    let flux=0;
    for(let i=0;i<N;i++){ const d=masterBuf[i]-prevSpectrum[i]; if(d>0) flux+=d; }
    flux/=N;
    fluxAvg = fluxAvg*0.92+flux*0.08;
    AudioFeatures.onset = clamp((flux-fluxAvg*1.7)/34, 0, 1);
  } else { prevSpectrum = new Uint8Array(N); }
  prevSpectrum.set(masterBuf);
}
