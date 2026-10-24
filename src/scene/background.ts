import { useEffect, useRef, useState } from 'react';
import { backendConfiguration, cloud, type Asset } from '../backend/client';
import type { ActionHistory } from '../ui/actionHistory';

export type SceneReference = { asset: Asset; userId: string };
const storageKey = 'omnia.scene.background.v1';
function load(): SceneReference | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return value && typeof value.userId === 'string' && value.asset?.state === 'ready' &&
      typeof value.asset.id === 'string' && typeof value.asset.workspace_id === 'string' &&
      value.asset.object_key === `${value.asset.workspace_id}/${value.asset.id}` ? value : null;
  } catch { return null; }
}
/** Persist references only; bytes are authorized downloads with session-scoped object URLs. */
export function useSceneBackground(history: ActionHistory) {
  const [reference, setReference] = useState<SceneReference | null>(load);
  const current = useRef(reference); current.current = reference;
  const [url, setURL] = useState<string | null>(null), [error, setError] = useState('');
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
  const persist = (value: SceneReference | null) => {
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { setError('Scene could not be remembered in this browser.'); }
    current.current = value; setReference(value);
  };
  // The common history replays only the saved reference, never the paid request.
  history.register('scene.background', { read: () => current.current, write: persist });
  const apply = (value: SceneReference | null) => {
    const before = current.current; persist(value);
    history.record('scene.background', before, value, ['appearance'], ['omnium', 'window:settings']);
  };
  useEffect(() => {
    let live = true, objectURL: string | undefined;
    setURL(null); setError('');
    if (!client || !reference || reference.userId !== userId) return;
    void cloud.download(client, reference.asset).then(blob => {
      if (!live) return;
      objectURL = URL.createObjectURL(blob); setURL(objectURL);
    }).catch(() => { if (live) setError('Saved scene is unavailable. Check cloud access or clear the scene.'); });
    return () => { live = false; if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [client, reference, userId]);
  return { reference, apply, url: reference?.userId === userId ? url : null, error };
}
