import { state } from './state.js';
import { setCellTarget, triggerAttack } from './cell.js';

export const CHORD_IVALS = [0,4,7,11];

export function applyPosition(pos, fast){
  if(state.mode==='solo'){
    setCellTarget(state.soloCell, pos, fast);
    if(fast || state.soloCell.envState==='idle') triggerAttack(state.soloCell);
  } else {
    state.chordCells.forEach((cell,i)=>{
      setCellTarget(cell, pos+CHORD_IVALS[i], fast);
      if(fast || cell.envState==='idle') triggerAttack(cell);
    });
  }
}
