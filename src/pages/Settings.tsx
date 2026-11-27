// Settings: connect to an Alexandria world, the rules this device uses,
// importing a profile or more spells, and saving everything to a file.
import { useState } from 'react';
import { checkSpellRules, PLAN_COSTS } from '../engine/rules.ts';
import { importProfile, importSpells, normalizeBook, SRD_ATTRIBUTION, spellSources, spells } from '../local/model.ts';
import type { Store } from '../local/store.ts';
import { signIn, type Link } from '../alexandria/client.ts';
import Requirements from './Requirements.tsx';

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const readFile = (f: File) => f.text();

export default function SettingsPage({ store, link, setLink, focus }: { store: Store; link: Link | null; setLink: (l: Link | null) => void; focus?: string | null }) {
  const b = store.book;
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [rules, setRules] = useState(() => JSON.stringify(b.rules ?? {}, null, 2));
  const [costs, setCosts] = useState(() => (b.costs ?? PLAN_COSTS).join(', '));
  const run = async (f: () => Promise<string> | string) => { setErr(''); setMsg(''); try { setMsg(await f()); } catch (e: any) { setErr(String(e?.message ?? e)); } };

  return (
    <div className="stack">
      {(msg || err) && <p className={err ? 'err' : 'note'} role={err ? 'alert' : 'status'}>{err || msg}</p>}
      {focus && <Requirements key={focus} store={store} focus={focus} />}
      <Connect link={link} setLink={setLink} />

      <section className="card stack">
        <h3>Save and move</h3>
        <p className="muted">Everything lives on this device. Save it to a file to keep a copy or move it to another device.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => download('spell-tree.json', b)}>Save to a file</button>
          <label className="btn">Open a file<input type="file" accept="application/json,.json" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            run(async () => { const n = normalizeBook(JSON.parse(await readFile(f))); store.replace(n); return `Loaded ${n.characters.length} character${n.characters.length === 1 ? '' : 's'}.`; });
            e.target.value = '';
          }} /></label>
        </div>
      </section>

      <section className="card stack">
        <h3>Spell books</h3>
        <p className="muted">Turn off the books your table doesn't use. Their spells leave the tree; known spells stay on the character. Spells from books other than the SRD have no description here: it's in the book.</p>
        <fieldset className="grid books">
          <legend className="sr-only">Spell books</legend>
          {spellSources(b).map((x) => (
            <label key={x.id} className="check">
              <input type="checkbox" checked={x.on} onChange={(e) => store.change((bk) => { bk.sources = { ...(bk.sources ?? {}), [x.id]: e.target.checked }; })} />
              <span>{x.name} <small className="muted">({x.count})</small></span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="card stack">
        <h3>Spells and recipes</h3>
        <p className="muted">{spells(b).length} spells ({b.extraSpells.length} added). {b.recipes.length ? `${b.recipes.length} recipes from a profile.` : 'Without recipes, a spell is taught by its school: know spells of the same school or element one level lower.'}</p>
        <div className="row">
          <label className="btn">Import an Alexandria profile<input type="file" accept=".json" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            run(async () => { const txt = await readFile(f); const r = store.change((bk) => importProfile(bk, txt)); setRules(JSON.stringify(store.book.rules ?? {}, null, 2)); return `Imported ${r.recipes} recipes and ${r.lines} lines.${r.missing.length ? ` Not found: ${r.missing.slice(0, 8).join(', ')}${r.missing.length > 8 ? '…' : ''}` : ''}`; });
            e.target.value = '';
          }} /></label>
          <label className="btn">Import spells<input type="file" accept=".json" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            run(async () => { const txt = await readFile(f); const n = store.change((bk) => importSpells(bk, txt)); return `Added ${n} spells.`; });
            e.target.value = '';
          }} /></label>
          {(b.recipes.length > 0 || b.lines) && <button type="button" className="btn" onClick={() => run(() => { store.change((bk) => { bk.recipes = []; bk.lines = null; }); return 'Back to school recipes and element lines.'; })}>Clear recipes and lines</button>}
        </div>
        <p className="muted tiny">An Alexandria DM exports a profile from Codex → Settings → Spell rules. Spells use Alexandria's spell format.</p>
      </section>
      {!focus && <Requirements store={store} />}

      <section className="card stack">
        <h3>Rules</h3>
        <p className="muted">The same rules an Alexandria world uses. Only what you change is kept; the rest are the plan's defaults.</p>
        <label>Mana cost per spell level (cantrip, then 1 to 9)<input value={costs} onChange={(e) => setCosts(e.target.value)} /></label>
        <label>Rule changes (JSON)<textarea rows={8} value={rules} onChange={(e) => setRules(e.target.value)} spellCheck={false} /></label>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => run(() => {
            const parsed = rules.trim() ? JSON.parse(rules) : {};
            checkSpellRules(parsed);
            const c = costs.split(/[\s,]+/).filter(Boolean).map(Number);
            if (c.length !== 10 || c.some((x) => !Number.isFinite(x) || x < 0)) throw new Error('The cost table needs 10 numbers');
            store.change((bk) => { bk.rules = parsed; bk.costs = c.join() === PLAN_COSTS.join() ? null : c; });
            return 'Rules saved.';
          })}>Save rules</button>
          <button type="button" className="btn" onClick={() => { setRules('{}'); setCosts(PLAN_COSTS.join(', ')); }}>Back to the defaults</button>
        </div>
        <p className="muted tiny">Example: {'{"upcastSurcharge": 0, "learning": {"rates": {"alone": 1, "text": 2, "mentor": 3}}}'}</p>
      </section>

      <section className="card stack">
        <h3>About</h3>
        <p className="muted tiny">{SRD_ATTRIBUTION}</p>
      </section>
    </div>
  );
}

