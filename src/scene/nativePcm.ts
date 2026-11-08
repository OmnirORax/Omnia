/** Versioned local-helper PCM protocol. These samples never enter saved settings. */
export const SYSTEM_AUDIO_URL='ws://127.0.0.1:8986/omnium/audio-v1';
export const systemAudioRequiresPairing=(origin:string)=>origin==='https://raw.githack.com'||/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.omnia-web-bae\.pages\.dev$/.test(origin);
export const systemAudioOriginSupported=(origin:string)=>systemAudioRequiresPairing(origin)||origin==='https://omnium.nexus'||/^http:\/\/(?:localhost|127\.0\.0\.1):[0-9]{1,5}$/.test(origin);
export function decodePcmPacket(buffer:ArrayBuffer){
 if(buffer.byteLength<16)return;
 const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x31414d4f)return; // OMA1
 const rate=view.getUint32(4,true),channels=view.getUint16(8,true),frames=view.getUint16(10,true),sequence=view.getUint32(12,true);
 if(rate<8000||rate>192000||channels<1||channels>32||frames<1||frames>4096||buffer.byteLength!==16+channels*frames*4)return;
 const samples=new Float32Array(buffer,16);
 for(const value of samples)if(!Number.isFinite(value))return;
 return {rate,channels,sequence,samples};
}

/** Bounded stereo queue with linear sample-rate conversion and no stale backlog.
 * Self-contained: also instantiated inside the AudioWorklet below. */
export class PcmQueue {
 left=new Float32Array(32768);right=new Float32Array(32768);read=0;write=0;count=0;phase=0;rate=48000;started=false;
 clear(){this.read=this.write=this.count=this.phase=0;this.started=false;}
 push(samples:Float32Array,channels:number,rate:number){
  if(rate!==this.rate){this.clear();this.rate=rate;}
  const frames=samples.length/channels,keep=Math.min(this.left.length-2,Math.ceil(rate*.06));
  if(this.count+frames>keep){const drop=Math.min(this.count,Math.max(0,this.count+frames-keep));this.read=(this.read+drop)%this.left.length;this.count-=drop;this.phase=0;}
  for(let frame=Math.max(0,frames-keep);frame<frames;frame++){
   const i=frame*channels;
   this.left[this.write]=samples[i];this.right[this.write]=samples[i+(channels>1?1:0)];
   this.write=(this.write+1)%this.left.length;this.count++;
  }
 }
 render(left:Float32Array,right:Float32Array,outputRate:number){
  left.fill(0);right.fill(0);
  if(!this.started){if(this.count<Math.ceil(this.rate*.015))return;this.started=true;}
  const step=this.rate/outputRate;
  for(let i=0;i<left.length;i++){
   if(this.count<Math.max(2,Math.ceil(step)+1)){this.clear();break;}
   const next=(this.read+1)%this.left.length;
   left[i]=this.left[this.read]+(this.left[next]-this.left[this.read])*this.phase;
   right[i]=this.right[this.read]+(this.right[next]-this.right[this.read])*this.phase;
   this.phase+=step;const advance=Math.floor(this.phase);this.phase-=advance;
   this.read=(this.read+advance)%this.left.length;this.count-=advance;
  }
 }
}
/** Inline module keeps the static GitHack build self-contained. */
export const pcmWorkletSource=()=>`const Queue=${PcmQueue.toString()};
class OmniumSystemPcm extends AudioWorkletProcessor{
 constructor(){super();this.queue=new Queue();this.port.onmessage=event=>{const m=event.data;if(m.clear)this.queue.clear();else this.queue.push(m.samples,m.channels,m.rate);};}
 process(inputs,outputs){const out=outputs[0];if(out&&out.length>=2)this.queue.render(out[0],out[1],sampleRate);return true;}
}registerProcessor('omnium-system-pcm',OmniumSystemPcm);`;
