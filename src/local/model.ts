// The app's own data: a "book" of characters, the world's rule changes,
// imported spells and recipes, all kept on this device. Every function here
// is plain data in, data out (no storage, no React), so the tests run it with
// Node and the backend in ./backend.ts only loads and saves.
import srdFile from '../data/srd-5.2.1-spells.json' with { type: 'json' };
import {
  PLAN_COSTS, STUDY_SOURCES, checkSpellRules, complexity, dailyProgress, extraRecipeSpells, finalCheckDC, gradeFinalCheck, highestSpellLevel, isHybrid,
  learnGates, lineMastery, multiclassHighest, multiclassPool, poolFor, quoteCast, resolveRules, scroll as scrollRule, studyCoin, studyDays, studyPoints, upcastCost,
  type CastQuote, type CasterType, type LearnMissing, type SpellRules, type StudySource,
} from '../engine/rules.ts';
import type { CheckOut, SpellDetail, Study, StudyPlan, TreeData, TreeSpell } from '../tree/types.ts';

// ---- data ----------------------------------------------------------------------------------------------------

export interface Spell extends SpellDetail {
  classes: string[];
  damageTypes: string[];
  /** A mana cost of its own (else the cost table's). */
  manaCost?: number | null;
}
export interface Known { id: string; how: 'learned' | 'gift' }
export interface LogEntry { at: string; kind: 'cast' | 'mana' | 'rest' | 'study' | 'learn'; note: string; amount?: number }
export interface LocalStudy extends Omit<Study, 'name' | 'perDay' | 'daysLeft'> { createdAt: string }
export interface CastMemory { turnLeveled: number; surgeUsed: boolean; echo: Record<string, number>; highUsed: string[] }
export type Ability = 'int' | 'wis' | 'cha';

export interface Character {
  id: string;
  name: string;
  className: string;
  level: number;
  castingAbility: Ability;
  /** The spellcasting ability score (INT, WIS or CHA). */
  score: number | null;
  casterLevels: Partial<Record<Exclude<CasterType, 'none'>, number>>;
  /** Mana now; null means a full pool. */
  mana: number | null;
  abilities: { silent: boolean; dual: boolean };
  known: Known[];
  studies: LocalStudy[];
  log: LogEntry[];
  cast: CastMemory;
}

export interface Recipe { result: string; prereqs: string[] }
export interface Line { name: string; spells: string[] }

export interface Book {
  version: 1;
  characters: Character[];
  activeId: string | null;
  /** Only the rules this book changes (the same `spellRules` an Alexandria world stores). */
  rules: unknown;
  costs: number[] | null;
  /** Recipes by spell id. A spell without one is taught by its school (see `recipeFor`). */
  recipes: Recipe[];
  extraSpells: Spell[];
  /** Spell lines. Left null, the lines are the elements in each spell's damage types. */
  lines: Line[] | null;
}

const SRD = srdFile as unknown as { attribution: string; spells: Spell[] };
export const SRD_ATTRIBUTION = SRD.attribution;
export const ELEMENTS = ['Acid', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];

export const emptyBook = (): Book => ({ version: 1, characters: [], activeId: null, rules: {}, costs: null, recipes: [], extraSpells: [], lines: null });

let uid = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();

export function newCharacter(name: string, o: Partial<Character> = {}): Character {
  return {
    id: newId('chr_'), name: name.trim().slice(0, 60) || 'New character', className: '', level: 1, castingAbility: 'int', score: 10, casterLevels: { full: 1 },
    mana: null, abilities: { silent: false, dual: false }, known: [], studies: [], log: [], cast: { turnLeveled: 0, surgeUsed: false, echo: {}, highUsed: [] }, ...o,
  };
}

// ---- reading the book ----------------------------------------------------------------------------------------

export function spells(b: Book): Spell[] {
  const out = new Map<string, Spell>();
  for (const s of SRD.spells) out.set(s.id, s);
  for (const s of b.extraSpells) out.set(s.id, s);
  return [...out.values()];
}
export const spellMap = (b: Book) => new Map(spells(b).map((s) => [s.id, s]));
export const rulesOf = (b: Book): SpellRules => resolveRules(b.rules);
export const costsOf = (b: Book): number[] => b.costs ?? PLAN_COSTS;
export const active = (b: Book): Character | null => b.characters.find((c) => c.id === b.activeId) ?? b.characters[0] ?? null;

