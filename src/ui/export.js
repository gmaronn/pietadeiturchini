import { state } from '../state/state.js';
import { mapRange, rgbStr } from '../state/notes.js';
import { computeBands, currentColorFor, currentVib, jitterFlat, onsetPulse } from '../render/draw.js';
import { AudioFeatures } from '../audio/features.js';

function timestamp(){ return new Date().toISOString().replace(/[:.]/g,'-'); }
function triggerDownload(url, filename){
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// EXPORT JPEG — rasterizza la canvas p5 corrente, incluso l'eventuale blur CSS.
export function exportJPEG(canvasEl){
  const tmp = document.createElement('canvas');
  tmp.width = canvasEl.width; tmp.height = canvasEl.height;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0,0,tmp.width,tmp.height);
  tctx.filter = canvasEl.style.filter || 'none';
  tctx.drawImage(canvasEl,0,0);
  const url = tmp.toDataURL('image/jpeg', 0.92);
  triggerDownload(url, 'contemporaneamente-antica-'+timestamp()+'.jpg');
}

// EXPORT SVG — vettoriale vero, stesso identico tratto della resa a schermo.
export function exportSVG(){
  const cell = state.mode==='solo' ? state.soloCell : state.chordCells[0];
  const bandsData = computeBands(cell);
  const W = 2000;
  let body = '';
  const color = currentColorFor(cell);
  const strokeColor = rgbStr(color);

  function emitBand(band, transform){
    const alpha = bandsData.level>0 ? band.alpha*Math.min(1,bandsData.level*1.6+0.15) : 0;
    if(alpha<=0.01) return '';
    let d = '';
    for(let i=0;i<band.flat.length;i+=4){
      d += `M${(band.flat[i]).toFixed(4)},${(band.flat[i+1]).toFixed(4)} L${(band.flat[i+2]).toFixed(4)},${(band.flat[i+3]).toFixed(4)} `;
    }
    return `<path d="${d}" transform="${transform}" stroke="${strokeColor}" stroke-opacity="${alpha.toFixed(3)}" stroke-width="0.0016" stroke-linecap="round" fill="none"/>`;
  }

  if(!bandsData){
    // niente da esportare (silenzio): file bianco valido comunque
  } else if(state.mode==='solo'){
    bandsData.bands.forEach(band=>{ body += emitBand(band, `scale(${W})`); });
  } else {
    const half = W/2;
    const transforms = [
      `scale(${half})`,
      `translate(${W},0) scale(${-half},${half})`,
      `translate(0,${W}) scale(${half},${-half})`,
      `translate(${W},${W}) scale(${-half},${-half})`
    ];
    transforms.forEach(tr=>{
      bandsData.bands.forEach(band=>{ body += emitBand(band, tr); });
    });
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">
<rect width="${W}" height="${W}" fill="#ffffff"/>
${body}
</svg>`;
  const blob = new Blob([svg], {type:'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  triggerDownload(url, 'contemporaneamente-antica-'+timestamp()+'.svg');
  URL.revokeObjectURL(url);
}

// EXPORT PNG 300 DPI — render ad alta risoluzione + chunk pHYs iniettato
// manualmente (densita' fisica reale, non solo pixel grezzi).
function crc32(buf){
  let c, crcTable = crc32.table;
  if(!crcTable){
    crcTable = crc32.table = [];
    for(let n=0;n<256;n++){
      c = n;
      for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      crcTable[n] = c;
    }
  }
  let crc = 0 ^ (-1);
  for(let i=0;i<buf.length;i++) crc = (crc>>>8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}
function addPhysChunk(arrayBuffer, dpi){
  const bytes = new Uint8Array(arrayBuffer);
  // il PNG inizia con 8 byte di firma, poi il chunk IHDR (4 len + 4 tipo + 13 dati + 4 crc = 25 byte)
  const insertAt = 8 + 25;
  const ppm = Math.round(dpi / 0.0254); // pixel per metro
  const type = [0x70,0x48,0x59,0x73]; // "pHYs"
  const data = new Uint8Array(9);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, ppm); dv.setUint32(4, ppm); data[8]=1; // unit=1 (metri)
  const crcInput = new Uint8Array(4+9);
  crcInput.set(type,0); crcInput.set(data,4);
  const crc = crc32(crcInput);

  const chunk = new Uint8Array(4+4+9+4);
  const cv = new DataView(chunk.buffer);
  cv.setUint32(0, 9); // length
  chunk.set(type,4);
  chunk.set(data,8);
  cv.setUint32(17, crc);

  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.slice(0,insertAt), 0);
  out.set(chunk, insertAt);
  out.set(bytes.slice(insertAt), insertAt+chunk.length);
  return out;
}
export function exportPNG300(){
  const DPI = 300;
  const SIZE_CM = 20; // lato del quadrato stampato
  const px = Math.round(SIZE_CM/2.54*DPI);

  const big = document.createElement('canvas');
  big.width = px; big.height = px;
  const bctx = big.getContext('2d');
  bctx.fillStyle = '#ffffff';
  bctx.fillRect(0,0,px,px);

  const cell = state.mode==='solo' ? state.soloCell : state.chordCells[0];
  const bandsData = computeBands(cell);
  const color = currentColorFor(cell);
  if(bandsData){
    const vib = currentVib(bandsData.level);
    const drawInto = (destX,destY,destSize,flipH,flipV)=>{
      bctx.save();
      bctx.translate(destX + (flipH?destSize:0), destY + (flipV?destSize:0));
      bctx.scale(flipH?-1:1, flipV?-1:1);
      const baseWidth = mapRange(AudioFeatures.lowE, 0, 1, 0.95, 2.1);
      bandsData.bands.forEach(band=>{
        const pts = jitterFlat(band.flat, vib.ph, vib.vibAmt, vib.chaosAmt, vib.chaosPh);
        bctx.beginPath();
        for(let i=0;i<pts.length;i+=4){
          bctx.moveTo(pts[i]*destSize, pts[i+1]*destSize);
          bctx.lineTo(pts[i+2]*destSize, pts[i+3]*destSize);
        }
        bctx.strokeStyle = rgbStr(color);
        bctx.lineWidth = ((baseWidth+onsetPulse*1.1)/640)*destSize*2; // spessore coerente alla risoluzione di stampa
        bctx.lineCap = 'round';
        bctx.globalAlpha = bandsData.level>0 ? band.alpha*Math.min(1,bandsData.level*1.6+0.15) : 0;
        bctx.stroke();
      });
      bctx.restore();
    };
    if(state.mode==='solo'){
      drawInto(0,0,px,false,false);
    } else {
      const half = px/2;
      drawInto(0,0,half,false,false);
      drawInto(half,0,half,true,false);
      drawInto(0,half,half,false,true);
      drawInto(half,half,half,true,true);
    }
  }

  big.toBlob(async (blob)=>{
    const buf = await blob.arrayBuffer();
    const withPhys = addPhysChunk(buf, DPI);
    const outBlob = new Blob([withPhys], {type:'image/png'});
    const url = URL.createObjectURL(outBlob);
    triggerDownload(url, 'contemporaneamente-antica-300dpi-'+timestamp()+'.png');
    URL.revokeObjectURL(url);
  }, 'image/png');
}
