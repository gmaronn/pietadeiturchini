// PRECOMPUTE SOBEL — una volta sola per marmo (12 immagini, ~320x320),
// non ad ogni frame. Questo e' cio' che tiene tutto fluido: il marching
// squares per frame campiona solo questo campo gia' calcolato.
export const MAG_RES = 320;

export function computeSobelMagnitude(img, res){
  const c = document.createElement('canvas'); c.width=res; c.height=res;
  const cx = c.getContext('2d');
  cx.drawImage(img,0,0,res,res);
  const id = cx.getImageData(0,0,res,res);
  const d = id.data;
  const gray = new Float32Array(res*res);
  for(let i=0;i<res*res;i++) gray[i] = 0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  const mag = new Float32Array(res*res);
  for(let y=1;y<res-1;y++){
    for(let x=1;x<res-1;x++){
      const i=y*res+x;
      const gx = -gray[i-res-1]-2*gray[i-1]-gray[i+res-1]+gray[i-res+1]+2*gray[i+1]+gray[i+res+1];
      const gy = -gray[i-res-1]-2*gray[i-res]-gray[i-res+1]+gray[i+res-1]+2*gray[i+res]+gray[i+res+1];
      mag[i] = Math.sqrt(gx*gx+gy*gy);
    }
  }
  return mag;
}

// marbleUrls: { "C": url, "C#": url, ... } -> Promise<{ [note]: Float32Array }>
export function loadAllMarbles(marbleUrls){
  const notes = Object.keys(marbleUrls);
  const magMaps = {};
  let remaining = notes.length;
  return new Promise(resolve=>{
    notes.forEach(note=>{
      const img = new Image();
      img.onload = ()=>{
        magMaps[note] = computeSobelMagnitude(img, MAG_RES);
        remaining--;
        if(remaining<=0) resolve(magMaps);
      };
      img.src = marbleUrls[note];
    });
  });
}