/** A spell's lines: the book's own lines, else the elements of its damage types. */
export function linesOf(b: Book, s: Spell): string[] {
  if (b.lines) return b.lines.filter((l) => l.spells.includes(s.id)).map((l) => l.name);
  return [...new Set((s.damageTypes ?? []).filter((d) => ELEMENTS.includes(d)))].sort();
}

const hasCaster = (c: Character) => Object.values(c.casterLevels).some((x) => (x ?? 0) > 0);
export const poolMax = (c: Character, r: SpellRules) => (hasCaster(c) ? multiclassPool(c.casterLevels, r) : poolFor('full', c.level, r));
export const highest = (c: Character) => (hasCaster(c) ? multiclassHighest(c.casterLevels) : highestSpellLevel('full', c.level));
export const manaNow = (c: Character, r: SpellRules) => c.mana ?? poolMax(c, r);
export const proficiency = (level: number) => 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
export const mod = (score: number | null) => (score === null ? 0 : Math.floor((score - 10) / 2));
export const checkBonus = (c: Character) => mod(c.score) + proficiency(c.level);

/**
 * What teaches a spell: a recipe the book has for it, else its school. With
 * the school, the spells counted for the tier gate are the known spells of
 * the same school or of the same lines.
 */
export function recipeFor(b: Book, s: Spell, all: Map<string, Spell>, known: Set<string>): { id: string; prereqs: string[]; levels: number[]; missingSpells: string[]; byName: string[] } {
  const rc = b.recipes.find((x) => x.result === s.id);
  if (rc) {
    return {
      id: `recipe:${s.id}`, prereqs: rc.prereqs, byName: rc.prereqs.map((p) => all.get(p)?.name ?? p),
      levels: rc.prereqs.filter((p) => known.has(p)).map((p) => all.get(p)?.level ?? 0),
      missingSpells: rc.prereqs.filter((p) => !known.has(p)).map((p) => all.get(p)?.name ?? p),
    };
  }
  const lines = new Set(linesOf(b, s));
  const kin = [...known].map((k) => all.get(k)).filter((k): k is Spell => !!k && k.id !== s.id && (k.school === s.school || linesOf(b, k).some((l) => lines.has(l))));
  return { id: `school:${s.school}`, prereqs: kin.map((k) => k.id), byName: [`${s.school} spells${lines.size ? ` or ${[...lines].join(' or ')} spells` : ''}`], levels: kin.map((k) => k.level), missingSpells: [] };
}

export function gateText(m: LearnMissing): string {
  switch (m.kind) {
    case 'gate': return `know ${m.need} spell${m.need === 1 ? '' : 's'} of its school or lines${m.from === 'cantrip' ? ' that are cantrips' : m.from === 'below' ? ' one level lower' : ''} (knows ${m.have})`;
    case 'arcana': return `an Arcana check, DC ${m.dc}, to start`;
    case 'ability': return `spellcasting ability ${m.need} (has ${m.have ?? 'not set'})`;
    case 'level': return `able to cast level ${m.spellLevel} spells (can cast up to ${m.highest})`;
    case 'pool': return `a mana pool of ${m.need} (has ${m.have})`;
    case 'source': return `study it ${m.allowed.map((s) => (s === 'alone' ? 'alone' : `with a ${s}`)).join(' or ')}`;
    case 'research': return 'a research project (the DM decides)';
    case 'mastery': return `${m.line} mastery ${m.need} (has ${m.have})`;
  }
}

