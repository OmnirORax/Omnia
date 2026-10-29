import { MathematicalDial } from '../ui/MathematicalDial';
import { radialTree } from '../ui/radialMenuModel';
import { DegreeSetter } from './DegreeSetter';
import { useContextCommands } from './useContextCommands';
import { atomnicViewBounds } from './atomnicSettings.ts';
import { functionInputValue } from "../properties/runtimeInputs";
import { OMNIC_CONSUMER } from "./omnic.function";
import { operationTool, isOperationTool, applyOperationTool, insertConstruction } from "./tools";
import { snappedAngle, rotationStops } from "./rotation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { closedComposerDraft, forgetClosedComposerDraft, preserveClosedComposerHistory } from "./draftHistory";
import { objectResolver } from "./revisions";
import type { Recipe, Component, Application, Params } from "./model";
import { validateRecipe } from "./model";
import { evaluateRecipe } from "./evaluate";
import { evaluationBounds, renderSVG, pickStructuralNode } from "./svg";
import { PRESETS, createRecipe } from "./presets";
import { GENERATORS, OPERATORS, defaultParams, applicableParameters, type Parameter, type Definition } from "./registry";
import { commitOmnicParameter, useOmnicParameterBindings } from "./propertyAdapter";
import { PropertyEditor } from "../appearance/Controls";
import { UISection } from "../ui/UISection";
import { UIField } from "../ui/UIField";
import { UIAction } from "../ui/UIAction";
import { FunctionControl } from "../ui/UIWorkspace";
import { useFeatureActions } from "../ui/useFeatureActions";
import type { ActionHistory } from "../ui/actionHistory";
import { RENDER_BUDGET } from "../renderBudget";
import "./composer.css";
import { AtomnicEditor } from "./AtomnicEditor";
import type { AtomnicInteraction } from "./atomnicInteraction";
import { FEATURE_ACTIONS, radialGroups } from '../featureActions';
import type { RadialEntry, RadialGroup } from '../ui/radialMenuModel';
import type { ReactNode } from 'react';
import { ProgressiveConfiguration } from '../ui/ProgressiveConfiguration';
import { RadialMenu } from '../ui/RadialMenu';

import { VISUAL_FREEDOM_GROUP, type EditableDegree } from '../properties/editableDegrees';
import { targetDegrees, targetDegreeValue, writeTargetDegree, targetParameter } from './targetDegrees';
import { nameSymbol } from '../ui/nameSymbols';
import { RangeSettingsScope } from '../ui/RangeControl';

