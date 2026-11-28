// The helper: a small chat drawer that answers from the spell list and rules
// (see answer.ts). No AI model; nothing leaves the device.
import { useEffect, useRef, useState } from 'react';
import { answer } from './answer.ts';
import type { Store } from '../local/store.ts';

const ASK = ['What can I learn?', 'How long to learn Fireball?', 'How much mana does Shatter cost at level 3?', 'How does study work?', 'What does Counterspell do?'];

export default function Helper({ store }: { store: Store }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [log, setLog] = useState<{ who: 'you' | 'bot'; text: string }[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [log, open]);
  const ask = (text: string) => {
    if (!text.trim()) return;
    const a = answer(store.book, store.character(), text);
    setLog((l) => [...l, { who: 'you', text }, { who: 'bot', text: a.text }]);
    setQ('');
  };
  return (
    <>
      <button type="button" className="helper-fab" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Ask'}</button>
      {open && (
        <section className="helper" aria-label="Helper">
          <header><b>Helper</b><small>Searches the spells and rules. No AI model.</small></header>
          <div className="helper-log">
            {!log.length && <p className="muted tiny">Ask about {store.character()?.name.split(' ')[0] ?? 'your character'}'s spells, mana or the rules. Try one:</p>}
            {log.map((m, i) => <p key={i} className={`msg ${m.who}`}>{m.text}</p>)}
            <div ref={end} />
          </div>
          <div className="helper-chips">{ASK.map((x) => <button key={x} type="button" onClick={() => ask(x)}>{x}</button>)}</div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input aria-label="Your question" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question" />
            <button type="submit">Ask</button>
          </form>
        </section>
      )}
    </>
  );
}