export function studyPlan(b: Book, c: Character, spellId: string, source: StudySource = 'alone', lab = false): StudyPlan {
  const all = spellMap(b);
  const s = all.get(spellId);
  if (!s) throw new Error('Spell not found');
  const r = rulesOf(b);
  const costs = costsOf(b);
  const known = new Set(c.known.map((k) => k.id));
  const rc = recipeFor(b, s, all, known);
  const lines = linesOf(b, s);
  const hybrid = isHybrid(lines);
  const cx = complexity(s.level, costs, s.manaCost ?? null);
  const needed = studyPoints(cx, { hybrid, extraSpells: rc.id.startsWith('recipe:') ? extraRecipeSpells(rc.prereqs.length, s.level, r) : 0 }, r);
  const missing: string[] = [];
  if (known.has(s.id)) missing.push('already known');
  for (const m of rc.missingSpells) missing.push(`know ${m}`);
  const mastery = lineMastery(c.known, (id) => { const k = all.get(id); return k ? linesOf(b, k) : []; }, r);
  let arcanaDC: number | null = null;
  for (const g of learnGates({
    spellLevel: s.level, castCost: upcastCost(s.level, s.level, costs, r, s.manaCost ?? null), knownRecipeLevels: rc.levels, highest: highest(c), casterLevel: c.level,
    abilityScore: c.score, poolMax: poolMax(c, r), source, research: false, arcanaPassed: false,
    hybridMastery: hybrid ? Object.fromEntries(lines.map((l) => [l, mastery[l] ?? 0])) : undefined,
  }, r)) {
    if (g.kind === 'arcana') arcanaDC = g.dc; else missing.push(gateText(g));
  }
  const gate = r.learning.gates[Math.max(0, Math.min(9, s.level))];
  const coin = studyCoin(cx, source, r);
  return {
    spellId: s.id, name: s.name, level: s.level, recipe: { id: rc.id, prereqs: rc.byName }, source, lab, hybrid, missing, canStart: missing.length === 0, arcanaDC, needed,
    perDay: dailyProgress(source, lab, r),
    days: Object.fromEntries(STUDY_SOURCES.map((x) => [x, gate.sources.includes(x) ? studyDays(needed, 0, dailyProgress(x, lab, r)) : null])) as StudyPlan['days'],
    materials: coin.materials, mentorFee: coin.mentorFee,
    gold: Object.fromEntries(STUDY_SOURCES.map((x) => { const g = studyCoin(cx, x, r); return [x, g.materials + g.mentorFee]; })) as StudyPlan['gold'],
    finalDC: finalCheckDC(s.level, r), checkBonus: checkBonus(c), scrollPoints: scrollRule(s.level, needed, r).points,
  };
}

export function studyView(b: Book, x: LocalStudy): Study {
  const r = rulesOf(b);
  const per = dailyProgress(x.source, x.lab, r);
  const { createdAt: _c, ...rest } = x;
  return { ...rest, name: spellMap(b).get(x.spellId)?.name ?? x.spellId, perDay: per, daysLeft: studyDays(x.needed, x.banked, per) };
}

/** Every spell, by school (Others last), hybrids apart, each with its status for this character. */
export function tree(b: Book, c: Character | null): TreeData {
  const all = spells(b);
  const known = new Map((c?.known ?? []).map((k) => [k.id, k.how]));
  const open = new Map((c?.studies ?? []).filter((x) => x.status !== 'learned').map((x) => [x.spellId, x]));
  const out: TreeSpell[] = all.map((s) => {
    const lines = linesOf(b, s);
    const how = known.get(s.id);
    const st = open.get(s.id);
    let status: TreeSpell['status'];
    let missing: string[] = [];
    let from: string[] = [];
    if (how) status = how === 'gift' ? 'gift' : 'known';
    else if (st) status = st.status === 'stopped' ? 'stopped' : 'studying';
    else if (!c) status = 'dark';
    else {
      const p = studyPlan(b, c, s.id);
      missing = p.missing;
      from = p.recipe?.prereqs ?? [];
      // Dark until the character is near it: a spell above what they can cast, or a recipe with none of its spells known.
      const far = s.level > highest(c) + 1 || (p.recipe?.id.startsWith('recipe:') && b.recipes.find((x) => x.result === s.id)!.prereqs.every((q) => !known.has(q)));
      status = p.canStart ? 'learn' : far ? 'dark' : 'locked';
    }
    return { id: s.id, name: s.name, level: s.level, school: s.school || 'Others', lines, hybrid: isHybrid(lines), status, missing, from, ...(st ? { study: { id: st.id, banked: st.banked, needed: st.needed } } : {}) };
  });
  const flat = out.filter((x) => !x.hybrid);
  const names = [...new Set(flat.map((x) => x.school))].sort((a, b2) => (a === 'Others' ? 1 : b2 === 'Others' ? -1 : a.localeCompare(b2)));
  const counts = Object.fromEntries(['known', 'gift', 'studying', 'stopped', 'learn', 'locked', 'hidden', 'dark'].map((k) => [k, out.filter((x) => x.status === k).length]));
  return { engine: true, schools: names.map((name) => ({ name, spells: flat.filter((x) => x.school === name) })), hybrids: out.filter((x) => x.hybrid), counts };
}