function Connect({ link, setLink }: { link: Link | null; setLink: (l: Link | null) => void }) {
  const [server, setServer] = useState(link?.server ?? '');
  const [user, setUser] = useState(link?.username ?? '');
  const [pass, setPass] = useState('');
  const [worlds, setWorlds] = useState<{ id: string; name: string; role: string }[] | null>(null);
  const [tok, setTok] = useState<{ server: string; token: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (link) {
    return (
      <section className="card stack">
        <h3>Alexandria</h3>
        <p>Signed in as <b>{link.username}</b> to <b>{link.worldName}</b> on {link.server}. Use the switch at the top right to go between that world and this device.</p>
        <div className="row"><button type="button" className="btn" onClick={() => setLink(null)}>Sign out</button></div>
      </section>
    );
  }
  return (
    <section className="card stack">
      <h3>Connect to Alexandria</h3>
      <p className="muted">Sign in to your Alexandria server to see your world's spell tree and study there. The server owner adds this app's address to <code>ALX_CORS_ORIGINS</code>.</p>
      {!worlds ? (
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault(); setErr(''); setBusy(true);
          try { const r = await signIn(server, user, pass); setTok({ server: r.server, token: r.token }); setWorlds(r.worlds); setPass(''); } catch (x: any) { setErr(String(x?.message ?? x)); } finally { setBusy(false); }
        }}>
          <label>Server<input value={server} placeholder="alexandria.example.com" onChange={(e) => setServer(e.target.value)} required autoComplete="url" /></label>
          <div className="grid">
            <label>Username<input value={user} onChange={(e) => setUser(e.target.value)} required autoComplete="username" /></label>
            <label>Password<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="current-password" /></label>
          </div>
          <div className="row"><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></div>
        </form>
      ) : (
        <div className="stack">
          <p>Pick a world:</p>
          {worlds.length === 0 && <p className="muted">This account isn't in any world yet.</p>}
          <div className="row">{worlds.map((w) => (
            <button key={w.id} type="button" className="btn" onClick={() => setLink({ server: tok!.server, token: tok!.token, username: user, worldId: w.id, worldName: w.name })}>{w.name} <span className="muted tiny">({w.role})</span></button>
          ))}</div>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}
