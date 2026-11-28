// Signing in to an Alexandria server and using one world's spell tree.
// The server must allow this app's address in ALX_CORS_ORIGINS.
import type { TreeBackend } from '../tree/types.ts';

export interface Link { server: string; token: string; username: string; worldId: string; worldName: string }
const KEY = 'spelltree.alexandria.v1';

export function loadLink(): Link | null { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
export function saveLink(l: Link | null) { try { if (l) localStorage.setItem(KEY, JSON.stringify(l)); else localStorage.removeItem(KEY); } catch { /* blocked */ } }

export const cleanServer = (s: string) => {
  const t = s.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export async function call<T = any>(server: string, token: string | null, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error(`Could not reach ${server}. Check the address, and that the server lists this app in ALX_CORS_ORIGINS.`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

export async function signIn(server: string, username: string, password: string) {
  const s = cleanServer(server);
  const { token } = await call<{ token: string }>(s, null, 'POST', '/api/auth/login', { username, password });
  const me = await call<{ worlds: { id: string; name: string; role: string }[] }>(s, token, 'GET', '/api/me');
  return { server: s, token, worlds: me.worlds };
}

export function alexandriaBackend(l: Link): TreeBackend {
  const sp = (p: string) => `/api/worlds/${encodeURIComponent(l.worldId)}/spells${p}`;
  const c = <T = any>(m: string, p: string, b?: unknown) => call<T>(l.server, l.token, m, sp(p), b);
  return {
    tree: () => c('GET', '/tree'),
    spell: (id) => c('GET', `/s/${encodeURIComponent(id)}`).then((x: any) => x?.spell ?? x).catch(() => null),
    plan: (spellId, source, lab) => c('POST', '/study/plan', { spellId, source, lab }),
    studies: () => c<{ studies: any[] }>('GET', '/study').then((x) => x.studies ?? []),
    start: (spellId, o) => c('POST', '/study', { spellId, ...o }),
    days: (sid, days) => c('POST', `/study/${sid}/days`, { days }),
    check: (sid, d20) => c('POST', `/study/${sid}/check`, d20 === undefined ? {} : { d20 }),
    scrollCast: (sid) => c('POST', `/study/${sid}/scroll-cast`),
    stop: (sid) => c('POST', `/study/${sid}/stop`),
  };
}
