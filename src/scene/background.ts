import { useEffect, useRef, useState } from 'react';
import { backendConfiguration, cloud, type Asset } from '../backend/client';
import type { ActionHistory } from '../ui/actionHistory';
import { localSceneBlob } from './library';

export type SceneReference = { asset: Asset; userId: string } | { localId: string };
type Backgrounds = { nodes: Record<string, SceneReference | null>; fallback: SceneReference | null };
const storageKey = 'omnia.scene.background.v2';
export const sceneReferenceKey = (value: SceneReference | null) => value ? 'localId' in value ? `local:${value.localId}` : `${value.userId}:${value.asset.id}` : '';
function valid(value: any): value is SceneReference {
  return value && (typeof value.localId === 'string' || typeof value.userId === 'string' && value.asset?.state === 'ready' &&
    typeof value.asset.id === 'string' && typeof value.asset.workspace_id === 'string' && value.asset.object_key === `${value.asset.workspace_id}/${value.asset.id}`);
}
function load(): Backgrounds {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (value && value.nodes && typeof value.nodes === 'object' && !Array.isArray(value.nodes))
      return { nodes: Object.fromEntries(Object.entries(value.nodes).filter((entry): entry is [string, SceneReference | null] => entry[1] === null || valid(entry[1]))), fallback: valid(value.fallback) ? value.fallback : null };
    const old = JSON.parse(localStorage.getItem('omnia.scene.background.v1') ?? 'null');
    return { nodes: {}, fallback: valid(old) ? old : null };
  } catch { return { nodes: {}, fallback: null }; }
}
/** References only in settings/history; local bytes in IndexedDB, private bytes in Storage. */
export function useSceneBackground(history: ActionHistory, nodeId: string | null) {
  const [backgrounds, setBackgrounds] = useState<Backgrounds>(load);
  const current = useRef(backgrounds); current.current = backgrounds;
  const reference = nodeId ? Object.hasOwn(backgrounds.nodes, nodeId) ? backgrounds.nodes[nodeId] : null : backgrounds.fallback;
  const [loaded, setLoaded] = useState<{ reference: SceneReference; userId: string | null; url: string } | null>(null), [error, setError] = useState('');
  const config = backendConfiguration(), client = config.kind === 'cloud' ? config.client : null;
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!client) return;
    let live = true, observed = false;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      observed = true; if (live) setUserId(session?.user.id ?? null);
    });
    void client.auth.getSession().then(result => { if (live && !observed) setUserId(result.data.session?.user.id ?? null); });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, [client]);
  const persist = (value: Backgrounds) => {
    // A failed durable commit must not claim success or create a history entry.
    localStorage.setItem(storageKey, JSON.stringify(value));
    current.current = value; setBackgrounds(value);
  };
  useEffect(() => history.register('scene.background', { read: () => current.current, write: persist }), [history]);
  const commit = (value: Backgrounds) => {
    const before = current.current; persist(value);
    history.record('scene.background', before, value, ['appearance'], ['omnium', 'scene', 'window:settings']);
  };
  const apply = (value: SceneReference | null, targetNodeId: string | null = nodeId) => {
    commit(targetNodeId ? { ...current.current, nodes: { ...current.current.nodes, [targetNodeId]: value } } : { ...current.current, fallback: value });
  };
  const forgetLocal = (id: string) => {
    const before = current.current;
    const matches = (value: SceneReference | null) => !!value && 'localId' in value && value.localId === id;
    persist({ nodes: Object.fromEntries(Object.entries(before.nodes).map(([key, value]) => [key, matches(value) ? null : value])), fallback: matches(before.fallback) ? null : before.fallback });
  };
  useEffect(() => {
    let live = true, objectURL: string | undefined;
    setLoaded(null); setError('');
    if (!reference) return;
    const local = 'localId' in reference;
    if (!local && (!client || reference.userId !== userId)) return;
    void (local ? localSceneBlob(reference.localId) : cloud.download(client!, reference.asset)).then(blob => {
      if (!live) return;
      objectURL = URL.createObjectURL(blob); setLoaded({ reference, userId, url: objectURL });
    }).catch(failure => { if (live) setError(failure instanceof Error ? failure.message : 'Saved scene is unavailable.'); });
    return () => { live = false; if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [client, reference, userId]);
  const authorized = reference && ('localId' in reference || reference.userId === userId);
  // Check identity during render so a previous node/account's URL cannot flash on navigation.
  return { reference, apply, forgetLocal, url: authorized && loaded?.reference === reference && ('localId' in reference || loaded.userId === userId) ? loaded.url : null, error };
}
