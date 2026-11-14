import { sameValue } from "../valueEquality.ts";
import { createTransientStore } from "./transientStore.ts";

export type HistoryMode = "recent" | "context" | "selective";
export type HistoryCategory = "omnium" | "ui" | "appearance" | "settings" | "camera";
export type HistoryOptions = { mode: HistoryMode; categories: HistoryCategory[]; steps: number; limit: number; minimum: number };
type Patch = { path: string[]; before: unknown; after: unknown };
type Adapter = { read: () => unknown; write: (value: any) => void };
type Entry = { id: number; owner: string; categories: HistoryCategory[]; contexts: string[]; patches: Patch[]; undone: boolean; group?: string; at: number; changes?:Entry[]; actionId?:string };
const equal = (a: unknown, b: unknown) => sameValue(a, b);
function diff(before: any, after: any, path: string[] = [], out: Patch[] = []): Patch[] {
  if (before === after) return out;
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) diff(before[key], after[key], [...path, key], out);
  } else if (!equal(before, after)) out.push({ path, before, after });
  return out;
}
const atPath = (value: any, path: string[]) => path.reduce((node, key) => node?.[key], value);
function put(value: any, path: string[], next: unknown): any {
  if (!path.length) return next;
  const [key, ...tail] = path, copy = { ...value };
  if (!tail.length && next === undefined) delete copy[key];
  else copy[key] = put(value?.[key], tail, next);
  return copy;
}
export type ActionHistory = {
  getSnapshot: () => number; subscribe: (listener: () => void) => () => void; set: (value: number) => void;
  activeContext: string; contextPath: string[]; options: HistoryOptions; message: string;
  register: (owner: string, adapter: Adapter) => () => void;
  readonly currentActionId:string|undefined;
  transaction: (action:()=>void,actionId?:string) => void;
  configure: (patch: Partial<HistoryOptions>) => void;
  record: (owner: string, before: unknown, after: unknown, categories: HistoryCategory[], contexts: string[], group?: string) => void;
  candidates: (direction: "undo" | "redo", options?: HistoryOptions) => Entry[];
  travel: (direction: "undo" | "redo", options?: HistoryOptions) => number;
};
export function createActionHistory(initial?: Partial<HistoryOptions>): ActionHistory {
  const store = createTransientStore(0), adapters = new Map<string, Adapter>();
  let entries: Entry[] = [], redoOrder: number[] = [], sequence = 0, replaying = false, transactionDepth=0;
  let actionId:string|undefined;
  const eventId=()=>typeof window!=='undefined'&&window.event?`${window.event.type}:${window.event.timeStamp}`:undefined;
  let pending:Entry[]=[];const pendingValues=new Map<string,{before:unknown;after:unknown}>();
  const api: ActionHistory = {
    ...store,
    activeContext: "omnium", contextPath: ["omnium"],
    options: { mode: "recent", categories: ["ui"], steps: 1, limit: 10, minimum: 1 } as HistoryOptions,
    message: "",
    register(owner: string, adapter: Adapter) { adapters.set(owner, adapter); return () => { if (adapters.get(owner) === adapter) adapters.delete(owner); }; },
    configure(patch: Partial<HistoryOptions>) {
      const next = { ...api.options, ...patch };
      next.limit = Math.max(1, Math.min(10, Math.floor(Number(next.limit) || 1)));
      next.minimum = Math.max(1, Math.min(next.limit, Math.floor(Number(next.minimum) || 1)));
      next.steps = Math.max(next.minimum, Math.min(next.limit, Math.floor(Number(next.steps) || 1)));
      api.options = next; store.set(store.getSnapshot() + 1);
    },
    get currentActionId(){return actionId??eventId();},
    transaction(action,id){
      const previousId=actionId;if(!transactionDepth)actionId=id??eventId();transactionDepth++;
      try{action();}finally{
        transactionDepth--;
        if(!transactionDepth)flushPending();actionId=previousId;
      }
    },
    record(owner: string, before: unknown, after: unknown, categories: HistoryCategory[], contexts: string[], group?: string) {
      if (replaying) return;
      const patches = diff(before, after); if (!patches.length) return;
      if(transactionDepth){
        const initial=pendingValues.get(owner);pendingValues.set(owner,{before:initial?initial.before:before,after});
        const previous=pending.find(entry=>entry.owner===owner);
        if(previous){let original=before;for(const patch of previous.patches)original=put(original,patch.path,patch.before);previous.patches=diff(original,after);previous.categories=[...new Set([...previous.categories,...categories])];previous.contexts=[...new Set([...previous.contexts,...contexts])];pending=pending.filter(entry=>entry.patches.length);}
        else pending.push({id:++sequence,owner,categories,contexts,patches,undone:false,group,at:Date.now()});
        return;
      }
      entries = entries.filter(entry => !entry.undone); redoOrder = [];
      const previous = entries.at(-1), now = Date.now(),id=api.currentActionId;
      if(id&&previous?.actionId===id){mergeEntry(previous,{id:++sequence,owner,categories,contexts,patches,undone:false,at:now,actionId:id});api.message='';store.set(store.getSnapshot()+1);return;}
      if (group && !previous?.changes && previous?.group === group && previous.owner === owner && now - previous.at < 700) {
        let original = before;
        for (const patch of previous.patches) original = put(original, patch.path, patch.before);
        previous.patches = diff(original, after); previous.at = now;previous.actionId=id;
        previous.contexts = [...new Set([...previous.contexts, ...contexts])];previous.categories = [...new Set([...previous.categories, ...categories])];
      } else entries.push({ id: ++sequence, owner, categories, contexts, patches, undone: false, group, at: now,actionId:id });
      entries = entries.filter(entry => entry.changes?.length||entry.patches.length).slice(-100);
      api.message = ''; store.set(store.getSnapshot() + 1);
    },
    candidates(direction: "undo" | "redo", options = api.options) {
      const ordered = direction === "undo" ? [...entries].reverse() : redoOrder.map(id => entries.find(entry => entry.id === id)!).filter(Boolean);
      return ordered.filter(entry => entry.undone === (direction === "redo") && (options.mode === "recent" || options.mode === "context" && entry.contexts.includes(api.activeContext) || options.mode === "selective" && entry.categories.some(category => options.categories.includes(category))));
    },
    travel(direction: "undo" | "redo", options = api.options) {
      flushPending();let count = 0; api.message = "";
      const steps = Math.max(options.minimum ?? 1, Math.min(10, options.limit, options.steps));
      for (const entry of api.candidates(direction, options).slice(0, steps)) {
        const changes=entry.changes??[entry],ordered=direction==='undo'?[...changes].reverse():changes;
        const expected=direction==='undo'?'after':'before',replacement=direction==='undo'?'before':'after';
        const prepared:{adapter:Adapter;before:unknown;after:unknown}[]=[];
        let blocked=false;
        for(const change of ordered){const adapter=adapters.get(change.owner);if(!adapter){api.message='This action owner is unavailable.';blocked=true;break;}
          let value=adapter.read();const before=value;
          if(change.patches.some(patch=>!equal(atPath(value,patch.path),patch[expected]))){api.message='A later edit overlaps this action. Undo the newer overlapping action first.';blocked=true;break;}
          for(const patch of change.patches)value=put(value,patch.path,patch[replacement]);prepared.push({adapter,before,after:value});
        }
        if(blocked)break;
        replaying=true;let written=0;
        try{for(const change of prepared){change.adapter.write(change.after);written++;}}
        catch{for(const change of prepared.slice(0,written).reverse())try{change.adapter.write(change.before);}catch{/* Retain the failure message. */}api.message='This action could not be restored safely; history was left unchanged.';blocked=true;}
        finally{replaying=false;}
        if(blocked)break;
        entry.undone = direction === "undo";
        redoOrder = redoOrder.filter(id => id !== entry.id); if (entry.undone) redoOrder.unshift(entry.id);
        count++;
      }
      store.set(store.getSnapshot() + 1); return count;
    },
  };
  function mergeEntry(previous:Entry,next:Entry){
    const changes=previous.changes??[{...previous,changes:undefined}];
    for(const incoming of next.changes??[next]){
      const prior=changes.find(change=>change.owner===incoming.owner);
      if(prior){const adapter=adapters.get(prior.owner)!;const after=adapter.read();let before=after;
        for(const patch of incoming.patches)before=put(before,patch.path,patch.before);
        for(const patch of prior.patches)before=put(before,patch.path,patch.before);
        prior.patches=diff(before,after);prior.categories=[...new Set([...prior.categories,...incoming.categories])];prior.contexts=[...new Set([...prior.contexts,...incoming.contexts])];
      }else changes.push(incoming);
    }
    const retained=changes.filter(change=>change.patches.length);
    if(retained.length===1){const id=previous.id,actionId=previous.actionId;Object.assign(previous,retained[0],{id,actionId,changes:undefined});}
    else{previous.owner='@transaction';previous.patches=[];previous.changes=retained;previous.categories=[...new Set(retained.flatMap(c=>c.categories))];previous.contexts=[...new Set(retained.flatMap(c=>c.contexts))];}
    if(!retained.length)entries=entries.filter(entry=>entry!==previous);
    previous.at=Date.now();
  }
  function flushPending(){
    if(!pending.length){pendingValues.clear();return;}
    const depth=transactionDepth;transactionDepth=0;
    try{const changes=pending;pending=[];
      if(changes.length===1){const entry=changes[0],values=pendingValues.get(entry.owner)!;api.record(entry.owner,values.before,values.after,entry.categories,entry.contexts,entry.group);}
      else{entries=entries.filter(entry=>!entry.undone);redoOrder=[];const entry:Entry={id:++sequence,owner:'@transaction',patches:[],changes,categories:[...new Set(changes.flatMap(c=>c.categories))],contexts:[...new Set(changes.flatMap(c=>c.contexts))],undone:false,at:Date.now(),actionId:api.currentActionId};const previous=entries.at(-1);if(entry.actionId&&previous?.actionId===entry.actionId)mergeEntry(previous,entry);else entries.push(entry);entries=entries.slice(-100);api.message='';store.set(store.getSnapshot()+1);}
    }finally{transactionDepth=depth;pendingValues.clear();}
  }
  if (initial) api.configure({
    ...(initial.mode && ["recent", "context", "selective"].includes(initial.mode) ? { mode: initial.mode } : {}),
    ...(Array.isArray(initial.categories) ? { categories: initial.categories.filter(id => ["omnium", "ui", "appearance", "settings", "camera"].includes(id)) } : {}),
    steps: initial.steps ?? 1, limit: initial.limit ?? 10, minimum: initial.minimum ?? 1,
  });
  return api;
}

