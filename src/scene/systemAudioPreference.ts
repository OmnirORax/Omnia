import {systemAudioOriginSupported,systemAudioRequiresPairing} from './nativePcm.ts';
/** Device-local connection preference, deliberately excluded from workspace/export/history. */
export const SYSTEM_AUDIO_PREFERENCE_KEY='omnium.system-audio.connection.v1';
export type SystemAudioPreference={version:1;code:string;enabled:boolean};
export const validPairingCode=(code:string)=>/^[A-Za-z0-9_-]{32}$/.test(code);
function parse(raw:string|null):SystemAudioPreference|null{
 if(raw===null)return null;
 const value=JSON.parse(raw);
 if(value?.version!==1||typeof value.enabled!=='boolean'||typeof value.code!=='string'||value.code!==''&&!validPairingCode(value.code))throw Error('Unrecognized audio connection preference');
 return value;
}
export function readSystemAudioPreference():SystemAudioPreference|null{
 try{return parse(localStorage.getItem(SYSTEM_AUDIO_PREFERENCE_KEY));}catch{return null;}
}
export function saveSystemAudioPreference(code:string,enabled:boolean):boolean{
 try{
  // Unknown/corrupt preferences are not silently replaced; Forget explicitly removes them.
  parse(localStorage.getItem(SYSTEM_AUDIO_PREFERENCE_KEY));
  if(code!==''&&!validPairingCode(code))return false;
  localStorage.setItem(SYSTEM_AUDIO_PREFERENCE_KEY,JSON.stringify({version:1,code,enabled}));return true;
 }catch{return false;}
}
/** Fresh trusted origins need no pairing; previews still require a device-local code. */
export function shouldStartSystemAudio(origin:string):boolean{
 if(!systemAudioOriginSupported(origin))return false;
 try{
  const raw=localStorage.getItem(SYSTEM_AUDIO_PREFERENCE_KEY),saved=parse(raw);
  return saved?saved.enabled&&(!systemAudioRequiresPairing(origin)||validPairingCode(saved.code)):raw===null&&!systemAudioRequiresPairing(origin);
 }catch{return false;}
}
export function pauseRememberedSystemAudio(){const saved=readSystemAudioPreference();saveSystemAudioPreference(saved?.code??'',false);}
export function forgetSystemAudioPreference(){try{localStorage.removeItem(SYSTEM_AUDIO_PREFERENCE_KEY);}catch{/* Connection can still stop when storage is blocked. */}}
