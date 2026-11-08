import {decodePcmPacket,SYSTEM_AUDIO_URL} from './nativePcm.ts';

/** No discovery scans: one loopback endpoint, bounded reconnect, explicit Stop. */
export function createNativeAudioTransport(port:{postMessage:(message:unknown,transfer?:Transferable[])=>void},status:(ready:boolean,message:string)=>void){
 let socket:WebSocket|null=null,timer:ReturnType<typeof setTimeout>|undefined,watchdog:ReturnType<typeof setInterval>|undefined;
 let stopped=false,attempt=0,lastMessage=0,lastSequence:number|undefined,ready=false;
 const notify=(next:boolean,message:string)=>{ready=next;status(next,message);};
 const clear=()=>port.postMessage({clear:true});
 const connect=()=>{
  if(stopped)return;
  lastSequence=undefined;lastMessage=performance.now();
  const ws=new WebSocket(SYSTEM_AUDIO_URL);socket=ws;ws.binaryType='arraybuffer';
  ws.onopen=()=>{lastMessage=performance.now();notify(false,'Audio helper connected — waiting for system audio');};
  ws.onmessage=event=>{
   if(stopped||socket!==ws)return;
   lastMessage=performance.now();
   if(event.data instanceof ArrayBuffer){
    const packet=decodePcmPacket(event.data);if(!packet){ws.close(1002,'Invalid PCM frame');return;}
    if(lastSequence!==undefined){const distance=(packet.sequence-lastSequence)>>>0;if(!distance||distance>=0x80000000)return;}
    lastSequence=packet.sequence;attempt=0;
    port.postMessage({samples:packet.samples,channels:packet.channels,rate:packet.rate},[packet.samples.buffer]);
    if(!ready)notify(true,'System audio connected');
   }else if(typeof event.data==='string'&&event.data.length<2048){
    try{const m=JSON.parse(event.data);if(m.type==='status'&&typeof m.message==='string'){
     if(m.state!=='ready'){clear();if(ready||m.message)notify(false,m.message.slice(0,180));}
    }}catch{ws.close(1002,'Invalid helper message');}
   }
  };
  ws.onerror=()=>{}; // close carries retry state; browsers hide handshake details.
  ws.onclose=()=>{
   if(stopped||socket!==ws)return;
   clear();notify(false,'Audio helper unavailable — start Omnium Audio Helper. Retrying…');
   timer=setTimeout(connect,Math.min(8000,1000*Math.pow(2,attempt++)));
  };
 };
 connect();watchdog=setInterval(()=>{if(socket&&performance.now()-lastMessage>5000){clear();socket.close();}},1000);
 return {stop(){stopped=true;clearTimeout(timer);clearInterval(watchdog);const ws=socket;socket=null;if(ws){ws.onclose=null;ws.onmessage=null;ws.close();}clear();}};
}
