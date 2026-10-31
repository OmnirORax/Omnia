/** Whole-unit substrate traversal. Timing never participates in deposition. */
export const PATH_UNIT = 1;
export type PathRule = {s:[number,number][];t:number;l:boolean;c:boolean;m:number;a:boolean;p:number;d:boolean;r:number};
export const DEFAULT_PATH_RULE:PathRule={s:[],t:0,l:false,c:false,m:100,a:false,p:100,d:false,r:8};
export const SQUARE_PATH_RULE:PathRule={...DEFAULT_PATH_RULE,s:[[0,2]],t:90,l:true,c:true};
export function readPathRule(text:string):PathRule {
 let v:PathRule;try{v=JSON.parse(text);}catch{throw Error('Invalid path rule.');}
 const integer=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isInteger(n)&&n>=min&&n<=max;
 if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['s','t','l','c','m','a','p','d','r'].includes(k))||!Array.isArray(v.s)||v.s.length>8||v.s.some(s=>!Array.isArray(s)||s.length!==2||![0,90,180,270].includes(s[0])||!integer(s[1],1,100))||![0,90,180,270].includes(v.t)||!['l','c','a','d'].every(k=>typeof v[k as keyof PathRule]==='boolean')||!integer(v.m,1,10000)||!integer(v.p,1,100)||!integer(v.r,1,60))throw Error('Unsupported path rule: use whole-unit moves and quarter turns.');
 return v;
}
export type PathBounds={left:number;top:number;right:number;bottom:number;round?:boolean};
type Point={x:number;y:number};
type Plan={points:Point[];cycle?:number;reason:'closure'|'sequence'|'boundary'|'budget'|'loop'};
const cache=new Map<string,Plan>();
/** Compile once per rule/domain, detect periodic state and bound nonperiodic work. */
function compile(rule:PathRule,bounds:PathBounds):Plan {
 const key=JSON.stringify([rule,bounds]);const cached=cache.get(key);if(cached)return cached;
 readPathRule(JSON.stringify(rule));
 if(![bounds.left,bounds.top,bounds.right,bounds.bottom].every(Number.isFinite)||bounds.left>bounds.right||bounds.top>bounds.bottom)throw Error('Invalid path substrate bounds.');
 if(!rule.s.length)return {points:[],reason:'sequence'};
 const points:Point[]=[{x:0,y:0}],seen=new Map<string,number>(),cells=new Set(['0,0']);let x=0,y=0,index=0,remaining=rule.s[0][1],turn=0;
 let result:Plan={points,reason:'budget'};
 const inside=(x:number,y:number)=>{
  if(x-.5<bounds.left||x+.5>bounds.right||y-.5<bounds.top||y+.5>bounds.bottom)return false;
  if(!bounds.round)return true;
  const cx=(bounds.left+bounds.right)/2,cy=(bounds.top+bounds.bottom)/2,r=Math.min(bounds.right-bounds.left,bounds.bottom-bounds.top)/2;
  return Math.hypot(Math.abs(x-cx)+.5,Math.abs(y-cy)+.5)<=r;
 };
 if(!inside(0,0))result={points:[],reason:'boundary'};
 else for(let n=0;n<4096;n++){
  const state=[x,y,index,remaining,turn].join(',');const prior=seen.get(state);
  if(prior!==undefined){result={points,cycle:prior,reason:'loop'};break;}seen.set(state,points.length-1);
  const heading=(rule.s[index][0]+turn)%360,dx=heading===90?1:heading===270?-1:0,dy=heading===180?1:heading===0?-1:0;
  const nx=x+dx,ny=y+dy,cell=`${nx},${ny}`;
  if(!inside(nx,ny)){result={points,reason:'boundary'};break;}
  if(!cells.has(cell)&&cells.size>=192)break;
  x=nx;y=ny;cells.add(cell);points.push({x,y});remaining--;
  if(remaining===0){
   turn=(turn+rule.t)%360;index++;
   if(index===rule.s.length){
    if(rule.c&&x===0&&y===0){result={points,reason:'closure'};break;}
    if(!rule.l){result={points,reason:'sequence'};break;}index=0;
   }
   remaining=rule.s[index][1];
  }
 }
 cache.set(key,result);if(cache.size>32)cache.delete(cache.keys().next().value!);return result;
}
export type PathTrace={cells:(Point&{coverage:number})[];particle?:Point;steps:number;reason:Plan['reason']|'limit'|'running';moving:boolean};
export function pathTrace(rule:PathRule,bounds:PathBounds,time=0):PathTrace {
 if(!Number.isFinite(time)||time<0)throw Error('Invalid path time.');
 const plan=compile(rule,bounds),points=plan.points,available=Math.max(0,points.length-1);
 const requested=rule.a?Math.min(Number.MAX_SAFE_INTEGER,Math.floor(time*rule.r)):rule.m;
 const total=plan.cycle===undefined?Math.min(requested,available):requested;
 const counts=new Map<string,Point&{coverage:number}>();
 const deposit=(p:Point,visits:number)=>{const key=`${p.x},${p.y}`,old=counts.get(key);counts.set(key,{...p,coverage:Math.min(100,(old?.coverage??0)+visits*rule.p)});};
 const prefix=plan.cycle??available,first=Math.min(total,prefix);
 for(let i=1;i<=first;i++)deposit(points[i],1);
 let particle=points[Math.min(total,available)];
 if(plan.cycle!==undefined&&total>prefix){
  const length=available-prefix,cycles=Math.floor((total-prefix)/length),tail=(total-prefix)%length;
  for(let i=1;i<=length;i++)if(cycles+(i<=tail?1:0))deposit(points[prefix+i],cycles+(i<=tail?1:0));
  particle=points[prefix+tail];
 }
 return {cells:[...counts.values()],particle:particle?{...particle}:undefined,steps:total,reason:!rule.a&&total===rule.m?'limit':rule.a&&(plan.cycle!==undefined||total<available)?'running':plan.reason,moving:rule.a&&(plan.cycle!==undefined||total<available)};
}
