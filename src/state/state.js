import { makeCellState } from './cell.js';

export const state = {
  cutoffPct:50, resonancePct:20, volumePct:55, pitchPos:0,
  mode:'solo', micOn:false, playing:false, colorMode:false,
  soloCell: makeCellState(0),
  chordCells: [0,4,7,11].map(iv=>makeCellState(iv)),
  micRichness:0, micHz:0
};

export function volFraction(){ return state.volumePct/100; }
