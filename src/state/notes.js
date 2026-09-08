export const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
export const BASE_FREQ = 261.6256;

// Robbie Basho, Esoteric Doctrine of Color and Mood — tabella approvata, non ridiscutere.
export const BASHO_COLOR = {
  "C":[0xD9,0xB9,0x4E], "C#":[0xC9,0xA2,0x27], "D":[0x4C,0x6B,0x4F], "D#":[0x5B,0x47,0x70],
  "E":[0x28,0x32,0x4D], "F":[0xD9,0x72,0x2C], "F#":[0x5C,0x45,0x68], "G":[0x4F,0x8A,0x5B],
  "G#":[0x7A,0x3B,0x2E], "A":[0xA8,0x32,0x32], "A#":[0x7A,0x1F,0x1F], "B":[0x8C,0x4A,0x2F]
};
export const BASHO_MOOD = {
  "C":"sole", "C#":"soglia aurea", "D":"quiete pastorale", "D#":"agonia",
  "E":"blues, soul black", "F":"Creamsicle", "F#":"mountain moons", "G":"maestoso, Krishna",
  "G#":"dolore maturo", "A":"vino e rose", "A#":"intensificazione", "B":"bravata, pericolo"
};

export function mixColor(a, b, t){ return [ a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t ]; }
export function rgbStr(c){ return 'rgb('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+')'; }
export function pitchLabel(pos){
  const p = ((pos%12)+12)%12;
  const i0 = Math.floor(p)%12;
  const cents = Math.round((p-i0)*100);
  return NOTE_NAMES[i0] + (cents>4 ? '+'+cents : '');
}
export function freqForPos(pos){ return BASE_FREQ*Math.pow(2,pos/12); }
export function mapRange(v,a,b,c,d){ return c + (d-c)*((v-a)/(b-a)); }
export function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
