// Spell requirements: which spells teach a spell (its recipe). A spell with
// no recipe is taught by its school: knowing spells of the same school or
// element one level lower. A recipe names 1 to 5 spells instead.
import { useMemo, useState } from 'react';
import { spellMap, spells } from '../local/model.ts';
import type { Store } from '../local/store.ts';

const lv = (n: number) => (n === 0 ? 'Cantrip' : `Level ${n}`);

export default function Requirements({ store, focus }: { store: Store; focus?: string | null }) {
  const b = store.book;
  const all = useMemo(() => spells(b).sort((a, z) => a.name.localeCompare(z.name)), [b, b.extraSpells.length]);
  const map = useMemo(() => spellMap(b), [b, b.extraSpells.length]);
  const [target, setTarget] = useState(() => (focus ? map.get(focus)?.name ?? '' : ''));
  const t = all.find((s) => s.name.toLowerCase() === target.trim().toLowerCase()) ?? null;
  const current = t ? b.recipes.find((r) => r.result === t.id) ?? null : null;
  const [draft, setDraft] = useState<string[]>(() => current?.prereqs ?? []);
  const [add, setAdd] = useState('');
  const [msg, setMsg] = useState('');
  const pickTarget = (name: string) => {
    setTarget(name); setMsg('');
    const s = all.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    setDraft(s ? b.recipes.find((r) => r.result === s.id)?.prereqs ?? [] : []);
  };
  const addOne = () => {
    const s = all.find((x) => x.name.toLowerCase() === add.trim().toLowerCase());
    if (!s || !t || s.id === t.id || draft.includes(s.id) || draft.length >= 5) return;
    setDraft([...draft, s.id]); setAdd('');
  };
  const save = () => {
    if (!t) return;
    store.change((bk) => {
      bk.recipes = bk.recipes.filter((r) => r.result !== t.id);
      if (draft.length) bk.recipes.push({ result: t.id, prereqs: draft });
    });
    setMsg(draft.length ? `${t.name} is now taught by ${draft.map((id) => map.get(id)?.name ?? id).join(' + ')}.` : `${t.name} is taught by its school again.`);
  };
  const warn = t && draft.length > 0 && t.level > 0 && !draft.some((id) => (map.get(id)?.level ?? 0) === t.level - 1)
    ? `None of these is ${lv(t.level - 1).toLowerCase()}, so the level gate may still keep ${t.name} locked.` : '';

  return (
    <section className="card stack" id="requirements">
      <h3>Spell requirements</h3>
      <p className="muted">Every spell has requirements. By default a spell is taught by its school: know spells of the same school or element one level lower. Give a spell a recipe to name the exact spells (1 to 5) that teach it. {b.recipes.length} spell{b.recipes.length === 1 ? ' has' : 's have'} a recipe.</p>
      <label>Spell<input list="req-spells" value={target} placeholder="Type a spell name" onChange={(e) => pickTarget(e.target.value)} /></label>
      <datalist id="req-spells">{all.map((s) => <option key={s.id} value={s.name} />)}</datalist>
      {t && (
        <>
          <p className="muted tiny">{lv(t.level)} · {t.school} · {current ? 'has a recipe' : 'taught by its school'}</p>
          <div>
            <b>Taught by</b>
            {draft.length === 0 ? <p className="muted">Its school ({t.school} spells, or spells of the same element).</p> : (
              <ul className="spells">{draft.map((id) => (
                <li key={id}><span>{map.get(id)?.name ?? id} <span className="muted tiny">{lv(map.get(id)?.level ?? 0)}</span></span>
                  <button type="button" className="btn small" aria-label={`Remove ${map.get(id)?.name ?? id}`} onClick={() => setDraft(draft.filter((x) => x !== id))}>✕</button></li>
              ))}</ul>
            )}
          </div>
          <div className="row">
            <input list="req-spells" value={add} placeholder="Add a spell that teaches it" aria-label="Spell that teaches it" onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addOne(); }} style={{ flex: 1 }} />
            <button type="button" className="btn" disabled={!add || draft.length >= 5} onClick={addOne}>Add</button>
          </div>
          {warn && <p className="note">{warn}</p>}
          <div className="row">
            <button type="button" className="btn primary" onClick={save}>Save requirements</button>
            {draft.length > 0 && <button type="button" className="btn" onClick={() => setDraft([])}>Use its school</button>}
          </div>
          {msg && <p className="note" role="status">{msg}</p>}
        </>
      )}
    </section>
  );
}
