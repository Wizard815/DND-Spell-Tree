// A character: who they are, their caster levels, mana (with rests, a new
// turn and changes like a potion), the spells they know with Cast, and the log.
import { useMemo, useState } from 'react';
import { cast, changeMana, checkBonus, highest, manaNow, newCharacter, newTurn, poolMax, quote, rest, rulesOf, spellMap, spells, type Ability, type Character } from '../local/model.ts';
import type { Store } from '../local/store.ts';

const num = (v: string, lo: number, hi: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };

export default function CharacterPage({ store }: { store: Store }) {
  const c = store.character();
  if (!c) {
    return (
      <section className="card">
        <h2>Make your first character</h2>
        <p className="muted">Characters are saved on this device. You can export them in Settings.</p>
        <button type="button" className="btn primary" onClick={() => store.change((b) => { const n = newCharacter('My wizard', { level: 1 }); b.characters.push(n); b.activeId = n.id; })}>New character</button>
      </section>
    );
  }
  return <Sheet key={c.id} store={store} c={c} />;
}

function Sheet({ store, c }: { store: Store; c: Character }) {
  const b = store.book;
  const r = rulesOf(b);
  const max = poolMax(c, r);
  const now = manaNow(c, r);
  const set = (f: (c: Character) => void) => store.change(() => f(c));
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const run = (f: () => string | void) => { setErr(''); setMsg(''); try { const m = f(); if (m) setMsg(m); } catch (e: any) { setErr(String(e?.message ?? e)); } };

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row between"><h2>{c.name}</h2>
          <button type="button" className="btn small danger" onClick={() => { if (confirmDelete(c.name)) store.change((bk) => { bk.characters = bk.characters.filter((x) => x.id !== c.id); bk.activeId = bk.characters[0]?.id ?? null; }); }}>Delete</button>
        </div>
        <div className="grid">
          <label>Name<input value={c.name} onChange={(e) => set((x) => { x.name = e.target.value.slice(0, 60); })} /></label>
          <label>Class<input value={c.className} placeholder="Wizard" onChange={(e) => set((x) => { x.className = e.target.value.slice(0, 40); })} /></label>
          <label>Level<input type="number" min={1} max={20} value={c.level} onChange={(e) => set((x) => { x.level = num(e.target.value, 1, 20); })} /></label>
          <label>Casting ability<select value={c.castingAbility} onChange={(e) => set((x) => { x.castingAbility = e.target.value as Ability; })}>
            <option value="int">Intelligence</option><option value="wis">Wisdom</option><option value="cha">Charisma</option></select></label>
          <label>Score<input type="number" min={1} max={30} value={c.score ?? ''} onChange={(e) => set((x) => { x.score = e.target.value === '' ? null : num(e.target.value, 1, 30); })} /></label>
        </div>
        <fieldset className="grid">
          <legend>Caster levels <span className="muted tiny">(a wizard is full, a paladin half, an eldritch knight third)</span></legend>
          {(['full', 'half', 'third'] as const).map((t) => (
            <label key={t}>{t[0].toUpperCase() + t.slice(1)}<input type="number" min={0} max={20} value={c.casterLevels[t] ?? 0} onChange={(e) => set((x) => { x.casterLevels = { ...x.casterLevels, [t]: num(e.target.value, 0, 20) }; })} /></label>
          ))}
        </fieldset>
        <div className="row">
          <label className="check"><input type="checkbox" checked={c.abilities.silent} onChange={(e) => set((x) => { x.abilities.silent = e.target.checked; })} /> Silent casting</label>
          <label className="check"><input type="checkbox" checked={c.abilities.dual} onChange={(e) => set((x) => { x.abilities.dual = e.target.checked; })} /> Dual cast</label>
          <span className="muted tiny">Abilities your DM grants.</span>
        </div>
        <p className="muted tiny">Mana pool {max} · casts spells up to level {highest(c)} · final checks d20 + {checkBonus(c)}</p>
      </section>

      <Mana store={store} c={c} max={max} now={now} run={run} />
      {(msg || err) && <p className={err ? 'err' : 'note'} role={err ? 'alert' : 'status'}>{err || msg}</p>}
      <Known store={store} c={c} run={run} />
      <section className="card stack">
        <h3>Log</h3>
        {c.log.length === 0 ? <p className="muted">Nothing yet.</p> : (
          <ul className="log">{c.log.slice(0, 60).map((e, i) => (
            <li key={i}><time>{new Date(e.at).toLocaleString()}</time> {e.note}{e.amount ? <b> {e.amount > 0 ? '+' : ''}{e.amount} mana</b> : null}</li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}

const confirmDelete = (name: string) => (typeof window !== 'undefined' && 'confirm' in window ? window.confirm(`Delete ${name}? This can't be undone.`) : true);

function Mana({ store, c, max, now, run }: { store: Store; c: Character; max: number; now: number; run: (f: () => string | void) => void }) {
  const [amt, setAmt] = useState('');
  const [why, setWhy] = useState('');
  const b = store.book;
  return (
    <section className="card stack">
      <div className="row between"><h3>Mana</h3><b className="big">{now} / {max}</b></div>
      <div className="meter"><span style={{ width: `${max ? Math.max(0, Math.min(100, (now / max) * 100)) : 0}%` }} /></div>
      <div className="row">
        <button type="button" className="btn" onClick={() => run(() => { store.change(() => newTurn(c)); return 'A new turn.'; })}>New turn</button>
        <button type="button" className="btn" onClick={() => run(() => { store.change((bk) => rest(bk, c, 'short')); return 'Short rest: the turn, echo strain and surge reset.'; })}>Short rest</button>
        <button type="button" className="btn" onClick={() => run(() => { store.change((bk) => rest(bk, c, 'long')); return 'Long rest: mana is full, and failed final checks can be tried again.'; })}>Long rest</button>
      </div>
      <div className="row">
        <label>Change<input type="number" value={amt} placeholder="+8 or -3" onChange={(e) => setAmt(e.target.value)} style={{ width: 100 }} /></label>
        <label style={{ flex: 1 }}>Why<input value={why} placeholder="Potion of mana" onChange={(e) => setWhy(e.target.value)} /></label>
        <button type="button" className="btn primary" disabled={amt === ''} onClick={() => run(() => { const n = store.change((bk) => changeMana(bk, c, { delta: Number(amt) }, why)); setAmt(''); setWhy(''); return `Mana is now ${n}.`; })}>Apply</button>
      </div>
      <p className="muted tiny">Every change is logged. Mana never goes above the pool.</p>
      {b.characters.length > 1 && <p className="muted tiny">Switch characters at the top right.</p>}
    </section>
  );
}

function Known({ store, c, run }: { store: Store; c: Character; run: (f: () => string | void) => void }) {
  const b = store.book;
  const map = useMemo(() => spellMap(b), [b, b.extraSpells.length]);
  const [add, setAdd] = useState('');
  const [silent, setSilent] = useState(false);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const list = c.known.map((k) => ({ ...k, s: map.get(k.id) })).filter((x) => x.s).sort((a, z) => a.s!.level - z.s!.level || a.s!.name.localeCompare(z.s!.name));
  const options = spells(b).filter((s) => !c.known.some((k) => k.id === s.id)).sort((a, z) => a.name.localeCompare(z.name));
  return (
    <section className="card stack">
      <div className="row between"><h3>Known spells ({list.length})</h3>
        {c.abilities.silent && <label className="check"><input type="checkbox" checked={silent} onChange={(e) => setSilent(e.target.checked)} /> Cast silently</label>}
      </div>
      {list.length === 0 && <p className="muted">None yet. Learn spells on the Tree, or add the ones this character already knows below.</p>}
      <ul className="spells">
        {list.map(({ id, how, s }) => {
          const at = levels[id] ?? s!.level;
          let q: ReturnType<typeof quote> | null = null;
          try { q = quote(b, c, id, at); } catch { q = null; }
          return (
            <li key={id}>
              <div><b>{s!.name}</b> <span className="muted tiny">{s!.level ? `Level ${s!.level}` : 'Cantrip'} · {s!.school}{how === 'gift' ? ' · gift' : ''}</span></div>
              <div className="row">
                {s!.level > 0 && (
                  <select aria-label={`Cast ${s!.name} at level`} value={at} onChange={(e) => setLevels({ ...levels, [id]: Number(e.target.value) })}>
                    {Array.from({ length: Math.max(0, highest(c) - s!.level + 1) }, (_, i) => s!.level + i).map((l) => <option key={l} value={l}>Level {l}</option>)}
                  </select>
                )}
                <span className="muted tiny" title={q?.breakdown.map((x) => `${x.what}: ${x.mana}`).join('\n')}>{q ? `${q.cost} mana` : ''}{q && !q.allowed ? ` · ${q.reasons[0]}` : ''}</span>
                <button type="button" className="btn small primary" disabled={!q?.allowed} onClick={() => run(() => {
                  const out = store.change((bk) => cast(bk, c, id, at, silent));
                  return `Cast ${s!.name}${silent ? ' silently' : ''} for ${out.cost} mana.${out.saves.length ? ` Roll ${out.saves.map((x) => `a ${x.ability.toUpperCase()} save DC ${x.dc} (${x.why}; ${x.onFail} on a failure)`).join(' and ')}.` : ''}${out.lowMana ? ' Low mana: disadvantage on concentration saves.' : ''}`;
                })}>Cast</button>
                <button type="button" className="btn small" aria-label={`Forget ${s!.name}`} onClick={() => store.change(() => { c.known = c.known.filter((k) => k.id !== id); })}>✕</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="row">
        <input list="all-spells" value={add} placeholder="Add a spell this character already knows" onChange={(e) => setAdd(e.target.value)} style={{ flex: 1 }} aria-label="Spell to add" />
        <datalist id="all-spells">{options.map((s) => <option key={s.id} value={s.name} />)}</datalist>
        <button type="button" className="btn" disabled={!add} onClick={() => run(() => {
          const s = options.find((x) => x.name.toLowerCase() === add.trim().toLowerCase());
          if (!s) throw new Error(`No spell called ${add}`);
          store.change(() => { c.known.push({ id: s.id, how: 'learned' }); });
          setAdd('');
          return `${s.name} added.`;
        })}>Add</button>
      </div>
    </section>
  );
}
