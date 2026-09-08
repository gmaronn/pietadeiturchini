// STATO CELLA — morph SEMPRE continuo, mai scatto secco;
// varia solo la velocita' (rapida = "netta", lenta = "slide")
export function makeCellState(pos){
  return { pos, targetPos: pos, morphRate:0.05, env:0, envState:'idle', envStart:0, envStartVal:0, active:false };
}
export function setCellTarget(cell, pos, fast){
  cell.targetPos = pos;
  cell.morphRate = fast ? 0.30 : 0.045;
}
export function updateCellMorph(cell){ cell.pos += (cell.targetPos - cell.pos)*cell.morphRate; }

// ENVELOPE — fissa, solo per evitare click audio (non piu' esposta come manopola)
export const FIXED_ATTACK_MS = 110, FIXED_RELEASE_MS = 550;

export function triggerAttack(cell){ cell.envStart=performance.now(); cell.envStartVal=cell.env; cell.envState='attack'; cell.active=true; }
export function triggerRelease(cell){ cell.envStart=performance.now(); cell.envStartVal=cell.env; cell.envState='release'; }
export function updateEnvelope(cell){
  if(cell.envState==='idle'){ cell.env=0; return; }
  const elapsed = performance.now()-cell.envStart;
  if(cell.envState==='attack'){
    const t=Math.min(1,elapsed/FIXED_ATTACK_MS);
    cell.env = cell.envStartVal + (1-cell.envStartVal)*t;
    if(t>=1){ cell.envState='sustain'; cell.env=1; }
  } else if(cell.envState==='sustain'){ cell.env=1; }
  else if(cell.envState==='release'){
    const t=Math.min(1,elapsed/FIXED_RELEASE_MS);
    cell.env = cell.envStartVal*(1-t);
    if(t>=1){ cell.envState='idle'; cell.env=0; cell.active=false; }
  }
}
