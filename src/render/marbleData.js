// Campi Sobel pre-calcolati (uno per marmo) e flag di stato del caricamento.
// Popolato una sola volta all'avvio da loadAllMarbles(); il resto
// dell'applicazione legge solo da qui.
export const marbleData = { magMaps: {}, ready: false };