// ---- changing a character (each returns what changed; the caller saves the book) -----------------------------

const log = (c: Character, e: Omit<LogEntry, 'at'>) => { c.log.unshift({ at: now(), ...e }); if (c.log.length > 500) c.log.length = 500; };
const findStudy = (c: Character, sid: string) => { const x = c.studies.find((s) => s.id === sid); if (!x) throw new Error('Study not found'); return x; };
const openStudy = (c: Character, spellId: string) => c.studies.find((x) => x.spellId === spellId && x.status !== 'learned') ?? null;

export function startStudy(b: Book, c: Character, spellId: string, o: { source: StudySource; lab: boolean; scroll: boolean; arcana?: number }): Study {
  const p = studyPlan(b, c, spellId, o.source, o.lab);
  if (!p.canStart) throw new Error(`Not yet: ${p.missing.join('; ')}`);
  const cur = openStudy(c, spellId);
  if (p.arcanaDC !== null && !cur) {
    if (o.arcana === undefined || !Number.isFinite(o.arcana)) throw new Error(`Starting needs an Arcana check, DC ${p.arcanaDC}`);
    if (o.arcana < p.arcanaDC) { log(c, { kind: 'study', note: `Arcana ${o.arcana} vs ${p.arcanaDC}: not yet able to study ${p.name}` }); throw new Error(`The Arcana check failed (${o.arcana} vs DC ${p.arcanaDC}). Try again after a long rest.`); }
  }
  if (cur) {
    Object.assign(cur, { source: p.source, lab: p.lab, needed: p.needed, materials: p.materials, mentorFee: p.mentorFee, status: cur.banked >= p.needed ? 'ready' : 'studying' });
    log(c, { kind: 'study', note: `Back to studying ${p.name} (${p.source})` });
    return studyView(b, cur);
  }
  const banked = o.scroll ? Math.min(p.needed, p.scrollPoints) : 0;
  const x: LocalStudy = {
    id: newId('stu_'), spellId, source: p.source, lab: p.lab, needed: p.needed, banked, pendingDays: 0, days: 0, materials: p.materials, mentorFee: p.mentorFee,
    scrollHelp: o.scroll, status: banked >= p.needed ? 'ready' : 'studying', waitLongRest: false, attempts: 0, lastCheck: '', createdAt: now(),
  };
  c.studies.push(x);
  log(c, { kind: 'study', note: `Started studying ${p.name} (${p.source}${p.lab ? ', lab' : ''}${o.scroll ? ', with a scroll' : ''}): ${p.needed} points, ${p.materials + p.mentorFee} gp` });
  return studyView(b, x);
}

export function studyDaysLog(b: Book, c: Character, sid: string, n: number): Study {
  const x = findStudy(c, sid);
  if (x.status !== 'studying') throw new Error(x.status === 'ready' ? 'The study is complete: roll the final check' : `This study is ${x.status}`);
  if (!Number.isInteger(n) || n < 1 || n > 365) throw new Error('Days must be 1 to 365');
  x.banked = Math.min(x.needed, x.banked + n * dailyProgress(x.source, x.lab, rulesOf(b)));
  x.days += n;
  if (x.banked >= x.needed) x.status = 'ready';
  log(c, { kind: 'study', note: `${n} downtime day${n === 1 ? '' : 's'} studying ${spellMap(b).get(x.spellId)?.name ?? x.spellId}` });
  return studyView(b, x);
}

export function finalCheck(b: Book, c: Character, sid: string, d20?: number, roll: () => number = () => 1 + Math.floor(Math.random() * 20)): CheckOut {
  const x = findStudy(c, sid);
  if (x.status !== 'ready') throw new Error(x.status === 'studying' ? `Study first: ${x.banked} of ${x.needed} points` : `This study is ${x.status}`);
  if (x.waitLongRest) throw new Error('The last check failed: try again after a long rest');
  const die = d20 ?? roll();
  if (!Number.isInteger(die) || die < 1 || die > 20) throw new Error('d20 must be 1 to 20');
  const s = spellMap(b).get(x.spellId);
  const bonus = checkBonus(c);
  const out = gradeFinalCheck(die, bonus, s?.level ?? 0, x.banked, x.materials, rulesOf(b));
  x.attempts += 1;
  x.lastCheck = out.outcome;
  if (out.learned) {
    x.status = 'learned';
    if (!c.known.some((k) => k.id === x.spellId)) c.known.push({ id: x.spellId, how: 'learned' });
  } else {
    x.banked = out.banked;
    x.status = out.banked >= x.needed ? 'ready' : 'studying';
    x.waitLongRest = true;
  }
  log(c, { kind: out.learned ? 'learn' : 'study', note: `Final check for ${s?.name}: d20 ${die} + ${bonus} = ${out.total} vs DC ${out.dc}: ${out.outcome}` });
  return { ...out, d20: die, bonus, study: studyView(b, x) };
}

