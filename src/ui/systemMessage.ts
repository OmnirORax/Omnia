/** Shared route into the application's existing bottom-left system status. */
export const SYSTEM_MESSAGE='omnium:system-message';
export function reportSystemMessage(message:string){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(SYSTEM_MESSAGE,{detail:message}));}