type ObjectRef = { id: string; label: string; omnic?: Recipe; omnicHistory?: Recipe[] };
type Props = {
  workspaceId?: string; presetIds?:readonly string[]; entity: ObjectRef; objects: readonly ObjectRef[]; history: ActionHistory;
  isNew?: boolean; initialRecipe?: Recipe; onPreview?: (recipe: Recipe | null, editing?: AtomnicInteraction) => void;
  radar?:boolean;
  onSave: (recipe: Recipe, label?: string) => void; onCopy: (recipe: Recipe, label: string) => void; onClose: () => void;
};
type Focus = { kind: "component" | "operation"; id: string };
type RadarPanel={kind:'parameters';index:number}|{kind:'reference'|'dependency'|'presets'|'scope'|'inspect'};
const storageKey = (id: string) => `omnium.omnic.draft.v1:${id}`;
const normalizedHistory = (recipe: Recipe) => ({ ...recipe, revision: 0 });
const allComponents = (components: readonly Component[]): Component[] => components.flatMap(component => [component, ...allComponents(component.children ?? [])]);
const updateComponents = (components: Component[], id: string, change: (component: Component) => Component): Component[] => components.map(component => component.id === id ? change(component) : component.children ? { ...component, children: updateComponents(component.children, id, change) } : component);
const removeComponent = (components: Component[], id: string): Component[] => components.filter(component => component.id !== id).map(component => component.children ? { ...component, children: removeComponent(component.children, id) } : component);
const id = () => crypto.randomUUID();
function restoredDraft(entity: ObjectRef, draftId=entity.id, initialRecipe?: Recipe): { recipe: Recipe; baseRevision: number | null } {
  const closed = closedComposerDraft(`omnic.draft:${draftId}`); if (closed) return closed;
  try {
    const raw = localStorage.getItem(storageKey(draftId));
    if (raw) { const saved = JSON.parse(raw); return { recipe: validateRecipe(saved.recipe), baseRevision: Number.isSafeInteger(saved.baseRevision) ? saved.baseRevision : null }; }
  } catch { /* A damaged draft never prevents opening the canonical object. */ }
  return { recipe: validateRecipe(entity.omnic ?? initialRecipe ?? createRecipe()), baseRevision: entity.omnic?.revision ?? null };
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function Parameters({ scope, spec, params, thresholds, change }: {
  scope: string; spec: Definition; params: Params; thresholds: boolean; change: (parameter: Parameter, value: string | number | boolean, preview: boolean) => void;
}) {
  return <div className="omnic-parameters">{applicableParameters(spec,params).map(parameter => <UIField key={parameter.key} id={`omnic:${scope}:${parameter.key}`} label={parameter.label} category="Omnic">
    <label className="omnic-parameter"><span>{parameter.label}</span>{thresholds && parameter.thresholds?.length ? <div className="omnic-thresholds" role="group" aria-label={`${parameter.label} parameter presets`}>
      {parameter.thresholds.map(value => <button key={value} type="button" aria-pressed={(params[parameter.key] ?? parameter.initial) === value} onClick={() => change(parameter, value, false)}>{value}</button>)}
    </div> : <PropertyEditor property={parameter.property} label={parameter.label} value={params[parameter.key] ?? parameter.initial}
      limits={parameter.kind === "number" ? { min: parameter.min!, max: parameter.max! } : undefined}
      choices={parameter.options?.map(option => option.id)} onPreview={value => change(parameter, value, true)} onCommit={value => change(parameter, value, false)} />}</label>
  </UIField>)}</div>;
}

/** A requested preset freedom borrows the existing contextual property adapter. */
function PresetDegreeEditor({recipe,degree,configure,onPreview,onCommit,onBack,onConfirm}: {
  recipe:Recipe;degree:EditableDegree;configure?:boolean;onPreview:(value:string|number|boolean)=>void;onCommit:(value:string|number|boolean)=>void;onBack:()=>void;onConfirm:()=>void;
}) {
  const parameter=targetParameter(degree);
  const value=targetDegreeValue(recipe,degree);
  const parameters=useMemo(()=>[parameter],[parameter]);
  const values=useMemo(()=>({[parameter.key]:value}),[parameter.key,value]);
  useOmnicParameterBindings(values,next=>onCommit(next[parameter.key]),parameters);
  return <div className="progressive-configuration">
    {parameter.picker==='mathematical'&&!configure?<MathematicalDial value={Number(value)} min={parameter.min!} max={parameter.max!} onPreview={onPreview} onCommit={onCommit}/>:<PropertyEditor property={degree.properties[0]} label={degree.label} value={value} configuration={configure?'step':undefined} limits={parameter.kind==='number'?{min:parameter.min!,max:parameter.max!}:undefined} choices={parameter.options?.map(option=>option.id)} onPreview={onPreview} onCommit={onCommit}/>}
    <div className="progressive-navigation"><button type="button" title="Back to all preset freedoms" onClick={onBack}>↩</button><button type="button" title="Done · Enter" onClick={onConfirm}>✓</button></div>
  </div>;
}

/** The composer owns a recoverable local draft, not a second canonical object.
 * Accepted changes use the shared journal; samples and animation stay transient. */
export function OmnicComposer({ entity, objects, history, onSave, onCopy, workspaceId, presetIds=[], isNew=false, initialRecipe, onPreview,radar=false }: Props) {
  const presetPoint=useRef({x:0,y:0});
  const [presetSession,setPresetSession]=useState<{ids:string[];degree?:string;configure?:boolean}|null>(null);
  const [radarPanel,setRadarPanel]=useState<RadarPanel|null>(null);
  const [atomnicBridge,setAtomnicBridge]=useState<AtomnicInteraction|null>(null);
  const draftId=workspaceId?`${workspaceId}:${entity.id}`:entity.id;
  const [initial] = useState(() => restoredDraft(entity,draftId,initialRecipe));
  const [draft, setDraft] = useState<Recipe>(initial.recipe);
  const [baseRevision, setBaseRevision] = useState<number | null>(initial.baseRevision);
  const baseRevisionRef = useRef(baseRevision); baseRevisionRef.current = baseRevision;
  const draftRef = useRef(draft); draftRef.current = draft;
  const [sample, setSample] = useState<Recipe | null>(null);
  const recipe = sample ?? draft, recipeRef = useRef(recipe); recipeRef.current = recipe;
  const atomnicActive=!!recipe.atomnic?.active;
  const [focus, setFocus] = useState<Focus | null>(() => draft.components[0] ? { kind: "component", id: draft.components[0].id } : null);
  const [picked, setPicked] = useState<string[]>([]);
  const [toolId, setToolId] = useState("");
  const [generator, setGenerator] = useState(isNew ? "dot" : "radial"), [reference, setReference] = useState("");
  const [thresholds, setThresholds] = useState(false), [playing, setPlaying] = useState(false);
  const [copyLabel, setCopyLabel] = useState(entity.label ? `${entity.label} variation` : isNew ? "Omnic object" : "Omnic variation");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const preview = useRef<HTMLDivElement>(null), importInput = useRef<HTMLInputElement>(null);
  const owner = `omnic.draft:${draftId}`;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const resolve = useMemo(() => { const saved=objectResolver(objects); return (key: string,revision?:number) => key === entity.id && revision===undefined ? recipeRef.current : saved(key,revision); }, [objects,entity.id]);
  const evaluated = useMemo(() => {
    try { return { result: evaluateRecipe(recipe, resolve), error: "" }; }
    catch (failure) { return { result: null, error: failure instanceof Error ? failure.message : String(failure) }; }
  }, [recipe, resolve]);
  useEffect(() => { if (!evaluated.error) onPreview?.(recipe,atomnicBridge??undefined); }, [recipe, evaluated.error, onPreview,atomnicBridge]);
  useEffect(() => () => onPreview?.(null), [onPreview]);
  const viewBox = useMemo(() => {
    if (!evaluated.result) return "-50 -50 100 100";
    const atomnicBounds=atomnicViewBounds(recipe.atomnic);
    if(atomnicBounds)return [atomnicBounds.x,atomnicBounds.y,atomnicBounds.width,atomnicBounds.height].join(" ");
    const seen = new Set<Recipe>(), cached = new Map<Recipe,number>();
    const excursion = (current: Recipe): number => {
      const known=cached.get(current);if(known!==undefined)return known;
      if (seen.has(current)) return 0;
      seen.add(current);
      const own = current.operations.filter(operation=>operation.enabled && operation.operator === "oscillate").reduce((sum,operation)=>sum+Number(operation.params.amplitude ?? 10),0);
      const nested = Math.max(0,...allComponents(current.components).flatMap(component=>{const referenced=component.reference?resolve(component.reference,component.referenceRevision):undefined;return referenced?[excursion(referenced)]:[];}));
      seen.delete(current);cached.set(current,own+nested);return own+nested;
    };
    const bounds = evaluationBounds(evaluated.result), padding = excursion(recipe);
    return [bounds.x-padding,bounds.y-padding,bounds.width+padding*2,bounds.height+padding*2].join(" ");
  }, [evaluated.result,recipe,resolve]);
  const html = useMemo(() => !radar&&evaluated.result ? renderSVG(evaluated.result).replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`) : "", [evaluated.result,viewBox,radar]);
  const presentationBounds=useMemo(()=>{const [x,y,width,height]=viewBox.split(' ').map(Number);return {x,y,width,height};},[viewBox]);
  const htmlRef = useRef(html); htmlRef.current = html;
  const targetContext=useContextCommands({recipe,resolve,evaluation:evaluated.result,selection:picked,select:ids=>{setPicked([...ids]);setFocus(ids[0]?{kind:'component',id:ids[0]}:null);if(!ids.length){setRadarPanel(null);setPresetSession(null);}},commit:(next,temporary)=>commit(next,temporary),surface:preview,bridge:atomnicBridge,error:setError});
  const components = useMemo(() => allComponents(recipe.components), [recipe.components]);
  const componentDepths = useMemo(() => {
    const depths = new Map<string,number>();
    const visit = (items: Component[], depth: number) => items.forEach(component=>{ depths.set(component.id,depth); visit(component.children ?? [],depth+1); });
    visit(recipe.components,0);return depths;
  }, [recipe.components]);
  const activeComponent = focus?.kind === "component" ? components.find(component => component.id === focus.id) : undefined;
  const activeOperation = focus?.kind === "operation" ? recipe.operations.find(operation => operation.id === focus.id) : undefined;
  const active = activeComponent ?? activeOperation;
  const spec = activeComponent ? GENERATORS.find(generator => generator.id === activeComponent.generator) : activeOperation ? OPERATORS.find(operator => operator.id === activeOperation.operator) : undefined;
  const commit = (next: Recipe, temporary = false) => {
    try {
      const checked = validateRecipe(next);
      if (temporary) { setSample(checked); return true; }
      const before = draftRef.current;
      draftRef.current = checked; setDraft(checked); setSample(null); setError(""); setNotice("");
      history.record(owner, normalizedHistory(before), normalizedHistory(checked), ["omnium"], ["omnium", "window:omnic-composer"]);
      return true;
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; }
  };
  useEffect(() => {
    forgetClosedComposerDraft(owner);
    const stop = history.register(owner, {
      read: () => normalizedHistory(draftRef.current),
      write: value => { const next = validateRecipe({ ...value, revision: draftRef.current.revision }); draftRef.current = next; setDraft(next); setSample(null); },
    });
    return () => {
      stop();
      preserveClosedComposerHistory(history,owner,storageKey(draftId),{recipe:draftRef.current,baseRevision:baseRevisionRef.current});
    };
  }, [history, owner, draftId]);

  useEffect(() => {
    try { localStorage.setItem(storageKey(draftId), JSON.stringify({ baseRevision, recipe: draft })); }
    catch { setError("Draft could not be preserved locally. Export JSON before closing."); }
  }, [draft, draftId, baseRevision]);
  const changeParams = (params: Params, temporary = false) => {
    if (!focus) return;
    const current = recipeRef.current;
    commit(focus.kind === "component" ? { ...current, components: updateComponents(current.components, focus.id, component => ({ ...component, params })) }
      : { ...current, operations: current.operations.map(operation => operation.id === focus.id ? { ...operation, params } : operation) }, temporary);
  };
  const activeParameters=useMemo(()=>spec?applicableParameters(spec,active?.params??{}):[],[spec,active?.params]);
  useOmnicParameterBindings(active?.params ?? {}, params => changeParams(params), radar||presetSession||atomnicActive&&radarPanel?.kind!=='parameters'?[]:activeParameters);
  const parameter = (field: Parameter, value: string | number | boolean, temporary: boolean) => {
    if (active) changeParams(commitOmnicParameter(active.params, field, value), temporary);
  };
  const save = () => {
    try {
      const next = validateRecipe({ ...recipeRef.current, version:2, revision: (entity.omnic?.revision ?? 0) + 1 });
      onSave(next, isNew ? copyLabel.trim() || "Omnic object" : undefined); setBaseRevision(next.revision); draftRef.current = next; setDraft(next); setSample(null); setNotice("Shared definition saved; its references use this revision."); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };
  const copy = () => { try { onCopy(validateRecipe({ ...recipeRef.current, revision: 1 }), copyLabel.trim() || "Omnic variation"); setNotice("Copied as a new canonical object."); } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); } };
  const reset = () => { setBaseRevision(entity.omnic?.revision ?? null); commit(validateRecipe(entity.omnic ?? initialRecipe ?? createRecipe())); setPlaying(false); setPicked([]); };
  const togglePlay = () => {
    if (!playing && (evaluated.result?.nodes.length ?? 0) > RENDER_BUDGET.omnicAnimatedRoles) { setError(`Animated preview is limited to ${RENDER_BUDGET.omnicAnimatedRoles} generated roles. The complete static structure is preserved.`); return; }
    setPlaying(value => !value);
  };
  const stepRotation = () => {
    if (!activeOperation || activeOperation.operator !== "rotate") return;
    try {
      const source=recipeRef.current.operations.find(op=>op.id===activeOperation.id);if(!source)return;
      const rotationSpec=OPERATORS.find(op=>op.id==="rotate")!;
      const stored={...defaultParams(rotationSpec),...source.params};
      const params=Object.fromEntries(rotationSpec.parameters.map(parameter=>[parameter.key,functionInputValue(OMNIC_CONSUMER,parameter.property,()=>stored[parameter.key]) ]));
      const angle=Number(params.angle??0), step=Number(params.snap??0)||1;
      const stops=rotationStops(String(params.stops??""));
      const next=stops.length ? stops.find(value=>value>angle)??stops[0] : snappedAngle(angle,step,Number(params.snapOrigin??0))+step;
      if(Math.abs(next)>1080){setError("Rotation is limited to ±1080°. Change the angle to continue.");return;}
      const temporary=rotationSpec.parameters.some(parameter=>params[parameter.key]!==stored[parameter.key]);
      if(temporary){
        const before=snappedAngle(Number(stored.angle),Number(stored.snap),Number(stored.snapOrigin),String(stored.stops));
        const delta=Number((next-before).toFixed(9));
        if(delta)commit({...recipeRef.current,operations:[...recipeRef.current.operations,{...source,id:id(),params:{...params,angle:delta,snap:0,snapOrigin:0,stops:""}}]});
      }
      else commit({...recipeRef.current,operations:recipeRef.current.operations.map(op=>op.id===source.id?{...op,params:{...op.params,angle:next}}:op)});
    } catch(failure){setError(failure instanceof Error?failure.message:String(failure));}
  };
  const shortcuts = useFeatureActions("omnicComposer", {
    "omnic.rotateStep": { enabled: activeOperation?.operator === "rotate", run: stepRotation },
    "omnic.save": { enabled: !evaluated.error, run: save },
    "omnic.copy": { enabled: !evaluated.error, run: copy },
    "omnic.play": { enabled: !!evaluated.result?.motion, run: togglePlay },
    "omnic.export": { enabled: true, run: () => download("omnic-recipe.json", recipeRef.current) },
    "omnic.import": { enabled: true, run: () => importInput.current?.click() },
    "omnic.reset": { enabled: true, run: reset },
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (shortcuts.handle(event)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  useEffect(() => {
    if (!playing || !preview.current) return;
    if ((evaluated.result?.nodes.length ?? 0) > RENDER_BUDGET.omnicAnimatedRoles) { setError(`Animated preview is limited to ${RENDER_BUDGET.omnicAnimatedRoles} generated roles. Static structure is preserved.`); setPlaying(false); return; }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || document.visibilityState === "hidden") { setPlaying(false); return; }
    let frame = 0, last = 0, slow = 0, visible = true;
    const start = performance.now();
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (!visible) setPlaying(false); });
    observer.observe(preview.current);
    const stop = () => { if (document.visibilityState === "hidden" || media.matches) setPlaying(false); };
    document.addEventListener("visibilitychange", stop); media.addEventListener("change", stop);
    const tick = (now: number) => {
      if (now - last >= 1000 / RENDER_BUDGET.omnicFps && visible && preview.current) {
        last = now;
        try {
          const began = performance.now();
          preview.current.innerHTML = renderSVG(evaluateRecipe(recipe, resolve, (now - start) / 1000)).replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);
          slow = performance.now() - began > 12 ? slow + 1 : 0;
          if (slow >= 3) { setNotice("Semantic motion paused to preserve responsiveness; the recipe is unchanged."); setPlaying(false); return; }
        }
        catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); setPlaying(false); return; }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", stop); media.removeEventListener("change", stop); if (preview.current) preview.current.innerHTML = htmlRef.current; };
  }, [playing, recipe, resolve, html, viewBox]);
  const addGenerator = (kind=generator) => {
    const spec = GENERATORS.find(value => value.id === kind); if (!spec) return;
    if (kind === "reference" && !reference) { if(radar)setRadarPanel({kind:'reference'});else setError("Choose an existing Omnic object to reuse."); return; }
    const component: Component = { id: id(), generator:kind, params: defaultParams(spec), ...(kind === "group" ? { children: [] } : {}), ...(kind === "reference" ? { reference } : {}) };
    const parent = activeComponent?.generator === "group" ? activeComponent.id : null;
    if (!commit({ ...recipe, components: parent ? updateComponents(recipe.components, parent, group => ({ ...group, children: [...group.children ?? [], component] })) : [...recipe.components, component] })) return;
    setFocus({ kind: "component", id: component.id }); setPicked([component.id]);
  };
  const addOperation = (operator: string) => {
    const spec = OPERATORS.find(value => value.id === operator); if (!spec) return;
    const operation: Application = { id: id(), operator, params: {...defaultParams(spec),...(operator==="rotate"?{pivot:"center"}:{})}, targets: [...picked], enabled: true };
    if (!commit({ ...recipe, operations: [...recipe.operations, operation] })) return; setFocus({ kind: "operation", id: operation.id });
  };
  const changeOperation = (operationId: string, patch: Partial<Application>) => commit({ ...recipe, operations: recipe.operations.map(operation => operation.id === operationId ? { ...operation, ...patch } : operation) });
  const reorder = (operationId: string, offset: number) => {
    const operations = [...recipe.operations], index = operations.findIndex(operation => operation.id === operationId), next = index + offset;
    if (index < 0 || next < 0 || next >= operations.length) return;
    [operations[index], operations[next]] = [operations[next], operations[index]]; commit({ ...recipe, operations });
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (file.size > 1_000_000) { setError("Recipe import is limited to 1 MB."); return; }
    try { const text = await file.text(); if (!mounted.current) return; const next = validateRecipe(JSON.parse(text)); setBaseRevision(entity.omnic?.revision ?? null); commit(next); setPlaying(false); setPicked([]); setFocus(next.components[0] ? { kind: "component", id: next.components[0].id } : null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };
  const baseCount = useMemo(() => { try { return evaluateRecipe(entity.omnic ?? createRecipe(), resolve).properties.count; } catch { return null; } }, [entity.omnic, resolve]);
  const dirty = JSON.stringify(recipe) !== JSON.stringify(entity.omnic ?? null);
  const [roleFilter, setRoleFilter] = useState("");
  const roles = (evaluated.result?.nodes ?? []).filter(node => !roleFilter || node.id.toLowerCase().includes(roleFilter.toLowerCase())).slice(0,128);
  const [neighborKey, setNeighborKey] = useState("");
  const neighborParameter = spec?.parameters.find(parameter => parameter.key === neighborKey && parameter.kind === "number") ?? spec?.parameters.find(parameter => parameter.kind === "number");
  const neighbors = useMemo(() => {
    if (radar || !active || !spec || !neighborParameter || !evaluated.result || evaluated.result.nodes.length > RENDER_BUDGET.omnicAnimatedRoles) return [];
    const parameter = neighborParameter, current = Number(active.params[parameter.key] ?? parameter.initial);
    const values = thresholds && parameter.thresholds?.length ? parameter.thresholds : [Math.max(parameter.min!, current - (parameter.step ?? 1)), Math.min(parameter.max!, current + (parameter.step ?? 1))];
    const below = [...values].filter(value => value < current).at(-1), above = [...values].find(value => value > current);
    return [below, above].filter((value): value is number => value !== undefined).map(value => {
      const params = commitOmnicParameter(active.params, parameter, value);
      const candidate = activeComponent ? { ...recipe, components: updateComponents(recipe.components, activeComponent.id, component => ({ ...component, params })) }
        : { ...recipe, operations: recipe.operations.map(operation => operation.id === activeOperation?.id ? { ...operation, params } : operation) };
      try { return { value, recipe: candidate, html: renderSVG(evaluateRecipe(candidate, resolve)) }; } catch { return null; }
    }).filter((candidate): candidate is { value: number; recipe: Recipe; html: string } => candidate !== null);
  }, [recipe, active, spec, neighborParameter, thresholds, resolve, evaluated.result,radar]);
  const choosePreset=(source:Recipe)=>{
      try {
        const tool=isOperationTool(source);
        const targets=atomnicActive?[...(atomnicBridge?.selected??[])]:picked;
        if(tool&&!targets.length)throw Error('Select a target before applying an operation preset.');
        const inserted=tool?undefined:insertConstruction(recipeRef.current,source,presetPoint.current,id);
        const next=inserted?.recipe??applyOperationTool(recipeRef.current,source,targets,id);
        const ids=inserted?.ids??next.operations.slice(recipeRef.current.operations.length).map(op=>op.id);
        if(commit(next)){if(radar)setPresetSession({ids});if(inserted){setPicked(inserted.roots);atomnicBridge?.select?.(inserted.roots);setFocus({kind:'component',id:inserted.roots[0]});}setError('');}
      }catch(failure){setError(failure instanceof Error?failure.message:String(failure));}
    };
  if(radar) {
    const actionEntry=(key:string,label:string,symbol:string,group:readonly RadialGroup[],run:()=>void,configure?:()=>void):RadialEntry<ReactNode>=>({id:key,label,symbol,group,content:<><UIAction registerOnly id={key} label={label} symbol={symbol} category="Omnic" onClick={run} onConfigure={configure}/><FunctionControl id={key} mirror symbol={symbol} tooltip={`${label}${configure?' · Right-click configures':''}`}/></>});
    const openEffect=(effect:Definition)=>{
      try {
        const selected=atomnicActive&&atomnicBridge?.selected.length?[...atomnicBridge.selected]:picked;
        const targets=selected.length?selected:recipe.components.map(c=>c.id);
        if(!targets.length)throw Error('Create or select a target before applying a motion effect.');
        const existing=recipe.operations.find(op=>op.operator===effect.id&&op.targets.length===targets.length&&op.targets.every(target=>targets.includes(target)));
        const next=existing?validateRecipe({...recipe,operations:recipe.operations.map(op=>op.id===existing.id?{...op,enabled:true}:op)}):applyOperationTool(recipe,operationTool({id:id(),operator:effect.id,params:defaultParams(effect),targets:[],enabled:true}),targets,id);
        const operationId=existing?.id??next.operations.at(-1)!.id;
        if(commit(next)){setPresetSession({ids:[operationId]});setRadarPanel({kind:'presets'});if(!playing)togglePlay();}
      }catch(failure){setError(failure instanceof Error?failure.message:String(failure));}
    };
    const entries:RadialEntry<ReactNode>[]=[
      ...FEATURE_ACTIONS.filter(action=>action.owner==='omnicComposer'&&'radial' in action).map(action=>({id:action.id,label:action.label,symbol:'radial' in action?action.radial.symbol:'◇',group:'radial' in action?action.radial.group:[],content:<FunctionControl id={action.id} mirror symbol={'radial' in action?action.radial.symbol:'◇'} tooltip={action.description}/>})),
      {id:'omnic:copy-name',label:isNew?'Glyph name':'Copy name',symbol:'✎',group:[radialGroups.object,radialGroups.save],content:<FunctionControl id="omnic:copy-name" mirror symbol="✎" tooltip={`${isNew?'Glyph name':'Copy name'} · ${copyLabel}`}/>},
      ...(!atomnicActive?GENERATORS.map(g=>actionEntry(`omnic:add-generator:${g.id}`,g.label,g.symbol??'◇',[radialGroups.construct],()=>{setGenerator(g.id);addGenerator(g.id);})):[]),
      ...components.map(c=>actionEntry(`omnic:component:${c.id}`,`${GENERATORS.find(g=>g.id===c.generator)?.label} · ${c.id.slice(0,6)}`,GENERATORS.find(g=>g.id===c.generator)?.symbol??'◇',[radialGroups.object,radialGroups.structure],()=>{setFocus({kind:'component',id:c.id});setPicked([c.id]);},()=>{setFocus({kind:'component',id:c.id});setPicked([c.id]);setRadarPanel({kind:'parameters',index:0});})),
      ...(activeComponent?[actionEntry(`omnic:remove-component:${activeComponent.id}`,'Remove selected component','×',[radialGroups.object,radialGroups.structure],()=>{commit({...recipe,components:removeComponent(recipe.components,activeComponent.id)});setFocus(null);})]:[]),
      ...(activeComponent?.reference?[actionEntry('omnic:radar-dependency','Dependency version','#',[radialGroups.object,radialGroups.structure],()=>setRadarPanel({kind:'dependency'}))]:[]),
      ...OPERATORS.filter(effect=>effect.category==='mfx').map(effect=>actionEntry(`omnic:add-operator:${effect.id}`,effect.label,effect.symbol??'≈',[VISUAL_FREEDOM_GROUP,radialGroups.mfx],()=>openEffect(effect))),
      ...(activeOperation?[
        actionEntry(`omnic:enable-operation:${activeOperation.id}`,activeOperation.enabled?'Disable operation':'Enable operation',activeOperation.enabled?'◉':'○',[radialGroups.motion],()=>changeOperation(activeOperation.id,{enabled:!activeOperation.enabled})),
        actionEntry(`omnic:earlier-operation:${activeOperation.id}`,'Move operation earlier','↑',[radialGroups.motion],()=>reorder(activeOperation.id,-1)),
        actionEntry(`omnic:later-operation:${activeOperation.id}`,'Move operation later','↓',[radialGroups.motion],()=>reorder(activeOperation.id,1)),
        actionEntry(`omnic:remove-operation:${activeOperation.id}`,'Remove operation','×',[radialGroups.motion],()=>{commit({...recipe,operations:recipe.operations.filter(op=>op.id!==activeOperation.id)});setFocus(null);}),
      ]:[]),
    ];
    const fields=spec?applicableParameters(spec,active?.params??{}):[];
    const currentIndex=radarPanel?.kind==='parameters'?Math.min(radarPanel.index,Math.max(0,fields.length-1)):0;
    const currentField=fields[currentIndex];
    const legacyPanel=radarPanel?.kind==='parameters'?spec&&active&&currentField?<ProgressiveConfiguration label={spec.label} index={currentIndex} count={fields.length} onBack={()=>currentIndex?setRadarPanel({kind:'parameters',index:currentIndex-1}):setRadarPanel(null)} onNext={()=>currentIndex+1<fields.length?setRadarPanel({kind:'parameters',index:currentIndex+1}):setRadarPanel(null)}>
      <Parameters scope={active.id} spec={{...spec,parameters:[currentField]}} params={active.params} thresholds={thresholds} change={parameter}/>
    </ProgressiveConfiguration>:<small>Right-click a component in the editing surface.</small>:radarPanel?.kind==='dependency'&&activeComponent?.reference?<UIField id="omnic:dependency-version" label="Dependency version" category="Omnic"><label>Dependency version<select aria-label="Dependency version" value={activeComponent.referenceRevision??'live'} onChange={event=>commit({...recipe,version:2,components:updateComponents(recipe.components,activeComponent.id,component=>{const {referenceRevision:_,...rest}=component;return event.target.value==='live'?rest:{...rest,referenceRevision:Number(event.target.value)};})})}><option value="live">Live definition</option>{objects.find(o=>o.id===activeComponent.reference)?.omnicHistory?.map(r=><option key={r.revision} value={r.revision}>Pinned r{r.revision}</option>)}</select></label></UIField>:radarPanel?.kind==='reference'?<label>Reuse object<select value={reference} onChange={event=>setReference(event.target.value)}><option value="">Choose…</option>{objects.filter(o=>o.id!==entity.id&&o.omnic).map(o=><option key={o.id} value={o.id}>{o.label||o.id}</option>)}</select><button type="button" disabled={!reference} onClick={()=>{addGenerator('reference');setRadarPanel(null);}}>✓</button></label>:radarPanel?.kind==='scope'?<div className="omnic-list"><div className="omnic-row"><UIAction id="omnic:pick-all" label="Whole structure" symbol="⦿" category="Omnic" onClick={()=>setPicked(recipe.components.map(c=>c.id))}/><UIAction id="omnic:pick-flow" label="Use flow selection" symbol="◌" category="Omnic" onClick={()=>setPicked([])}/></div><select aria-label="Operation scope" multiple size={Math.min(6,roles.length)} value={picked} onChange={event=>setPicked([...event.target.selectedOptions].map(o=>o.value))}>{roles.map(role=><option key={role.id} value={role.id}>{role.id}</option>)}</select>{activeOperation&&<UIAction id="omnic:apply-picked-scope" label="Use picked scope / repair targets" symbol="✓" category="Omnic" onClick={()=>changeOperation(activeOperation.id,{targets:[...picked]})}/>}</div>:radarPanel?.kind==='inspect'?<div className="omnic-list"><output>● {evaluated.result?.properties.count??0} · ◉ {picked.length} · r{recipe.revision}</output>{evaluated.result?.results.map((r,i)=><output key={i}>{r.kind}: {r.value}</output>)}{evaluated.result?.diagnostics.map((d,i)=><small key={i}>{d.message}</small>)}</div>:undefined;
    const closePreset=()=>{setSample(null);setPresetSession(null);setRadarPanel(null);};
    const confirmPreset=()=>{if(presetSession&&(!sample||commit(recipeRef.current))){setPresetSession(null);setRadarPanel(null);}};
    const presetDegrees=presetSession?targetDegrees(recipe,presetSession.ids,[],[],'available'):[];
    const presetDegree=presetDegrees.find(degree=>degree.id===presetSession?.degree);
    const changePresetDegree=(degree:EditableDegree,value:string|number|boolean,temporary=false)=>{try{commit(writeTargetDegree(recipeRef.current,degree,value),temporary);}catch(failure){setError(failure instanceof Error?failure.message:String(failure));}};
    const presetOpen=radarPanel?.kind==='presets';
    const presetOptions=presetOpen&&!presetSession?[...PRESETS.map(p=>({id:p.id,label:p.label,symbol:p.symbol??GENERATORS.find(g=>g.id===p.recipe.components[0]?.generator)?.symbol??'❉',recipe:p.recipe})),...objects.filter(o=>o.omnic&&(presetIds.includes(o.id)||isOperationTool(o.omnic))).map(o=>({id:`saved:${o.id}`,label:o.label||o.id,symbol:isOperationTool(o.omnic!)?'✥':'❉',recipe:o.omnic!}))]:[];
    const presetPanel=presetSession?presetDegree?<PresetDegreeEditor key={`${presetDegree.id}:${presetSession.configure}`} recipe={recipe} degree={presetDegree} configure={presetSession.configure} onPreview={value=>changePresetDegree(presetDegree,value,true)} onCommit={value=>changePresetDegree(presetDegree,value)} onBack={()=>setPresetSession({...presetSession,degree:undefined})} onConfirm={confirmPreset}/>:<RadialMenu items={radialTree([...presetDegrees.map(degree=>({group:degree.group,id:degree.id,label:degree.label,symbol:degree.symbol??nameSymbol(degree.id,degree.label),setter:<DegreeSetter recipe={recipe} degree={degree} onPreview={value=>changePresetDegree(degree,value,true)} onCommit={value=>changePresetDegree(degree,value)} onOpen={()=>setPresetSession({...presetSession,degree:degree.id,configure:false})}/>,content:<><UIAction registerOnly id={`omnic:preset-dof:${degree.id}`} category="Omnic" label={degree.label} onClick={()=>setPresetSession({...presetSession,degree:degree.id,configure:false})} onConfigure={()=>setPresetSession({...presetSession,degree:degree.id,configure:true})}/><FunctionControl id={`omnic:preset-dof:${degree.id}`} mirror symbol={degree.symbol??nameSymbol(degree.id,degree.label)} symbolOpacity={degree.symbolOpacity} symbolFill={degree.symbolFill} tooltip={`${degree.label} · ${targetDegreeValue(recipe,degree)} · Right-click configures snaps`}/></>})),{id:'omnic:preset-confirm',label:'Done · Enter',symbol:'✓',content:<button type="button" title="Done · Enter" aria-label="Done" onClick={confirmPreset}>✓</button>}])} onClose={closePreset}/>:<RadialMenu items={presetOptions.map(option=>({id:option.id,label:option.label,symbol:option.symbol,group:[],content:<button type="button" title={option.label} aria-label={option.label} onClick={()=>choosePreset(option.recipe)}>{option.symbol}</button>}))} onClose={closePreset}/>;
    const panel=presetOpen?<form style={{display:'contents'}} onSubmit={event=>{event.preventDefault();confirmPreset();}} onKeyDown={event=>{if(event.key==='Enter'&&event.target instanceof HTMLInputElement&&event.target.type==='range'){event.preventDefault();event.stopPropagation();confirmPreset();}}}>{presetPanel}<button type="submit" hidden disabled={!presetSession}/></form>:legacyPanel;
    return <RangeSettingsScope><div className="omnic-composer-radar">
      <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importFile}/>
      <UIField id="omnic:copy-name" label={isNew?'Glyph name':'Copy name'} category="Omnic" registerOnly><label>{isNew?'Glyph name':'Copy name'} <input aria-label={isNew?'Glyph name':'Copy name'} value={copyLabel} maxLength={200} onChange={event=>setCopyLabel(event.target.value)}/></label></UIField>
      <UIAction id="omnic:atomnic-mode" label={atomnicActive?'Atomnic on · turn off':'Atomnic off · turn on'} category="Omnic" registerOnly onClick={()=>{setRadarPanel(null);commit({...recipe,atomnic:{...recipe.atomnic,active:!atomnicActive}});}}/>
      <AtomnicEditor radar onSelect={ids=>{setPicked([...ids]);setFocus(ids[0]?{kind:'component',id:ids[0]}:null);}} activateTarget={targetContext.activate} bindParameters={targetContext.active} recipe={recipe} evaluation={evaluated.result} commit={commit} onBridge={setAtomnicBridge} surfaceRef={preview} markupRef={htmlRef} presentationBounds={presentationBounds} normalSelection={picked} documentEntries={entries} modeControl={<FunctionControl id="omnic:atomnic-mode" mirror symbol="⠒" symbolOpacity={atomnicActive?1:.5} tooltip={`Atomnic ${atomnicActive?'on':'off'} · toggle without replacing the composition`}/>} extraPanel={panel} panelStage={presetSession?.degree??(presetSession?'preset-dofs':radarPanel?.kind)} dismissPanel={()=>{if(presetOpen)closePreset();else setRadarPanel(null);}} panelRadial={presetOpen&&!presetDegree} confirmPanel={presetSession?confirmPreset:undefined} onEmptyContext={point=>{presetPoint.current=point;setSample(null);setPresetSession(null);setRadarPanel({kind:'presets'});}} closePanel={()=>{if(presetOpen){if(presetSession?.degree){setPresetSession({...presetSession,degree:undefined});return;}closePreset();}else setRadarPanel(null);}}
        onPickGeometry={(point,role)=>{const node=pickStructuralNode(evaluated.result?.nodes??[],point,role);const component=node&&(components.find(c=>c.id===node.componentId)??components.find(c=>node.id.startsWith(`${c.id}:ref:`)));if(component){const ids=picked.includes(component.id)?picked:[component.id];setFocus({kind:'component',id:component.id});setPicked(ids);return ids;}return [];}}/>
      {(error||evaluated.error||notice)&&<small className="omnic-radar-feedback" role={error||evaluated.error?'alert':'status'}>{error||evaluated.error||notice}</small>}
    </div></RangeSettingsScope>;
  }
  return <div className="omnic-composer">
    <div className="omnic-toolbar">
      <strong>{entity.label || "Omnic object"}</strong><small title={isNew ? "Save shared creates this object at the preview position. Closing removes the world preview and keeps the recoverable draft. World previews use the shared 32-source budget." : "The world previews this draft and its live uses within the shared 32-source budget; other occurrences retain saved rendering. Closing restores saved rendering; Reset draft reverts unsaved work."}>{isNew ? "New · world draft" : dirty ? "World draft · not saved" : `Shared revision ${entity.omnic?.revision ?? 0}`}</small>
      {!atomnicActive&&["omnic.save", "omnic.copy", "omnic.play", "omnic.export", "omnic.import", "omnic.reset"].map(action => <FunctionControl key={action} id={action} />)}
      <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
    </div>
    <UIField id="omnic:copy-name" label={isNew ? "Glyph name" : "Variation name"} category="Omnic" registerOnly={atomnicActive}><label>{isNew ? "Glyph name" : "Copy name"} <input aria-label={isNew?'Glyph name':'Copy name'} value={copyLabel} maxLength={200} onChange={event => setCopyLabel(event.target.value)} /></label></UIField>
    {(error || evaluated.error) && <small role="alert">{error || evaluated.error}</small>}{notice && <small role="status">{notice}</small>}
    {baseRevision !== (entity.omnic?.revision ?? null) && <small role="status">This draft began at shared revision {baseRevision ?? "none"}; the object is now revision {entity.omnic?.revision ?? "none"}. Reset draft loads the current definition. Save shared explicitly replaces it; Save copy preserves both.</small>}
    <div className="omnic-row"><UIAction id="omnic:atomnic-mode" label={atomnicActive ? "Atomnic on · turn off (preserve composition)" : "Atomnic off · turn on"} symbol="⠒" category="Omnic" registerOnly={atomnicActive} onClick={()=>commit({...recipe,atomnic:{...recipe.atomnic,active:!atomnicActive}})} /></div>
    {atomnicActive && <AtomnicEditor recipe={recipe} evaluation={evaluated.result} commit={commit} onBridge={setAtomnicBridge}
      modeControl={<FunctionControl id="omnic:atomnic-mode" mirror symbol="⠒" tooltip="Atomnic on · turn off to use other geometry · composition is preserved"/>}
      documentEntries={([
        ...FEATURE_ACTIONS.filter(action=>action.owner==='omnicComposer'&&'radial' in action).map(action=>({id:action.id,label:action.label,symbol:'radial' in action?action.radial.symbol:'◇',group:'radial' in action?action.radial.group:[],content:<FunctionControl id={action.id} mirror symbol={'radial' in action?action.radial.symbol:'◇'} tooltip={action.description}/>})),
        {id:'omnic:copy-name',label:isNew?'Glyph name':'Variation name',symbol:'✎',group:[radialGroups.object,radialGroups.save],content:<FunctionControl id="omnic:copy-name" mirror symbol="✎" tooltip={`${isNew?'Glyph name':'Copy name'} · ${copyLabel}`}/>},
      ] satisfies RadialEntry<ReactNode>[])} />}
    {!atomnicActive && <div className="omnic-workbench">
      <div className="omnic-preview-column">
        <div className="omnic-preview" ref={preview} role="img" aria-label="Live Omnic structure" dangerouslySetInnerHTML={{ __html: html }} onClick={event => {
          const target = event.target instanceof Element ? event.target.closest("[data-omnic-role]") : null;
          const role = target?.getAttribute("data-omnic-role"); if (!role) return;
          setPicked(current => current.includes(role) ? current.filter(value => value !== role) : [...current, role]);
        }} />
        <small role="status">{playing ? `Semantic motion · playing (${RENDER_BUDGET.omnicFps} fps)` : evaluated.result?.motion ? "Semantic motion · paused" : "Static structure"}</small>
        {evaluated.result && <output className="omnic-derived">Units {evaluated.result.properties.count} · selected {evaluated.result.properties.selectedCount} · components {evaluated.result.properties.componentCount}{baseCount !== null ? ` · Δ count ${evaluated.result.properties.count - baseCount}` : ""}</output>}
        {!!evaluated.result?.results.length && <UISection id="omnic-derived-results" title="Extracted properties">
          <ol className="omnic-list">{evaluated.result.results.map((result,index)=><li key={`${result.operation}:${index}`}><output>Count {result.value}</output><small title={result.scope.join(", ")}> · operation {recipe.operations.findIndex(operation=>operation.id===result.operation)+1} · {result.scope.length ? `${result.scope.length} scoped roles` : "flow scope"}</small></li>)}</ol>
        </UISection>}
        {neighborParameter && (evaluated.result?.nodes.length ?? 0) > RENDER_BUDGET.omnicAnimatedRoles && <small>Neighbor previews paused for this structure size.</small>}
        {neighborParameter && <div className="omnic-neighbors">
          <select aria-label="Neighbor parameter" value={neighborParameter.key} onChange={event => setNeighborKey(event.target.value)}>{spec?.parameters.filter(parameter => parameter.kind === "number").map(parameter => <option value={parameter.key} key={parameter.key}>{parameter.label}</option>)}</select>
          {neighbors.map(neighbor => <button type="button" key={neighbor.value} title={`Use ${neighborParameter.label} ${neighbor.value}`} onClick={() => commit(neighbor.recipe)}><span aria-hidden="true" dangerouslySetInnerHTML={{ __html: neighbor.html }} /><small>{neighbor.value}</small></button>)}
        </div>}
        <UIField id="omnic:preset" label="Construction preset" category="Omnic"><label title="Insert a preset alongside existing contents; Save shared publishes the definition.">Preset <select value="" onChange={event => { const saved=event.target.value.startsWith('saved:')?objects.find(object=>object.id===event.target.value.slice(6))?.omnic:undefined;choosePreset(saved?validateRecipe(saved):createRecipe(event.target.value)); }}><option value="" disabled>Choose…</option><optgroup label="Built-in">{PRESETS.map(preset => <option value={preset.id} key={preset.id}>{preset.label}</option>)}</optgroup><optgroup label="Workspace presets">{objects.filter(object=>object.omnic&&presetIds.includes(object.id)).map(object=><option value={`saved:${object.id}`} key={object.id}>{object.label||object.id}</option>)}</optgroup></select></label></UIField>
      </div>
      <div className="omnic-edit-column">
        <UISection id="omnic-structure" title="Structure">
          <div className="omnic-row"><select aria-label="Generator" value={generator} onChange={event => setGenerator(event.target.value)}>{GENERATORS.map(generator => <option value={generator.id} key={generator.id}>{generator.label}</option>)}</select><UIAction id="omnic:add-generator" label={activeComponent?.generator === "group" ? "Add inside group" : "Add component"} category="Omnic" onClick={addGenerator} /></div>
          {generator === "reference" && <select aria-label="Existing Omnic object" value={reference} onChange={event => setReference(event.target.value)}><option value="">Choose object…</option>{objects.filter(object => object.id !== entity.id && object.omnic).map(object => <option value={object.id} key={object.id}>{object.label || object.id}</option>)}</select>}
          <div className="omnic-list">{components.map(component => <div className="omnic-row" key={component.id} style={{marginInlineStart:(componentDepths.get(component.id) ?? 0)*9}}>
            <button type="button" aria-pressed={focus?.kind === "component" && focus.id === component.id} title={component.id} onClick={() => { setSample(null); setFocus({kind:"component",id:component.id}); setPicked([component.id]); }}>{GENERATORS.find(generator => generator.id === component.generator)?.label ?? component.generator} · {component.id.slice(0,6)}</button>
            <UIAction id={`omnic:remove-component:${component.id}`} label="Remove component" symbol="×" category="Omnic" onClick={() => { commit({...recipe,components:removeComponent(recipe.components,component.id)}); if (focus?.id === component.id) setFocus(null); }} />
          </div>)}</div>
        </UISection>
        {spec && active && <UISection id="omnic-parameters" title={spec.label}>
          <UIField id="omnic:parameter-mode" label="Parameter navigation" category="Omnic"><label title="Registered numeric candidates; semantic significance is unverified."><input type="checkbox" checked={thresholds} onChange={event => setThresholds(event.target.checked)} />Parameter presets</label></UIField>
          {activeComponent?.reference && <UIField id="omnic:dependency-version" label="Dependency version" category="Omnic"><label>Reference <select aria-label="Dependency version" value={activeComponent.referenceRevision??'live'} onChange={event=>commit({...recipe,version:2,components:updateComponents(recipe.components,activeComponent.id,component=>{const {referenceRevision:_,...rest}=component;return event.target.value==='live'?rest:{...rest,referenceRevision:Number(event.target.value)};})})}><option value="live">Live definition</option>{objects.find(object=>object.id===activeComponent.reference)?.omnicHistory?.map(revision=><option key={revision.revision} value={revision.revision}>Pinned r{revision.revision}</option>)}</select></label></UIField>}
          <Parameters scope={active.id} spec={spec} params={active.params} thresholds={thresholds} change={parameter} />
          {activeOperation?.operator === "rotate" && <div className="omnic-row"><FunctionControl id="omnic.rotateStep" /><output title="Angle after snap / allowed-angle constraints">Applied {snappedAngle(Number(active.params.angle??0),Number(active.params.snap??0),Number(active.params.snapOrigin??0),String(active.params.stops??""))}°</output></div>}
          {activeOperation && <UIAction id="omnic:save-operation-tool" label="Save operation as tool" category="Omnic" onClick={()=>{try{onCopy(operationTool(activeOperation),copyLabel.trim()||"Omnic tool");}catch(failure){setError(failure instanceof Error?failure.message:String(failure));}}} />}
        </UISection>}
      </div>
    </div>}
    <UISection id="omnic-targets" title={`Scope · ${picked.length ? `${picked.length} picked` : "flow selection"}`} defaultExpanded={false}>
      <div className="omnic-row"><UIAction id="omnic:pick-all" label="Whole structure" category="Omnic" onClick={() => setPicked(recipe.components.map(component=>component.id))} /><UIAction id="omnic:pick-flow" label="Use flow selection" category="Omnic" onClick={() => setPicked([])} /><input aria-label="Filter structural roles" placeholder="Find role…" value={roleFilter} onChange={event => setRoleFilter(event.target.value)} /></div>
      <div className="omnic-picked">{picked.map(role => <button type="button" key={role} title="Remove from picked scope" onClick={() => setPicked(current => current.filter(value => value !== role))}>{role} ×</button>)}</div>
      <select aria-label="Pick structural role" value="" onChange={event => { const value=event.target.value;setPicked(current=>current.includes(value)?current:[...current,value]); }}><option value="" disabled>Pick role…{roles.length===128 ? " (first 128 matches)" : ""}</option>{roles.map(role=><option value={role.id} key={role.id}>{role.id}</option>)}</select>
      {activeOperation && <div className="omnic-row"><UIAction id="omnic:apply-picked-scope" label="Use picked scope / repair targets" category="Omnic" onClick={()=>changeOperation(activeOperation.id,{targets:[...picked]})} /><small>{activeOperation.targets.length ? activeOperation.targets.join(", ") : "Operation uses prior selection, or the whole structure if none"}</small></div>}
    </UISection>
    <UISection id="omnic-tools" title="Reusable tools" defaultExpanded={false}>
      <div className="omnic-row"><select aria-label="Saved operation tool" value={toolId} onChange={event=>setToolId(event.target.value)}><option value="">Choose tool…</option>{objects.filter(object=>object.omnic&&isOperationTool(object.omnic)).map(object=><option key={object.id} value={object.id}>{object.label||object.id}</option>)}</select>
        <UIAction id="omnic:apply-operation-tool" label="Stamp copy to scope" category="Omnic" onClick={()=>{try{const tool=objects.find(object=>object.id===toolId)?.omnic;if(!tool){setError("Choose a saved operation tool.");return;}const next=applyOperationTool(recipe,tool,picked,id);if(commit(next)){setFocus({kind:"operation",id:next.operations.at(-1)!.id});}}catch(failure){setError(failure instanceof Error?failure.message:String(failure));}}} />
      </div>
    </UISection>
    <div>
      <div className="omnic-row"><UIAction id="omnic:add-operator:oscillate" label="Semantic oscillation" category="Omnic" onClick={()=>addOperation('oscillate')} /></div>
      <div className="omnic-list">{recipe.operations.map((operation,index)=>operation.operator==="oscillate"?<div className="omnic-row" key={operation.id}>
        <input aria-label={`Enable operation ${index+1}`} type="checkbox" checked={operation.enabled} onChange={event=>changeOperation(operation.id,{enabled:event.target.checked})} />
        <button type="button" aria-pressed={focus?.kind === "operation" && focus.id === operation.id} onClick={()=>{setSample(null);setFocus({kind:"operation",id:operation.id});}}>{index+1}. {OPERATORS.find(operator=>operator.id===operation.operator)?.label ?? operation.operator}</button>
        <button type="button" title="Move operation earlier" aria-label="Move operation earlier" disabled={index===0} onClick={()=>reorder(operation.id,-1)}>↑</button><button type="button" title="Move operation later" aria-label="Move operation later" disabled={index===recipe.operations.length-1} onClick={()=>reorder(operation.id,1)}>↓</button><button type="button" aria-label="Remove operation" onClick={()=>commit({...recipe,operations:recipe.operations.filter(item=>item.id!==operation.id)})}>×</button>
      </div>:null)}</div>
    </div>
    {!!evaluated.result?.diagnostics.length && <UISection id="omnic-diagnostics" title="Unresolved / constrained" defaultExpanded><ul>{evaluated.result.diagnostics.map((diagnostic,index)=><li key={`${diagnostic.code}:${diagnostic.target ?? ""}:${index}`}>{diagnostic.message}{diagnostic.target ? ` · ${diagnostic.target}` : ""}</li>)}</ul></UISection>}
  </div>;
}