export function scrollCast(b: Book, c: Character, sid: string): Study {
  const x = findStudy(c, sid);
  if (!x.scrollHelp) throw new Error('This study has no scroll');
  const lose = x.status === 'learned' ? 0 : scrollRule(spellMap(b).get(x.spellId)?.level ?? 0, x.needed, rulesOf(b)).points;
  x.scrollHelp = false;
  x.banked = Math.max(0, x.banked - lose);
  if (x.status !== 'learned' && x.status !== 'stopped') x.status = x.banked >= x.needed ? 'ready' : 'studying';
  log(c, { kind: 'study', note: `Cast the scroll${lose ? `: ${lose} study points of its help are lost` : ''}` });
  return studyView(b, x);
}

export function stopStudy(b: Book, c: Character, sid: string): Study {
  const x = findStudy(c, sid);
  if (x.status === 'learned') throw new Error('Already learned');
  x.status = 'stopped';
  log(c, { kind: 'study', note: `Paused studying (${x.banked} of ${x.needed} points kept)` });
  return studyView(b, x);
}

export function quote(b: Book, c: Character, spellId: string, at?: number): CastQuote & { spell: Spell } {
  const s = spellMap(b).get(spellId);
  if (!s) throw new Error('Spell not found');
  if (!c.known.some((k) => k.id === spellId)) throw new Error(`${c.name} does not know ${s.name}`);
  const r = rulesOf(b);
  const lv = at ?? s.level;
  if (s.level > 0 && lv > highest(c)) throw new Error(`${c.name} casts spells of level ${highest(c)} or lower`);
  const max = poolMax(c, r);
  const q = quoteCast({ level: s.level, manaCost: s.manaCost ?? null }, lv, {
    mana: manaNow(c, r), max, characterLevel: c.level, leveledThisTurn: c.cast.turnLeveled, surgeUsed: c.cast.surgeUsed,
    echoCount: c.cast.echo[s.id] ?? 0, highUsed: c.cast.highUsed.includes(s.id),
  }, costsOf(b), r);
  return { ...q, spell: s };
}

export function cast(b: Book, c: Character, spellId: string, at?: number, silent = false): CastQuote & { spell: Spell } {
  if (silent && !c.abilities.silent) throw new Error('Silent casting is an ability the DM grants');
  const q = quote(b, c, spellId, at);
  if (!q.allowed) throw new Error(q.reasons.join('; '));
  const r = rulesOf(b);
  c.mana = q.manaAfter;
  if (q.spell.level > 0) {
    c.cast.turnLeveled += 1;
    if (q.surge) c.cast.surgeUsed = true;
    c.cast.echo[spellId] = (c.cast.echo[spellId] ?? 0) + 1;
    if (r.highLevelLimit.on && q.castLevel >= r.highLevelLimit.fromLevel && !c.cast.highUsed.includes(spellId)) c.cast.highUsed.push(spellId);
  }
  log(c, { kind: 'cast', amount: -q.cost, note: `${q.spell.name}${q.castLevel > q.spell.level ? ` at level ${q.castLevel}` : ''}${q.surge ? ' (surge)' : ''}${silent ? ' (silent)' : ''}` });
  return q;
}

export function newTurn(c: Character) { c.cast.turnLeveled = 0; }

export function rest(b: Book, c: Character, kind: 'short' | 'long') {
  const r = rulesOf(b);
  c.cast.turnLeveled = 0;
  c.cast.surgeUsed = false;
  c.cast.echo = {};
  if (kind === 'long') {
    c.cast.highUsed = [];
    c.mana = null;
    for (const x of c.studies) x.waitLongRest = false;
  }
  log(c, { kind: 'rest', note: kind === 'long' ? `Long rest: mana full (${poolMax(c, r)})` : 'Short rest' });
}

