// The character switcher in the top bar.
import { newCharacter } from '../local/model.ts';
import type { Store } from '../local/store.ts';

export function Characters({ store, onNew }: { store: Store; onNew: () => void }) {
  const b = store.book;
  const c = store.character();
  return (
    <select aria-label="Character" value={c?.id ?? ''} onChange={(e) => {
      if (e.target.value === '+') {
        const n = newCharacter(`Character ${b.characters.length + 1}`);
        store.change((bk) => { bk.characters.push(n); bk.activeId = n.id; });
        onNew();
      } else store.change((bk) => { bk.activeId = e.target.value; });
    }}>
      {!c && <option value="">No character</option>}
      {b.characters.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      <option value="+">+ New character</option>
    </select>
  );
}
