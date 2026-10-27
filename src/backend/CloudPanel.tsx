import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { backendConfiguration, cloud, type Asset, type Workspace, type WorkspaceMember } from './client';
import { UISection } from '../ui/UISection';
import { UIField } from '../ui/UIField';
import { FunctionControl } from '../ui/UIWorkspace';
import { useFeatureActions } from '../ui/useFeatureActions';

export function CloudPanel() {
  const config = backendConfiguration(), client = config.kind === 'cloud' ? config.client : null;
  const [auth, setAuth] = useState<{ session: Session | null; epoch: number }>({ session: null, epoch: 0 });
  const epoch = useRef(0);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState(''), [workspaceId, setWorkspaceId] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]), [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]), [assetId, setAssetId] = useState('');
  const [file, setFile] = useState<File | null>(null), fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const creation = useRef<{ name: string; id: string } | null>(null);
  const signedIn = !!auth.session;
  const role = members.find(member => member.workspace_id === workspaceId)?.role;
  const canWrite = role === 'owner' || role === 'editor';
  const selected = assets.find(asset => asset.id === assetId);

  useEffect(() => {
    if (!client) return;
    let live = true;
    const apply = (session: Session | null) => {
      if (!live) return;
      const next = ++epoch.current;
      setAuth({ session, epoch: next });
      setPassword(''); setAssets([]); setAssetId(''); setWorkspaces([]); setMembers([]); setWorkspaceId('');
      setFile(null); if (fileInput.current) fileInput.current.value = '';
      creation.current = null; setBusy(false); setError(''); setNotice('');
    };
    const before = epoch.current;
    const { data } = client.auth.onAuthStateChange((_event, session) => apply(session));
    void client.auth.getSession().then(result => {
      if (!live || epoch.current !== before) return;
      if (result.error) setError('Cloud session could not be loaded.'); else apply(result.data.session);
    });
    return () => { live = false; epoch.current++; data.subscription.unsubscribe(); };
  }, [client]);

  useEffect(() => {
    if (!client || !auth.session) return;
    let live = true;
    const current = epoch.current;
    void (async () => {
      try {
        const [list, membership, files] = await Promise.all([
          cloud.workspaces(client), client.from('workspace_members').select('*').eq('user_id', auth.session!.user.id),
          workspaceId ? cloud.assets(client, workspaceId) : Promise.resolve([]),
        ]);
        if (membership.error) throw new Error('Workspace permissions could not be loaded.');
        if (!live || current !== epoch.current) return;
        setWorkspaces(list); setMembers(membership.data);
        setWorkspaceId(old => list.some(item => item.id === old) ? old : list[0]?.id ?? '');
        setAssets(files); setAssetId(old => files.some(item => item.id === old) ? old : files[0]?.id ?? '');
      } catch (failure) {
        if (live && current === epoch.current) { setAssets([]); setMembers([]); setWorkspaces([]); setError(failure instanceof Error ? failure.message : 'Cloud data could not be loaded.'); }
      }
    })();
    return () => { live = false; };
  }, [client, auth.epoch, auth.session, workspaceId, refresh]);

  async function run(work: (stillCurrent: () => boolean) => Promise<string | void>) {
    const current = epoch.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const message = await work(() => current === epoch.current);
      if (current === epoch.current) { setNotice(message ?? ''); setRefresh(value => value + 1); }
    } catch (failure) {
      if (current === epoch.current) { setError(failure instanceof Error ? failure.message : 'Cloud operation failed.'); setRefresh(value => value + 1); }
    } finally { if (current === epoch.current) setBusy(false); }
  }
  useFeatureActions('backend', {
    'backend.signIn': { enabled: !!client && !signedIn && !busy && !!email.trim() && !!password, run: () => void run(async () => {
      const result = await client!.auth.signInWithPassword({ email: email.trim(), password });
      setPassword('');
      if (result.error) throw new Error('Sign-in failed. Check the account and password.');
    }) },
    'backend.signOut': { enabled: !!client && signedIn && !busy, run: () => void run(async () => {
      const result = await client!.auth.signOut({ scope: 'local' }); if (result.error) throw new Error('Sign-out failed.');
    }) },
    'backend.refresh': { enabled: signedIn && !busy, run: () => { setError(''); setRefresh(value => value + 1); } },
    'backend.createWorkspace': { enabled: signedIn && !busy && !!workspaceName.trim(), run: () => void run(async stillCurrent => {
      const name = workspaceName.trim();
      if (creation.current?.name !== name) creation.current = { name, id: crypto.randomUUID() };
      const result = await cloud.createWorkspace(client!, name, creation.current.id);
      if (stillCurrent()) { creation.current = null; setWorkspaceId(result.id); setWorkspaceName(''); }
      return 'Private workspace created. Your atlas remains local.';
    }) },
    'backend.upload': { enabled: signedIn && canWrite && !!file && !busy, run: () => void run(async stillCurrent => {
      await cloud.upload(client!, workspaceId, file!, crypto.randomUUID());
      if (stillCurrent()) { setFile(null); if (fileInput.current) fileInput.current.value = ''; }
      return 'Private image uploaded.';
    }) },
    'backend.download': { enabled: signedIn && selected?.state === 'ready' && !busy, run: () => void run(async stillCurrent => {
      const blob = await cloud.download(client!, selected!);
      if (!stillCurrent()) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = selected!.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return 'File downloaded.';
    }) },
    'backend.finalize': { enabled: signedIn && canWrite && selected?.state === 'pending' && selected.created_by === auth.session?.user.id && !busy,
      run: () => void run(async () => { await cloud.finalize(client!, assetId); return 'Upload verified.'; }) },
    'backend.delete': { enabled: signedIn && canWrite && !!selected && !busy, run: () => void run(async () => {
      if (!window.confirm(`Delete the private cloud file “${selected!.name}”? This cannot be undone.`)) return;
      await cloud.remove(client!, assetId); return 'Cloud file deleted.';
    }) },
  });

  return <UISection id="cloud" title="Cloud connection" defaultExpanded={false}>
    {config.kind === 'local' ? <p>Cloud is not configured. Your atlas stays in this browser.</p> :
      config.kind === 'invalid' ? <p role="alert">{config.message}</p> : <>
        <p>Local autosave stays local. Omnic library provides explicit cloud workspace save/load when its backend migration is installed.</p>
        {!signedIn ? <>
          <UIField id="backend.email" label="Account email" category="Cloud"><label>Email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} /></label></UIField>
          <UIField id="backend.password" label="Account password" category="Cloud"><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label></UIField>
          <FunctionControl id="backend.signIn" />
        </> : <>
          <p>Signed in as {auth.session!.user.email}</p>
          <FunctionControl id="backend.signOut" />
          <UIField id="backend.workspaceName" label="New workspace name" category="Cloud"><label>New workspace<input maxLength={100} value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} /></label></UIField>
          <FunctionControl id="backend.createWorkspace" />
          <UIField id="backend.workspace" label="Cloud workspace" category="Cloud"><label>Workspace<select value={workspaceId} onChange={event => { setWorkspaceId(event.target.value); setAssets([]); setAssetId(''); }}><option value="">Choose workspace</option>{workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label></UIField>
          <FunctionControl id="backend.refresh" />
          {workspaceId && <>
            <p>Access: {role ?? 'checking'}. Showing up to 200 recent files.</p>
            <UIField id="backend.file" label="Private image file" category="Cloud"><label>Image<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={!canWrite || busy} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label></UIField>
            <FunctionControl id="backend.upload" />
            <UIField id="backend.asset" label="Cloud file" category="Cloud"><label>File<select value={assetId} onChange={event => setAssetId(event.target.value)}><option value="">Choose file</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} — {asset.state}</option>)}</select></label></UIField>
            <FunctionControl id="backend.download" /><FunctionControl id="backend.finalize" /><FunctionControl id="backend.delete" />
          </>}
        </>}
        {busy && <p role="status">Working…</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
      </>}
  </UISection>;
}
