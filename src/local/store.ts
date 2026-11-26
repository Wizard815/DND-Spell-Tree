// Keeps the book on this device (localStorage) and tells the app when it
// changes. If storage is blocked (a private window) the book lives in memory
// for this visit.
import { active, emptyBook, finalCheck, giveSpell, normalizeBook, scrollCast, spellMap, startStudy, stopStudy, studyDaysLog, studyPlan, studyView, tree, type Book, type Character } from './model.ts';
import type { TreeBackend } from '../tree/types.ts';

const KEY = 'spelltree.book.v1';

export class Store {
  book: Book;
  private subs = new Set<() => void>();
  version = 0;
  constructor() {
    let raw: unknown = null;
    try { const s = localStorage.getItem(KEY); raw = s ? JSON.parse(s) : null; } catch { raw = null; }
    this.book = raw ? normalizeBook(raw) : emptyBook();
  }
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  getVersion = () => this.version;
  /** Change the book, save it, tell everyone. */
  change<T>(f: (b: Book) => T): T {
    const out = f(this.book);
    this.version++;
    try { localStorage.setItem(KEY, JSON.stringify(this.book)); } catch { /* storage blocked: keep it in memory */ }
    for (const s of this.subs) s();
    return out;
  }
  replace(b: Book) { this.change(() => { this.book = normalizeBook(b); }); }
  character(): Character | null { return active(this.book); }
}

/** The tree's backend on this device: the active character, the rules engine in the browser. */
export function localBackend(store: Store): TreeBackend {
  const me = () => { const c = store.character(); if (!c) throw new Error('Make a character first'); return c; };
  const withMe = <T>(f: (b: Book, c: Character) => T) => Promise.resolve().then(() => store.change((b) => f(b, me())));
  return {
    tree: async () => tree(store.book, store.character()),
    spell: async (id) => spellMap(store.book).get(id) ?? null,
    plan: async (id, source, lab) => studyPlan(store.book, me(), id, source, lab),
    studies: async () => (store.character()?.studies ?? []).map((x) => studyView(store.book, x)),
    start: (id, o) => withMe((b, c) => startStudy(b, c, id, o)),
    days: (sid, n) => withMe((b, c) => studyDaysLog(b, c, sid, n)),
    check: (sid, d20) => withMe((b, c) => finalCheck(b, c, sid, d20)),
    scrollCast: (sid) => withMe((b, c) => scrollCast(b, c, sid)),
    stop: (sid) => withMe((b, c) => stopStudy(b, c, sid)),
    give: (id) => withMe((b, c) => giveSpell(b, c, id)),
    canOverride: true,
  };
}
