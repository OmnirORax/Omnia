import { useEffect, useRef, useState } from 'react';
import { backendConfiguration, cloud, type Workspace, type WorkspaceMember, type Asset } from '../backend/client';
import { resolveScenePrompt, type SceneGeneration, type SceneGenerateInput, type SceneNode, type SceneSource } from '../../supabase/functions/_shared/contracts.ts';
import { CoupledField, type PropertyBindings } from '../properties/CoupledProperties';
import { UIField } from '../ui/UIField';
import { UISection } from '../ui/UISection';
import { FunctionControl } from '../ui/UIWorkspace';
import { useFeatureActions } from '../ui/useFeatureActions';
import type { SceneReference } from './background';
import { deleteLocalScene, downloadScene, importLocalScene, listLocalScenes, loadCopiedPrompt, localSceneBlob, saveCopiedPrompt, type LocalScene, type ScenePromptSnapshot } from './library';

export function ScenePanel({ node, revision, bindings, onApply, hasBackground, backgroundError, backgroundKey, onForgetLocal, nodeExists }: {
  node: SceneNode | null; revision: number; bindings: PropertyBindings;
  onApply: (value: SceneReference | null, targetNodeId?: string | null) => void;
  onForgetLocal: (id: string) => void; nodeExists: (id: string) => boolean; hasBackground: boolean; backgroundError: string; backgroundKey?: string;
}) {
  const configuration = backendConfiguration(), client = configuration.kind === 'cloud' ? configuration.client : null;
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]), [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspace, setWorkspace] = useState(''), [jobs, setJobs] = useState<SceneGeneration[]>([]), [jobId, setJobId] = useState('');
  const [busy, setBusy] = useState(false), [apiError, setAPIError] = useState(''), [notice, setNotice] = useState('');
  const [generationEnabled, setGenerationEnabled] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const epoch = useRef(0), live = useRef(true), pending = useRef(false);
  const applied = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<ScenePromptSnapshot | null>(loadCopiedPrompt);
  const [imageTarget, setImageTarget] = useState<'copied' | 'active'>(() => loadCopiedPrompt() ? 'copied' : 'active');
  const [localImages, setLocalImages] = useState<LocalScene[]>([]), [localId, setLocalId] = useState('');
  const [localBusy, setLocalBusy] = useState(false), [localError, setLocalError] = useState('');
  const localPending = useRef(false);
  type ImportContext = { target: string; input: ScenePromptSnapshot | null; backgroundVersion: number; background: string | undefined };
  const fileContext = useRef<ImportContext | null>(null);
  const localSelected = localImages.find(item => item.id === localId);
  const prompt = String(bindings.values['scene.generate']['scene.prompt']);
  const variable = String(bindings.values['scene.generate']['scene.variable']);
  const source = String(bindings.values['scene.generate']['scene.source']) as SceneSource;
  const fingerprint = JSON.stringify([node, revision, prompt, variable, source, workspace, userId, backgroundKey]);
  const latest = useRef(fingerprint); latest.current = fingerprint;
  const applyCurrent = useRef(onApply); applyCurrent.current = onApply;
  let resolved = '', bindingError = '';
  try { if (node) resolved = resolveScenePrompt(prompt, variable, source, node); else bindingError = 'Select an Omnium node to supply the prompt input.'; }
  catch (failure) { bindingError = failure instanceof Error ? failure.message : 'Invalid prompt input.'; }

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; epoch.current++; };
  }, []);
  useEffect(() => {
    let mounted = true;
    void listLocalScenes().then(items => { if (mounted) { setLocalImages(items); setLocalId(items[0]?.id ?? ''); } })
      .catch(failure => { if (mounted) setLocalError(failure.message); });
    return () => { mounted = false; };
  }, []);
  const snapshot = (): ScenePromptSnapshot | null => {
    if (!node) return null;
    // Read shared getters at invocation so temporary Master Controller inputs apply.
    const inputs = bindings.values['scene.generate'];
    const prompt = String(inputs['scene.prompt']), variable = String(inputs['scene.variable']), source = String(inputs['scene.source']) as SceneSource;
    try {
      return { prompt, variable, source, node: { ...node, notes: source === 'label' ? '' : node.notes },
        resolved: resolveScenePrompt(prompt, variable, source, node), copiedAt: new Date().toISOString() };
    } catch { return null; }
  };
  const targetNode = imageTarget === 'copied' ? copied?.node : node;
  function importContext(): ImportContext | null {
    if (!targetNode || !nodeExists(targetNode.id)) { setLocalError('Select an existing node as the image destination.'); return null; }
    return { target: targetNode.id, input: imageTarget === 'copied' ? copied : snapshot(), backgroundVersion: applied.current, background: backgroundKey };
  }
  async function copyPrompt() {
    const input = snapshot(); if (!input) { setLocalError('The prompt or active-node input is invalid. Check Resolved prompt.'); return; }
    try {
      await navigator.clipboard.writeText(input.resolved);
      if (!live.current) return;
      saveCopiedPrompt(input); setCopied(input); setImageTarget('copied'); setLocalError('');
      setNotice(`Prompt copied for ${input.node.label || 'Untitled'}. Generate in ChatGPT, then paste or choose the returned image.`);
    } catch { if (live.current) setLocalError('Could not copy/save the prompt. Select the text under Resolved prompt and copy it manually; choose Active node as the image destination.'); }
  }
  async function receiveImage(file: File, context: ImportContext) {
    const item = await importLocalScene(file, context.input);
    if (!live.current) return;
    setLocalImages(items => [item, ...items]); setLocalId(item.id);
    // The explicit destination may differ from the currently selected node. Do not
    // overwrite a replacement/clear made while decoding, or apply to a removed node.
    if (nodeExists(context.target) && applied.current === context.backgroundVersion && backgroundNow.current === context.background) {
      applied.current++; applyCurrent.current({ localId: item.id }, context.target);
      setNotice(`Image saved and assigned to ${context.input?.node.label || 'the chosen node'}. Select that node to see its scene.`);
    } else setNotice('Image saved in Imported images. The background changed or the destination was removed; apply it explicitly when ready.');
  }
  const backgroundNow = useRef(backgroundKey); backgroundNow.current = backgroundKey;
  async function importFile(file: File, context: ImportContext | null) {
    if (!context || localPending.current) return;
    localPending.current = true; setLocalBusy(true); setLocalError('');
    try { await receiveImage(file, context); }
    catch (failure) { if (live.current) setLocalError(failure instanceof Error ? failure.message : 'Image import failed.'); }
    finally { localPending.current = false; if (live.current) setLocalBusy(false); }
  }
  async function pasteImage() {
    const context = importContext(); if (!context || localPending.current) return;
    localPending.current = true; setLocalBusy(true); setLocalError('');
    try {
      if (!navigator.clipboard?.read) throw new Error('Clipboard image access is unavailable. Save the image from ChatGPT and use Choose image.');
      const clipboard = await navigator.clipboard.read();
      const item = clipboard.find(item => item.types.some(type => ['image/png', 'image/jpeg', 'image/webp'].includes(type)));
      const type = item?.types.find(type => ['image/png', 'image/jpeg', 'image/webp'].includes(type));
      if (!item || !type) throw new Error('No image on the clipboard. Copy the image itself, or save it and use Choose image.');
      const blob = await item.getType(type);
      if (live.current) await receiveImage(new File([blob], `ChatGPT scene.${type.split('/')[1]}`, { type }), context);
    } catch (failure) { if (live.current) setLocalError(failure instanceof Error ? failure.message : 'Clipboard access was denied. Use Choose image instead.'); }
    finally { localPending.current = false; if (live.current) setLocalBusy(false); }
  }
  useEffect(() => {
    if (!client) return;
    let mounted = true, observed = false, previous: string | null | undefined;
    const setIdentity = (id: string | null) => {
      if (!mounted || previous === id) return;
      previous = id; epoch.current++; pending.current = false;
      setGenerationEnabled(false);
      setUserId(id); setBusy(false); setJobs([]); setWorkspaces([]); setMembers([]); setWorkspace(''); setJobId(''); setAPIError(''); setNotice('');
    };
    const { data } = client.auth.onAuthStateChange((_event, session) => { observed = true; setIdentity(session?.user.id ?? null); });
    void client.auth.getSession().then(result => { if (!observed) setIdentity(result.data.session?.user.id ?? null); });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, [client]);
  useEffect(() => {
    if (!client || !userId) return;
    let mounted = true;
    void Promise.all([cloud.workspaces(client), client.from('workspace_members').select('*').eq('user_id', userId)]).then(([list, membership]) => {
      if (!mounted) return;
      if (membership.error) throw new Error('Workspace access could not be loaded.');
      setWorkspaces(list); setMembers(membership.data); setWorkspace(old => list.some(item => item.id === old) ? old : list[0]?.id ?? '');
    }).catch(() => { if (mounted) setAPIError('Workspace access could not be loaded. Sign in through Cloud connection.'); });
    return () => { mounted = false; };
  }, [client, userId, refresh]);
  useEffect(() => {
    if (!client || !userId || !workspace) return;
    let mounted = true;
    setGenerationEnabled(false);
    void Promise.all([cloud.sceneGenerations(client, workspace), cloud.sceneCapabilities(client, workspace)]).then(([items, capabilities]) => {
      if (!mounted) return;
      setGenerationEnabled(capabilities.enabled);
      setJobs(items); setJobId(old => items.some(item => item.id === old) ? old : items[0]?.id ?? '');
    }).catch(failure => { if (mounted) setAPIError(failure.message); });
    return () => { mounted = false; };
  }, [client, userId, workspace, refresh]);
  const running = jobs.some(job => job.state === 'running' && Date.now() - Date.parse(job.created_at) < 180000);
  useEffect(() => {
    if (!busy && !running) return;
    const timer = setInterval(() => setRefresh(value => value + 1), 4000);
    return () => clearInterval(timer);
  }, [busy, running]);
  const selected = jobs.find(item => item.id === jobId);
  const canWrite = members.some(member => member.workspace_id === workspace && ['owner', 'editor'].includes(member.role));
  async function applyJob(job: SceneGeneration, identity: string, stillCurrent: () => boolean) {
    if (!client || !job.asset_id || job.state !== 'ready') throw new Error('This generation has no ready image.');
    const result = await client.from('assets').select('*').eq('id', job.asset_id).eq('workspace_id', job.workspace_id).eq('state', 'ready').single();
    if (result.error) throw new Error('The generated image is unavailable or was deleted.');
    if (!stillCurrent()) return false;
    applied.current++; applyCurrent.current({ asset: result.data as Asset, userId: identity });
    return true;
  }
  async function generate() {
    if (!client || !userId || !node || pending.current || bindingError || !canWrite || !generationEnabled) return;
    const start = fingerprint, generationEpoch = epoch.current, backgroundVersion = applied.current;
    const captured = snapshot(); if (!captured) { setAPIError('The prompt or active-node input is invalid.'); return; }
    const input: SceneGenerateInput = { operation: 'scene.generate', workspaceId: workspace, requestId: crypto.randomUUID(),
      prompt: captured.prompt, variable: captured.variable, source: captured.source, node: captured.node };
    if (new TextEncoder().encode(JSON.stringify(input)).length > 16384) { setAPIError('Prompt and node input exceed 16 KiB. Shorten the prompt or choose Label only.'); return; }
    if (jobs.some(job => job.state === 'uncertain' || job.state === 'running' && Date.now() - Date.parse(job.created_at) >= 180000) &&
      !window.confirm('A previous generation has an uncertain outcome and may have used API credit. Start a new paid attempt?')) return;
    pending.current = true; setBusy(true); setAPIError(''); setNotice('Generating one image…');
    const currentIdentity = () => live.current && epoch.current === generationEpoch;
    const sameContext = () => currentIdentity() && latest.current === start && applied.current === backgroundVersion;
    try {
      const job = await cloud.generateScene(client, input);
      if (!currentIdentity()) return;
      setJobs(old => [job, ...old.filter(item => item.id !== job.id)]); setJobId(job.id);
      if (job.state === 'ready' && sameContext()) {
        if (await applyJob(job, userId, sameContext)) setNotice('Scene generated and applied.');
      } else setNotice('Result saved for its original input. Select it and apply when ready.');
    } catch (failure) {
      if (currentIdentity()) { setAPIError(failure instanceof Error ? failure.message : 'Generation failed.'); setNotice('Check saved status before starting another paid request.'); }
    } finally {
      if (currentIdentity()) { pending.current = false; setBusy(false); setRefresh(value => value + 1); }
    }
  }
  useFeatureActions('scene', {
    'scene.copyPrompt': { enabled: !!resolved && !bindingError && !localBusy, run: () => void copyPrompt() },
    'scene.chooseImage': { enabled: !!targetNode && nodeExists(targetNode.id) && !localBusy && !busy, run: () => {
      fileContext.current = importContext(); if (fileContext.current) fileInput.current?.click();
    } },
    'scene.pasteImage': { enabled: !!targetNode && nodeExists(targetNode.id) && !localBusy && !busy, run: () => void pasteImage() },
    'scene.applyLocal': { enabled: !!localSelected && !!node && !localBusy && !busy, run: () => {
      try { applied.current++; onApply({ localId: localSelected!.id }); setNotice('Imported scene applied to this node.'); setLocalError(''); }
      catch { setLocalError('The scene assignment could not be saved in this browser.'); }
    } },
    'scene.downloadLocal': { enabled: !!localSelected && !localBusy, run: () => {
      void localSceneBlob(localSelected!.id).then(blob => downloadScene(blob, localSelected!.name)).catch(failure => { if (live.current) setLocalError(failure.message); });
    } },
    'scene.deleteLocal': { enabled: !!localSelected && !localBusy && !busy, run: () => {
      const item = localSelected!;
      if (!window.confirm(`Permanently delete “${item.name}” from this browser? Its scenes will be cleared. Image deletion cannot be undone. Download it first to keep a backup.`)) return;
      localPending.current = true; setLocalBusy(true); setLocalError('');
      // Resource deletion is explicit and irreversible, unlike applying/clearing a scene.
      try { applied.current++; onForgetLocal(item.id); }
      catch { localPending.current = false; setLocalBusy(false); setLocalError('Could not clear scene assignments; the image was not deleted.'); return; }
      void deleteLocalScene(item.id).then(() => {
        if (!live.current) return;
        setLocalImages(items => items.filter(image => image.id !== item.id)); setLocalId(''); setNotice('Image deleted from this browser.');
      }).catch(failure => { if (live.current) setLocalError(failure.message); })
        .finally(() => { localPending.current = false; if (live.current) setLocalBusy(false); });
    } },
    'scene.generate': { enabled: generationEnabled && !!userId && canWrite && !!resolved && !bindingError && !busy && !running && !localBusy, run: () => void generate() },
    'scene.refresh': { enabled: !!userId && !busy, run: () => { setAPIError(''); setRefresh(value => value + 1); } },
    'scene.clear': { enabled: hasBackground, run: () => { try { applied.current++; onApply(null); setNotice('Scene cleared for this node.'); } catch { setLocalError('Scene assignment could not be saved.'); } } },
    'scene.apply': { enabled: !!userId && selected?.state === 'ready' && !!selected.asset_id && !!node && !busy && !localBusy, run: () => {
      const before = epoch.current, context = fingerprint, backgroundVersion = applied.current;
      void applyJob(selected!, userId!, () => live.current && epoch.current === before && latest.current === context && applied.current === backgroundVersion)
        .then(applied => { if (applied) setNotice('Saved scene applied.'); })
        .catch(failure => { if (live.current && epoch.current === before) setAPIError(failure.message); });
    } },
  });
  return <div className="scene-panel">
    <UIField id="scene.prompt" label="Image prompt" category="Scene"><CoupledField bindings={bindings} consumer="scene.generate" property="scene.prompt" /></UIField>
    <div className="scene-input-row">
      <UIField id="scene.variable" label="Prompt variable" category="Scene"><CoupledField bindings={bindings} consumer="scene.generate" property="scene.variable" /></UIField>
      <UIField id="scene.source" label="Active node input" category="Scene"><CoupledField bindings={bindings} consumer="scene.generate" property="scene.source" /></UIField>
    </div>
    <small role="status">Active node: {node?.label || 'None'} · {'{{'}{variable}{'}}'}</small>
    {bindingError && <small>{bindingError}</small>}
    <UISection id="scene-resolved-prompt" title="Resolved prompt" defaultExpanded={false}><pre className="scene-resolved">{resolved || 'No resolved input.'}</pre></UISection>
    <div className="scene-input-row"><FunctionControl id="scene.copyPrompt" /><FunctionControl id="scene.clear" /></div>
    <UIField id="scene.imageTarget" label="Image destination" category="Scene"><label>Image belongs to<select value={imageTarget} onChange={event => setImageTarget(event.target.value as 'copied' | 'active')}>
      <option value="active">Active node{node ? `: ${node.label || 'Untitled'}` : ' (select one)'}</option>
      <option value="copied" disabled={!copied}>Copied prompt{copied ? `: ${copied.node.label || 'Untitled'}` : ' (copy one first)'}</option>
    </select></label></UIField>
    <div className="scene-input-row"><FunctionControl id="scene.pasteImage" /><FunctionControl id="scene.chooseImage" /></div>
    <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={event => {
      const file = event.target.files?.[0], context = fileContext.current;
      event.target.value = ''; if (file) void importFile(file, context);
    }} />
    <small title="Saved in this browser for this website address, separate from atlas/settings exports. Download originals to back them up or transfer them. No image is uploaded to the cloud.">Images stay in this browser · scenes restore per node.</small>
    <div role="status" aria-live="polite">{localBusy ? 'Saving image…' : notice}</div>
    {(localError || backgroundError) && <small role="alert">{localError || backgroundError}</small>}
    {copied && <UISection id="scene-copied-prompt" title="Last copied prompt" defaultExpanded={false}>
      <small>{copied.node.label || 'Untitled'} · {new Date(copied.copiedAt).toLocaleString()}</small>
      <pre className="scene-resolved">{copied.resolved}</pre>
    </UISection>}
    <UISection id="scene-imported-images" title="Imported images" defaultExpanded={false}>
      <UIField id="scene.localImage" label="Imported scene image" category="Scene"><label>Image<select value={localId} onChange={event => setLocalId(event.target.value)}>
        <option value="">Choose saved image</option>{localImages.map(item => <option key={item.id} value={item.id}>{item.input?.node.label || item.name} · {new Date(item.createdAt).toLocaleString()}</option>)}
      </select></label></UIField>
      {localSelected && <small>{localSelected.name} · {localSelected.width}×{localSelected.height}</small>}
      <div className="scene-input-row"><FunctionControl id="scene.applyLocal" /><FunctionControl id="scene.downloadLocal" /><FunctionControl id="scene.deleteLocal" /></div>
      {localSelected?.input && <pre className="scene-resolved" title="Prompt saved with this import">{localSelected.input.resolved}</pre>}
    </UISection>
    <UISection id="scene-api" title="API generation (optional)" defaultExpanded={false}>
      {!userId ? <small>Sign in through Workspace settings → Cloud connection to use API generation.</small> :
        <UIField id="scene.workspace" label="Scene workspace" category="Scene"><label>Workspace<select value={workspace} onChange={event => { setWorkspace(event.target.value); setJobs([]); setJobId(''); }}>
          <option value="">Choose workspace</option>{workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label></UIField>}
      <FunctionControl id="scene.generate" />
      {userId && canWrite && !generationEnabled && !apiError && <small>API generation is disabled until server setup is complete. Manual import works without it.</small>}
      {apiError && <small role="alert">{apiError}</small>}
      {userId && <UISection id="scene-saved-results" title="Saved API results" defaultExpanded={false}>
        <UIField id="scene.result" label="Saved generation" category="Scene"><label>Generation<select value={jobId} onChange={event => setJobId(event.target.value)}>
          <option value="">No generation selected</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.input.node.label || 'Untitled'} · {job.state === 'running' && Date.now() - Date.parse(job.created_at) >= 180000 ? 'outcome uncertain' : job.state} · {new Date(job.created_at).toLocaleTimeString()}</option>)}
        </select></label></UIField>
        <div className="scene-input-row"><FunctionControl id="scene.apply" /><FunctionControl id="scene.refresh" /></div>
      </UISection>}
    </UISection>
  </div>;
}
