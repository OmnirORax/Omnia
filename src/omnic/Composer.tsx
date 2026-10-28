import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { closedComposerDraft, forgetClosedComposerDraft, preserveClosedComposerHistory } from './draftHistory';
import { objectResolver } from './revisions';
import type { Recipe } from './model';
import { validateRecipe } from './model';
import { evaluateRecipe } from './evaluate';
import { newOmnicDraft } from './worldPreview';
import { UIField } from '../ui/UIField';
import { FunctionControl } from '../ui/UIWorkspace';
import { useFeatureActions } from '../ui/useFeatureActions';
import type { ActionHistory } from '../ui/actionHistory';
import { AtomnicEditor } from './AtomnicEditor';
import type { AtomnicInteraction } from './atomnicInteraction';
import './composer.css';

type ObjectRef = { id: string; label: string; omnic?: Recipe; omnicHistory?: Recipe[] };
type Props = {
  workspaceId?: string; entity: ObjectRef; objects: readonly ObjectRef[]; history: ActionHistory;
  isNew?: boolean; initialRecipe?: Recipe; onPreview?: (recipe: Recipe | null, editing?: AtomnicInteraction) => void;
  onSave: (recipe: Recipe, label?: string) => void; onCopy: (recipe: Recipe, label: string) => void; onClose: () => void;
};
const storageKey = (id: string) => `omnium.omnic.draft.v1:${id}`;
const normalizedHistory = (recipe: Recipe) => ({ ...recipe, revision: 0 });
function restoredDraft(entity: ObjectRef, draftId=entity.id, initialRecipe?: Recipe): { recipe: Recipe; baseRevision: number | null } {
  const closed = closedComposerDraft(`omnic.draft:${draftId}`); if (closed) return closed;
  try {
    const raw = localStorage.getItem(storageKey(draftId));
    if (raw) { const saved = JSON.parse(raw); return { recipe: validateRecipe(saved.recipe), baseRevision: Number.isSafeInteger(saved.baseRevision) ? saved.baseRevision : null }; }
  } catch { /* A damaged draft never prevents opening the canonical object. */ }
  return { recipe: validateRecipe(entity.omnic ?? initialRecipe ?? newOmnicDraft()), baseRevision: entity.omnic?.revision ?? null };
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Recovery, shared history and library lifecycle only. Construction belongs to
 * the progressively designed Atomnic tools, not a second procedural interface. */
export function OmnicComposer({ entity, objects, history, onSave, onCopy, workspaceId, isNew=false, initialRecipe, onPreview }: Props) {
  const [atomnicBridge,setAtomnicBridge]=useState<AtomnicInteraction|null>(null);
  const draftId=workspaceId?`${workspaceId}:${entity.id}`:entity.id;
  const [initial] = useState(() => restoredDraft(entity,draftId,initialRecipe));
  const [draft, setDraft] = useState<Recipe>(initial.recipe);
  const [baseRevision, setBaseRevision] = useState<number | null>(initial.baseRevision);
  const baseRevisionRef = useRef(baseRevision); baseRevisionRef.current = baseRevision;
  const draftRef = useRef(draft); draftRef.current = draft;
  const [sample, setSample] = useState<Recipe | null>(null);
  const recipe = sample ?? draft, recipeRef = useRef(recipe); recipeRef.current = recipe;
  const [copyLabel, setCopyLabel] = useState(entity.label ? `${entity.label} variation` : isNew ? 'Omnic object' : 'Omnic variation');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const importInput = useRef<HTMLInputElement>(null), mounted = useRef(true);
  const owner = `omnic.draft:${draftId}`;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const resolve = useMemo(() => { const saved=objectResolver(objects); return (key: string,revision?:number) => key === entity.id && revision===undefined ? recipeRef.current : saved(key,revision); }, [objects,entity.id]);
  const evaluated = useMemo(() => {
    try { return { result: evaluateRecipe(recipe, resolve), error: '' }; }
    catch (failure) { return { result: null, error: failure instanceof Error ? failure.message : String(failure) }; }
  }, [recipe, resolve]);
  useEffect(() => { if (!evaluated.error) onPreview?.(recipe,atomnicBridge??undefined); }, [recipe, evaluated.error, onPreview,atomnicBridge]);
  useEffect(() => () => onPreview?.(null), [onPreview]);
  const commit = (next: Recipe, temporary = false) => {
    try {
      const checked = validateRecipe(next);
      if (temporary) { setSample(checked); return true; }
      const before = draftRef.current;
      draftRef.current = checked; setDraft(checked); setSample(null); setError(''); setNotice('');
      history.record(owner, normalizedHistory(before), normalizedHistory(checked), ['omnium'], ['omnium', 'window:omnic-composer']);
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
    catch { setError('Draft could not be preserved locally. Export JSON before closing.'); }
  }, [draft, draftId, baseRevision]);
  const save = () => {
    try {
      const next = validateRecipe({ ...recipeRef.current, version:2, revision: (entity.omnic?.revision ?? 0) + 1 });
      onSave(next, isNew ? copyLabel.trim() || 'Omnic object' : undefined);
      setBaseRevision(next.revision); draftRef.current = next; setDraft(next); setSample(null);
      setNotice('Shared definition saved.'); setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };
  const copy = () => { try { onCopy(validateRecipe({ ...recipeRef.current, revision: 1 }), copyLabel.trim() || 'Omnic variation'); setNotice('Copied as a new object.'); } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); } };
  const reset = () => { setBaseRevision(entity.omnic?.revision ?? null); commit(validateRecipe(entity.omnic ?? initialRecipe ?? newOmnicDraft())); };
  const shortcuts = useFeatureActions('omnicComposer', {
    'omnic.save': { enabled: !evaluated.error, run: save },
    'omnic.copy': { enabled: !evaluated.error, run: copy },
    'omnic.export': { enabled: true, run: () => download('omnic-recipe.json', recipeRef.current) },
    'omnic.import': { enabled: true, run: () => importInput.current?.click() },
    'omnic.reset': { enabled: true, run: reset },
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (shortcuts.handle(event)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (file.size > 1_000_000) { setError('Recipe import is limited to 1 MB.'); return; }
    try { const text = await file.text(); if (!mounted.current) return; const next = validateRecipe(JSON.parse(text)); setBaseRevision(entity.omnic?.revision ?? null); commit(next); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };
  const dirty = JSON.stringify(recipe) !== JSON.stringify(entity.omnic ?? null);
  return <div className="omnic-composer">
    <div className="omnic-toolbar">
      <strong>{entity.label || 'Omnic object'}</strong>
      <small title="Edits preview in Omnium before saving. Closing restores saved rendering and keeps the recoverable draft.">{isNew ? 'New · world draft' : dirty ? 'World draft · not saved' : `Revision ${entity.omnic?.revision ?? 0}`}</small>
      {(['omnic.save','omnic.copy','omnic.export','omnic.import','omnic.reset'] as const).map(action => <FunctionControl key={action} id={action} />)}
      <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
    </div>
    <UIField id="omnic:copy-name" label={isNew ? 'Glyph name' : 'Variation name'} category="Omnic"><label>{isNew ? 'Glyph name' : 'Copy name'} <input value={copyLabel} maxLength={200} onChange={event => setCopyLabel(event.target.value)} /></label></UIField>
    {(error || evaluated.error) && <small role="alert">{error || evaluated.error}</small>}{notice && <small role="status">{notice}</small>}
    {baseRevision !== (entity.omnic?.revision ?? null) && <small role="status" title="Reset loads the current shared definition. Save shared replaces it; Save copy preserves both.">Shared revision changed.</small>}
    <AtomnicEditor recipe={recipe} evaluation={evaluated.result} commit={commit} onBridge={setAtomnicBridge} />
  </div>;
}
