import { useEffect, useRef, useState } from 'react';
import { backendConfiguration, cloud, type Workspace, type WorkspaceMember, type Asset } from '../backend/client';
import { resolveScenePrompt, type SceneGeneration, type SceneGenerateInput, type SceneNode, type SceneSource } from '../../supabase/functions/_shared/contracts.ts';
import { CoupledField, type PropertyBindings } from '../properties/CoupledProperties';
import { UIField } from '../ui/UIField';
import { UISection } from '../ui/UISection';
import { FunctionControl } from '../ui/UIWorkspace';
import { useFeatureActions } from '../ui/useFeatureActions';
import type { SceneReference } from './background';

export function ScenePanel({ node, revision, bindings, onApply, hasBackground, backgroundError, backgroundKey }: {
  node: SceneNode | null; revision: number; bindings: PropertyBindings;
  onApply: (value: SceneReference | null) => void; hasBackground: boolean; backgroundError: string; backgroundKey?: string;
}) {
  const configuration = backendConfiguration(), client = configuration.kind === 'cloud' ? configuration.client : null;
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]), [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspace, setWorkspace] = useState(''), [jobs, setJobs] = useState<SceneGeneration[]>([]), [jobId, setJobId] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [generationEnabled, setGenerationEnabled] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const epoch = useRef(0), live = useRef(true), pending = useRef(false);
  const applied = useRef(0);
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
    if (!client) return;
    let mounted = true, observed = false, previous: string | null | undefined;
    const setIdentity = (id: string | null) => {
      if (!mounted || previous === id) return;
      previous = id; epoch.current++; pending.current = false;
      setGenerationEnabled(false);
      setUserId(id); setBusy(false); setJobs([]); setWorkspaces([]); setMembers([]); setWorkspace(''); setJobId(''); setError(''); setNotice('');
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
    }).catch(() => { if (mounted) setError('Workspace access could not be loaded. Sign in through Cloud connection.'); });
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
    }).catch(failure => { if (mounted) setError(failure.message); });
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
    const input: SceneGenerateInput = { operation: 'scene.generate', workspaceId: workspace, requestId: crypto.randomUUID(), prompt, variable, source,
      node: { ...node, notes: source === 'label' ? '' : node.notes } };
    if (new TextEncoder().encode(JSON.stringify(input)).length > 16384) { setError('Prompt and node input exceed 16 KiB. Shorten the prompt or choose Label only.'); return; }
    if (jobs.some(job => job.state === 'uncertain' || job.state === 'running' && Date.now() - Date.parse(job.created_at) >= 180000) &&
      !window.confirm('A previous generation has an uncertain outcome and may have used API credit. Start a new paid attempt?')) return;
    pending.current = true; setBusy(true); setError(''); setNotice('Generating one image…');
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
      if (currentIdentity()) { setError(failure instanceof Error ? failure.message : 'Generation failed.'); setNotice('Check saved status before starting another paid request.'); }
    } finally {
      if (currentIdentity()) { pending.current = false; setBusy(false); setRefresh(value => value + 1); }
    }
  }
  useFeatureActions('scene', {
    'scene.generate': { enabled: generationEnabled && !!userId && canWrite && !!resolved && !bindingError && !busy && !running, run: () => void generate() },
    'scene.refresh': { enabled: !!userId && !busy, run: () => { setError(''); setRefresh(value => value + 1); } },
    'scene.clear': { enabled: hasBackground, run: () => { applied.current++; onApply(null); } },
    'scene.apply': { enabled: !!userId && selected?.state === 'ready' && !!selected.asset_id && !busy, run: () => {
      const before = epoch.current, context = fingerprint, backgroundVersion = applied.current;
      void applyJob(selected!, userId!, () => live.current && epoch.current === before && latest.current === context && applied.current === backgroundVersion)
        .then(applied => { if (applied) setNotice('Saved scene applied.'); })
        .catch(failure => { if (live.current && epoch.current === before) setError(failure.message); });
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
    {!userId ? <small>Sign in through Workspace settings → Cloud connection to generate.</small> :
      <UIField id="scene.workspace" label="Scene workspace" category="Scene"><label>Workspace<select value={workspace} onChange={event => { setWorkspace(event.target.value); setJobs([]); setJobId(''); }}>
        <option value="">Choose workspace</option>{workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label></UIField>}
    <div className="scene-input-row"><FunctionControl id="scene.generate" /><FunctionControl id="scene.clear" /></div>
    {userId && canWrite && !generationEnabled && !error && <small>Image generation needs server API setup. A ChatGPT subscription does not include API credits.</small>}
    <div role="status" aria-live="polite">{notice}</div>
    {(error || backgroundError) && <small role="alert">{error || backgroundError}</small>}
    {userId && <UISection id="scene-saved-results" title="Saved results" defaultExpanded={false}>
      <UIField id="scene.result" label="Saved generation" category="Scene"><label>Generation<select value={jobId} onChange={event => setJobId(event.target.value)}>
        <option value="">No generation selected</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.input.node.label || 'Untitled'} · {job.state === 'running' && Date.now() - Date.parse(job.created_at) >= 180000 ? 'outcome uncertain' : job.state} · {new Date(job.created_at).toLocaleTimeString()}</option>)}
      </select></label></UIField>
      <div className="scene-input-row"><FunctionControl id="scene.apply" /><FunctionControl id="scene.refresh" /></div>
    </UISection>}
  </div>;
}
