import { CURVE_POINTS, curveValue, type Curve } from '../properties/curve.ts';
export function paintCurve(curve: Curve, from: {x:number;y:number}, to = from): Curve {
  const values=[...curve], a=Math.max(0,Math.min(CURVE_POINTS-1,Math.round(from.x*(CURVE_POINTS-1)))), b=Math.max(0,Math.min(CURVE_POINTS-1,Math.round(to.x*(CURVE_POINTS-1))));
  for(let i=Math.min(a,b);i<=Math.max(a,b);i++)values[i]=Math.max(0,Math.min(1,a===b?to.y:from.y+(to.y-from.y)*(i-a)/(b-a)));
  return values;
}
type Labels = { name:string;left:string;right:string;top:string;point:(x:number)=>string };
type Options = {
  read:()=>Curve;preview:(curve:Curve)=>void;commit:(curve:Curve)=>void;cancel:()=>void;
  labels:()=>Labels;trace:()=>{input:number;histogram?:ArrayLike<number>};error:(error:unknown)=>void;
};
export function curveEditor(options: Options) {
  const root=document.createElement('div'), svg=document.createElementNS('http://www.w3.org/2000/svg','svg');root.className='response-curve';
  svg.setAttribute('viewBox','0 0 320 160');svg.setAttribute('tabindex','0');svg.setAttribute('role','slider');svg.setAttribute('aria-valuemin','0');svg.setAttribute('aria-valuemax','100');
  const ns=svg.namespaceURI!, bars=document.createElementNS(ns,'g'), line=document.createElementNS(ns,'polyline'), dot=document.createElementNS(ns,'circle'),points=document.createElementNS(ns,'g');
  line.setAttribute('class','curve-line');dot.setAttribute('class','curve-trace');dot.setAttribute('r','4');
  const rectangles=Array.from({length:32},(_,i)=>{const r=document.createElementNS(ns,'rect');r.setAttribute('x',String(8+i*304/32));r.setAttribute('width',String(304/32-1));bars.append(r);return r;});bars.setAttribute('class','curve-histogram');
  const handles=Array.from({length:CURVE_POINTS},(_,i)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',String(8+i*304/(CURVE_POINTS-1)));c.setAttribute('r','2.5');points.append(c);return c;});points.setAttribute('class','curve-handles');
  svg.append(bars,line,points,dot);
  const axis=document.createElement('div'),left=document.createElement('span'),name=document.createElement('span'),right=document.createElement('span'),maximum=document.createElement('span');axis.className='curve-axis';axis.append(left,name,right);maximum.className='curve-maximum';root.append(maximum,svg,axis);
  let active=0,gesture:{id:number;last:{x:number;y:number}}|undefined,frame=0;
  function refresh(){
    const curve=options.read(),labels=options.labels();
    left.textContent=labels.left;right.textContent=labels.right;name.textContent=labels.name;maximum.textContent=labels.top;
    line.setAttribute('points',curve.map((y,i)=>`${8+i*304/(CURVE_POINTS-1)},${152-y*144}`).join(' '));
    handles.forEach((h,i)=>{h.setAttribute('cy',String(152-curve[i]*144));h.classList.toggle('active',i===active);});
    svg.setAttribute('aria-label',`${labels.name} · ${labels.point(active/(CURVE_POINTS-1))}`);svg.setAttribute('aria-valuenow',String(Math.round(curve[active]*100)));
    trace();
  }
  function trace(){
    const t=options.trace(), curve=options.read(), x=Math.max(0,Math.min(1,t.input));
    dot.setAttribute('cx',String(8+x*304));dot.setAttribute('cy',String(152-curveValue(curve,x)*144));
    let max=0;for(let i=0;i<32;i++)max=Math.max(max,t.histogram?.[i]??0);
    rectangles.forEach((r,i)=>{const height=max?((t.histogram?.[i]??0)/max)*112:0;r.setAttribute('y',String(152-height));r.setAttribute('height',String(height));});
  }
  function position(event:PointerEvent){const box=svg.getBoundingClientRect();return{x:Math.max(0,Math.min(1,((event.clientX-box.left)/box.width*320-8)/304)),y:Math.max(0,Math.min(1,(152-(event.clientY-box.top)/box.height*160)/144))};}
  function preview(p:{x:number;y:number}){if(!gesture)return;options.preview(paintCurve(options.read(),gesture.last,p));gesture.last=p;active=Math.round(p.x*(CURVE_POINTS-1));refresh();}
  function cancel(){if(!gesture)return;const id=gesture.id;gesture=undefined;if(frame)cancelAnimationFrame(frame);frame=0;if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);options.cancel();refresh();}
  svg.onpointerdown=event=>{if(event.button!==0||gesture)return;event.preventDefault();svg.focus();const p=position(event);gesture={id:event.pointerId,last:p};svg.setPointerCapture(event.pointerId);preview(p);};
  svg.onpointermove=event=>{if(!gesture||gesture.id!==event.pointerId)return;const p=position(event);if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;preview(p);});};
  svg.onpointerup=event=>{if(!gesture||gesture.id!==event.pointerId)return;if(frame)cancelAnimationFrame(frame);frame=0;preview(position(event));gesture=undefined;svg.releasePointerCapture(event.pointerId);try{options.commit(options.read());}catch(error){options.cancel();options.error(error);}refresh();};
  svg.onpointercancel=svg.onlostpointercapture=()=>cancel();
  svg.onkeydown=event=>{
    if(event.key==='Escape'&&gesture){event.preventDefault();event.stopPropagation();cancel();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();
    if(event.key==='ArrowLeft'||event.key==='ArrowRight')active=Math.max(0,Math.min(CURVE_POINTS-1,active+(event.key==='ArrowLeft'?-1:1)));
    else{const next=[...options.read()];next[active]=Math.max(0,Math.min(1,next[active]+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?.1:.02)));try{options.preview(next);options.commit(next);}catch(error){options.cancel();options.error(error);}}
    refresh();
  };
  const timer=setInterval(()=>{if(root.isConnected&&!document.hidden)trace();},100);
  refresh();return{root,refresh,cancel,get editing(){return !!gesture;},dispose(){cancel();clearInterval(timer);if(frame)cancelAnimationFrame(frame);}};
}
