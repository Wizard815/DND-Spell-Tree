// The app shell: a spell tree, a character page and settings. It runs on this
// device's own data, or on an Alexandria world after signing in.
import { useMemo, useState, useSyncExternalStore } from 'react';
import SpellTree from './tree/SpellTree.tsx';
import { localBackend, Store } from './local/store.ts';
import { checkBonus, highest, manaNow, poolMax, rulesOf } from './local/model.ts';
import { alexandriaBackend, loadLink, saveLink, type Link } from './alexandria/client.ts';
import CharacterPage from './pages/Character.tsx';
import SettingsPage from './pages/Settings.tsx';
import { Characters } from './pages/Characters.tsx';
import Helper from './demo/Helper.tsx';
import Welcome from './demo/Welcome.tsx';
import { demoParty } from './demo/party.ts';
import { APP_NAME } from './name.ts';

const store = new Store();
// The demo build (VITE_DEMO=1) starts with an example party mid-campaign.
if (import.meta.env.VITE_DEMO && !store.book.characters.length) store.change((b) => { const p = demoParty(b); b.characters.push(...p); b.activeId = p[0].id; });
type Tab = 'tree' | 'character' | 'settings';

export default function App() {
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  const [tab, setTab] = useState<Tab>(() => (store.book.characters.length ? 'tree' : 'character'));
  const [link, setLinkState] = useState<Link | null>(() => loadLink());
  const [editSpell, setEditSpell] = useState<string | null>(null);
  const [useLink, setUseLink] = useState<boolean>(() => !!loadLink());
  const setLink = (l: Link | null) => { saveLink(l); setLinkState(l); setUseLink(!!l); };
  const backend = useMemo(() => (useLink && link ? alexandriaBackend(link) : localBackend(store)), [useLink, link]);
  const c = store.character();
  const r = rulesOf(store.book);
  const max = c ? poolMax(c, r) : 0;
  const now = c ? manaNow(c, r) : 0;
  const onAlex = useLink && !!link;

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span aria-hidden="true">✦</span> {APP_NAME}</div>
        <nav className="tabs" aria-label="Pages">
          {(['tree', 'character', 'settings'] as Tab[]).map((t) => (
            <button key={t} type="button" aria-current={tab === t ? 'page' : undefined} onClick={() => { setTab(t); setEditSpell(null); }}>{t === 'tree' ? 'Tree' : t === 'character' ? 'Character' : 'Settings'}</button>
          ))}
        </nav>
        {!onAlex && c && (
          <div className="stats" aria-label="Character stats">
            <span className="stat"><small>{c.className || 'Caster'}</small><b>Level {c.level}</b></span>
            <span className="stat mana" aria-label={`Mana ${now} of ${max}`}><small>Mana</small><b>{now} / {max}</b><i className="meter"><span style={{ width: `${max ? Math.max(0, Math.min(100, (now / max) * 100)) : 0}%` }} /></i></span>
            <span className="stat" title="From the caster levels: a full caster casts up to half their level (rounded up, max 9). See Character for half and third casters."><small>Casts up to</small><b>{highest(c) ? `Level ${highest(c)}` : 'Cantrips'}</b></span>
            <span className="stat"><small>{c.castingAbility.toUpperCase()}</small><b>{c.score ?? '–'}</b></span>
            <span className="stat"><small>Checks</small><b>d20 + {checkBonus(c)}</b></span>
            <span className="stat"><small>Known</small><b>{c.known.length}</b></span>
            {c.studies.some((x) => x.status === 'studying' || x.status === 'ready') && <span className="stat"><small>Studying</small><b>{c.studies.filter((x) => x.status === 'studying' || x.status === 'ready').length}</b></span>}
            <button type="button" className="stat edit" onClick={() => setTab('character')}>Edit</button>
          </div>
        )}
        <div className="who">
          {link && (
            <button type="button" className="mode" onClick={() => setUseLink(!useLink)} title="Switch between this device and the Alexandria world">
              {onAlex ? `◉ ${link.worldName}` : '◉ This device'}
            </button>
          )}
          {!onAlex && <Characters store={store} onNew={() => setTab('character')} />}
        </div>
      </header>
      <main className="main">
        {tab === 'tree' && (onAlex || c
          ? <SpellTree backend={backend} reloadKey={onAlex ? link?.worldId : `${version}:${c?.id}`} onEditRequirements={onAlex ? undefined : (s) => { setEditSpell(s.id); setTab('settings'); }} />
          : <p className="empty">Make a character first, on the Character page.</p>)}
        {tab === 'character' && (onAlex
          ? <p className="empty">Your character lives in {link!.worldName} on Alexandria. Switch to "This device" (top right) to use the app's own characters.</p>
          : <CharacterPage store={store} />)}
        {tab === 'settings' && <SettingsPage store={store} link={link} setLink={setLink} focus={editSpell} />}
      </main>
      {!onAlex && <Helper store={store} />}
      <Welcome demo={!!import.meta.env.VITE_DEMO} />
    </div>
  );
}
