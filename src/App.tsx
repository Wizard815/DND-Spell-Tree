// The app shell: a spell tree, a character page and settings. It runs on this
// device's own data, or on an Alexandria world after signing in.
import { useMemo, useState, useSyncExternalStore } from 'react';
import SpellTree from './tree/SpellTree.tsx';
import { localBackend, Store } from './local/store.ts';
import { manaNow, poolMax, rulesOf } from './local/model.ts';
import { alexandriaBackend, loadLink, saveLink, type Link } from './alexandria/client.ts';
import CharacterPage from './pages/Character.tsx';
import SettingsPage from './pages/Settings.tsx';
import { Characters } from './pages/Characters.tsx';

const store = new Store();
type Tab = 'tree' | 'character' | 'settings';

export default function App() {
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  const [tab, setTab] = useState<Tab>(() => (store.book.characters.length ? 'tree' : 'character'));
  const [link, setLinkState] = useState<Link | null>(() => loadLink());
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
        <div className="brand"><span aria-hidden="true">✦</span> Spell Tree</div>
        <nav className="tabs" aria-label="Pages">
          {(['tree', 'character', 'settings'] as Tab[]).map((t) => (
            <button key={t} type="button" aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t === 'tree' ? 'Tree' : t === 'character' ? 'Character' : 'Settings'}</button>
          ))}
        </nav>
        <div className="who">
          {link && (
            <button type="button" className="mode" onClick={() => setUseLink(!useLink)} title="Switch between this device and the Alexandria world">
              {onAlex ? `◉ ${link.worldName}` : '◉ This device'}
            </button>
          )}
          {!onAlex && <Characters store={store} onNew={() => setTab('character')} />}
        </div>
      </header>
      {!onAlex && c && (
        <div className="manabar" aria-label={`Mana ${now} of ${max}`}>
          <span>{c.name}</span>
          <div className="meter"><span style={{ width: `${max ? Math.max(0, Math.min(100, (now / max) * 100)) : 0}%` }} /></div>
          <b>{now} / {max}</b>
        </div>
      )}
      <main className="main">
        {tab === 'tree' && (onAlex || c
          ? <SpellTree backend={backend} reloadKey={onAlex ? link?.worldId : `${version}:${c?.id}`} />
          : <p className="empty">Make a character first, on the Character page.</p>)}
        {tab === 'character' && (onAlex
          ? <p className="empty">Your character lives in {link!.worldName} on Alexandria. Switch to "This device" (top right) to use the app's own characters.</p>
          : <CharacterPage store={store} />)}
        {tab === 'settings' && <SettingsPage store={store} link={link} setLink={setLink} />}
      </main>
    </div>
  );
}