/** A change of mana with a reason (a potion, a feature), never above the pool. */
export function changeMana(b: Book, c: Character, o: { delta?: number; set?: number }, note: string) {
  const r = rulesOf(b);
  const max = poolMax(c, r);
  const cur = manaNow(c, r);
  const want = o.set !== undefined ? o.set : cur + (o.delta ?? 0);
  if (!Number.isFinite(want)) throw new Error('Enter a number');
  const next = Math.max(0, Math.min(max, Math.round(want)));
  c.mana = next === max ? null : next;
  log(c, { kind: 'mana', amount: next - cur, note: note.trim() || 'Changed by hand' });
  return next;
}

// ---- import and export -------------------------------------------------------------------------------------

/**
 * Bring in an Alexandria spell rules profile (format `alexandria-spell-rules`):
 * its spellRules and cost table, lines and recipes, by spell name. Names this
 * book has no spell for are listed back.
 */
export function importProfile(b: Book, raw: unknown): { lines: number; recipes: number; missing: string[] } {
  const p = (typeof raw === 'string' ? JSON.parse(raw) : raw) as any;
  if (!p || typeof p !== 'object') throw new Error('Not a profile');
  if (p.format && p.format !== 'alexandria-spell-rules') throw new Error(`This is a ${p.format} file, not a spell rules profile`);
  const byName = new Map(spells(b).map((s) => [s.name.toLowerCase(), s.id]));
  const ids = new Set(spells(b).map((s) => s.id));
  const missing: string[] = [];
  const find = (n: string) => { const v = ids.has(n) ? n : byName.get(String(n).toLowerCase()); if (!v) missing.push(String(n)); return v; };
  if (p.settings?.spellRules !== undefined) { checkSpellRules(p.settings.spellRules); }
  const recipes: Recipe[] = [];
  for (const rc of Array.isArray(p.recipes) ? p.recipes : []) {
    const result = find(rc.result);
    const prereqs = (Array.isArray(rc.prereqs) ? rc.prereqs : []).map(find).filter(Boolean) as string[];
    if (result && prereqs.length) recipes.push({ result, prereqs });
  }
  const lines: Line[] = (Array.isArray(p.lines) ? p.lines : []).map((l: any) => ({ name: String(l.name).slice(0, 40), spells: (Array.isArray(l.spells) ? l.spells : []).map(find).filter(Boolean) }));
  if (p.settings?.spellRules !== undefined) b.rules = p.settings.spellRules;
  if (Array.isArray(p.settings?.spellManaCosts) && p.settings.spellManaCosts.length === 10) b.costs = p.settings.spellManaCosts.map(Number);
  if (recipes.length) b.recipes = recipes;
  if (lines.length) b.lines = lines;
  return { lines: lines.length, recipes: recipes.length, missing: [...new Set(missing)] };
}

/** Spells from an Alexandria spell export or a plain list in the same format. */
export function importSpells(b: Book, raw: unknown): number {
  const p = (typeof raw === 'string' ? JSON.parse(raw) : raw) as any;
  const list = Array.isArray(p) ? p : Array.isArray(p?.spells) ? p.spells : null;
  if (!list) throw new Error('No spells in this file');
  let n = 0;
  for (const s of list) {
    if (!s || typeof s.name !== 'string' || !Number.isInteger(s.level) || s.level < 0 || s.level > 9) continue;
    const id = typeof s.id === 'string' && s.id ? s.id : `custom:${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const spell: Spell = { ...s, id, school: s.school || 'Others', classes: Array.isArray(s.classes) ? s.classes : [], damageTypes: Array.isArray(s.damageTypes) ? s.damageTypes : [] };
    b.extraSpells = [...b.extraSpells.filter((x) => x.id !== id), spell];
    n++;
  }
  return n;
}

/** Make sure a loaded book has every field (an older save, or a file from elsewhere). */
export function normalizeBook(raw: unknown): Book {
  const b = { ...emptyBook(), ...(raw && typeof raw === 'object' ? (raw as object) : {}) } as Book;
  b.characters = (Array.isArray(b.characters) ? b.characters : []).map((c) => ({ ...newCharacter(c?.name ?? ''), ...c, cast: { ...newCharacter('').cast, ...(c?.cast ?? {}) }, abilities: { ...{ silent: false, dual: false }, ...(c?.abilities ?? {}) } }));
  try { checkSpellRules(b.rules); } catch { b.rules = {}; }
  return b;
}
