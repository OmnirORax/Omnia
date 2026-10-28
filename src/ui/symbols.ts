/** Shared two-tone pen/eraser silhouette, with no underline. */
export function penEraserSymbol(pen:boolean){
  const upper=pen?'#fff':'#000',lower=pen?'#000':'#fff';
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g stroke="#888" stroke-width=".7" stroke-linejoin="round"><path fill="${upper}" d="M9.5 6.5 14 2a2.5 2.5 0 0 1 3.5 0L22 6.5a2.5 2.5 0 0 1 0 3.5l-4.5 4.5Z"/><path fill="${lower}" d="m9.5 6.5 8 8-6 6a3 3 0 0 1-4.2 0l-3.8-3.8a3 3 0 0 1 0-4.2Z"/></g></svg>`)}`;
}
export const PEN_SYMBOL=penEraserSymbol(true),ERASER_SYMBOL=penEraserSymbol(false);
