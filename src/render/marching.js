// MARCHING SQUARES — estrazione vettoriale delle linee di livello dal campo
// (stessa tecnica delle mappe altimetriche: curve di livello, non riempimento
// pixel). Chiamata ogni frame su una griglia rada che campiona il campo Sobel
// pre-calcolato: e' una NUOVA estrazione da un campo continuo, non un
// crossfade tra due output — il fotogramma intermedio e' genuinamente nuovo.
export function marchingSquares(sampleFn, gridRes, threshold, outFlat){
  for(let gy=0; gy<gridRes-1; gy++){
    for(let gx=0; gx<gridRes-1; gx++){
      const tl = sampleFn(gx,gy), tr = sampleFn(gx+1,gy);
      const bl = sampleFn(gx,gy+1), br = sampleFn(gx+1,gy+1);
      const cN = (tl>threshold)!==(tr>threshold);
      const cE = (tr>threshold)!==(br>threshold);
      const cS = (bl>threshold)!==(br>threshold);
      const cW = (tl>threshold)!==(bl>threshold);
      if(!cN && !cE && !cS && !cW) continue;
      const x0=gx/gridRes, y0=gy/gridRes, x1=(gx+1)/gridRes, y1=(gy+1)/gridRes;
      let pNx,pNy,pEx,pEy,pSx,pSy,pWx,pWy;
      if(cN){ const t=(threshold-tl)/(tr-tl); pNx=x0+(x1-x0)*t; pNy=y0; }
      if(cE){ const t=(threshold-tr)/(br-tr); pEx=x1; pEy=y0+(y1-y0)*t; }
      if(cS){ const t=(threshold-bl)/(br-bl); pSx=x0+(x1-x0)*t; pSy=y1; }
      if(cW){ const t=(threshold-tl)/(bl-tl); pWx=x0; pWy=y0+(y1-y0)*t; }
      const n = (cN?1:0)+(cE?1:0)+(cS?1:0)+(cW?1:0);
      if(n===2){
        if(cN&&cE){ outFlat.push(pNx,pNy,pEx,pEy); }
        else if(cE&&cS){ outFlat.push(pEx,pEy,pSx,pSy); }
        else if(cS&&cW){ outFlat.push(pSx,pSy,pWx,pWy); }
        else if(cW&&cN){ outFlat.push(pWx,pWy,pNx,pNy); }
        else if(cN&&cS){ outFlat.push(pNx,pNy,pSx,pSy); }
        else if(cE&&cW){ outFlat.push(pEx,pEy,pWx,pWy); }
      } else if(n===4){
        const center=(tl+tr+bl+br)/4;
        if(center>threshold){
          outFlat.push(pNx,pNy,pWx,pWy, pEx,pEy,pSx,pSy);
        } else {
          outFlat.push(pNx,pNy,pEx,pEy, pWx,pWy,pSx,pSy);
        }
      }
    }
  }
}
