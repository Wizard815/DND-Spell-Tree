// The demo's helper: answers a table question by searching the spell list, the
// active character and the rules. No AI model: it reads the question for a
// spell name and a few kinds of ask (learn, cost, what can I learn, rules) and
// answers from the same functions the app uses, so the numbers always match.
import { upcastCost } from '../engine/rules.ts';
import { costsOf, highest, manaNow, poolMax, quote, rulesOf, spells, studyPlan, tree, type Book, type Character, type Spell } from '../local/model.ts';

export interface Answer { text: string; spells?: string[] }

const lv = (n: number) => (n === 0 ? 'cantrip' : `level ${n}`);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

/** The rules, in short, for questions that name no spell. */
const RULES: { keys: RegExp; text: string }[] = [
  { keys: /\b(mana|pool|slots?)\b/, text: 'Mana replaces spell slots. Your pool holds what your slots would be worth (a level 5 full caster has 27). A spell costs its level\'s mana (1st 2, 2nd 3, 3rd 5, 4th 6, 5th 7 …), +1 for each level you upcast. A long rest refills it.' },
  { keys: /\b(stud(y|ying)|learn(ing)?|points?)\b/, text: 'Learning a spell takes study. Each 8-hour downtime day earns 1 point alone, 2 with a text, 3 with a mentor (+1 in a lab). A 3rd-level spell needs 13 points: 13 days alone, 7 with a text, 5 with a mentor. Spells on your own class list need 25% fewer points. Then a final check: d20 + casting modifier + proficiency.' },
  { keys: /\b(final|check|fail(ed)?|dc)\b/, text: 'When the points are in you roll the final check: d20 + your casting modifier + proficiency against the spell\'s DC (13 for a 2nd-level spell, 15 for a 3rd). Fail and you try again after a long rest.' },
  { keys: /\bscrolls?\b/, text: 'A scroll is a study aid: studying from it adds points and you keep it. Casting the scroll uses it up, and the study help with it.' },
  { keys: /\b(tree|dark|grey|gray|locked|unknown)\b/, text: 'Every spell is on the tree, by school. Lit gold: you know it. Grey: you can start studying it. Dim: you need other spells first. Dark: out of reach for now (too high a level, or nothing you know leads there).' },
  { keys: /\b(class|classes|other class|cross)\b/, text: 'Any class can learn any spell. One on your own class list needs 25% fewer study points; there is no penalty for the rest.' },
  { keys: /\b(rest|downtime|travel)\b/, text: 'A long rest refills mana and lets a failed final check be rolled again. Study only happens on downtime days (8 hours each), not on travel or adventure days.' },
  { keys: /\b(repeat|echo|same spell)\b/, text: 'Casting the same leveled spell again before a short rest costs 1 more mana each time. Spells of 6th level and up: once each per long rest.' },
  { keys: /\b(silent|quiet)\b/, text: 'Silent casting is an ability the DM grants a character: no extra mana.' },
];

function findSpells(b: Book, q: string): Spell[] {
  const low = ` ${q.toLowerCase().replace(/[^a-z0-9' /]/g, ' ')} `;
  // Longest names first, so "Cure Wounds" beats "Wounds" and "Mass Cure Wounds" beats both.
  const all = [...spells(b)].sort((a, z) => z.name.length - a.name.length);
  const hit: Spell[] = [];
  let rest = low;
  for (const s of all) {
    const n = s.name.toLowerCase();
    if (rest.includes(` ${n} `) || rest.includes(` ${n}'`) || rest.includes(` ${n}?`)) { hit.push(s); rest = rest.replace(n, ' '); }
    if (hit.length >= 3) break;
  }
  return hit;
}

function searchSpells(b: Book, q: string): Spell[] {
  const ws = words(q).filter((w) => !['what', 'which', 'spell', 'spells', 'that', 'does', 'with', 'can', 'the', 'and', 'for', 'any', 'have', 'there'].includes(w));
  if (!ws.length) return [];
  const scored = spells(b).map((s) => {
    const hay = `${s.name} ${s.school} ${(s.damageTypes ?? []).join(" ")} ${s.text ?? ""}`.toLowerCase();
    const name = s.name.toLowerCase();
    let k = 0;
    for (const w of ws) { if (name.includes(w)) k += 5; else if (hay.includes(w)) k += 1; }
    return { s, k };
  }).filter((x) => x.k > 0).sort((a, z) => z.k - a.k || a.s.level - z.s.level);
  return scored.slice(0, 5).map((x) => x.s);
}

function spellLine(b: Book, c: Character | null, s: Spell): string {
  const cost = s.level ? upcastCost(s.level, s.level, costsOf(b), rulesOf(b), s.manaCost ?? null) : 0;
  const text = (s.text ?? '').replace(/\s+/g, ' ');
  return `${s.name}: ${lv(s.level)} ${s.school}, ${s.castingTime}, ${s.range}${s.concentration ? ', concentration' : ''}. ${s.level ? `Costs ${cost} mana.` : 'Cantrip: free.'} Lists: ${(s.classes ?? []).join(', ') || 'none'}. ${text.slice(0, 260)}${text.length > 260 ? '…' : ''}${c && c.known.some((k) => k.id === s.id) ? ` ${c.name.split(' ')[0]} knows it.` : ''}`;
}

export function answer(b: Book, c: Character | null, q: string): Answer {
  const text = q.trim();
  if (!text) return { text: 'Ask about a spell ("What does Fireball do?"), learning ("How long to learn Counterspell?"), your mana, or the rules.' };
  const low = text.toLowerCase();
  const named = findSpells(b, text);
  const who = c ? c.name.split(' ')[0] : 'you';
  const r = rulesOf(b);

  if (c && /\b(what|which)\b.*\b(can|could)\b.*\b(learn|study)\b|\bopen to learn\b/.test(low) && !named.length) {
    const t = tree(b, c);
    const open = [...t.schools.flatMap((g) => g.spells), ...t.hybrids].filter((s) => s.status === 'learn').sort((a, z) => z.level - a.level);
    if (!open.length) return { text: `${who} can't start studying any spell right now.` };
    return { text: `${who} can start studying ${open.length} spells now. The highest: ${open.slice(0, 8).map((s) => `${s.name} (${lv(s.level)})`).join(', ')}. Grey spells on the tree are these.`, spells: open.slice(0, 8).map((s) => s.id) };
  }
  if (c && !named.length && /\b(my|our|i)\b.*\b(mana|pool)\b|\bhighest\b|\bhow much mana\b/.test(low)) {
    return { text: `${c.name} has ${manaNow(c, r)} of ${poolMax(c, r)} mana and casts spells up to ${highest(c) ? `level ${highest(c)}` : 'cantrips only'}. A long rest refills it.` };
  }
  if (named.length) {
    const s = named[0];
    if (c && /\b(learn|study|studying|how long|days|gold|cost to learn|need)\b/.test(low)) {
      if (c.known.some((k) => k.id === s.id)) return { text: `${who} already knows ${s.name}.`, spells: [s.id] };
      const p = studyPlan(b, c, s.id, 'text');
      const own = (s.classes ?? []).some((x) => c.className.toLowerCase().includes(x.toLowerCase()));
      return {
        text: `${s.name} (${lv(s.level)}) for ${who}: ${p.needed} study points${own ? ` (25% off: it's on the ${c.className} list)` : ''}. Alone ${p.days.alone ?? '–'} days / ${p.gold?.alone ?? '–'} gp, with a text ${p.days.text ?? '–'} days / ${p.gold?.text ?? '–'} gp, with a mentor ${p.days.mentor ?? '–'} days / ${p.gold?.mentor ?? '–'} gp. Final check DC ${p.finalDC} (d20 + ${p.checkBonus}).${p.arcanaDC !== null ? ` Starting needs an Arcana check, DC ${p.arcanaDC}.` : ''}${p.missing.length ? ` Not yet: ${p.missing.join('; ')}.` : ' They can start it now.'}`,
        spells: [s.id],
      };
    }
    if (c && /\b(cost|mana|cast|upcast)\b/.test(low) && s.level > 0) {
      const at = Number((low.match(/(?:level|lvl|at)\s*(\d)/) ?? [])[1]) || s.level;
      if (c.known.some((k) => k.id === s.id)) {
        try {
          const q2 = quote(b, c, s.id, Math.max(s.level, at));
          return { text: `${s.name} at level ${q2.castLevel} costs ${who} ${q2.cost} mana (${q2.breakdown.map((x) => `${x.what}: ${x.mana}`).join(', ')}).${q2.allowed ? ` Leaves ${q2.manaAfter}.` : ` Not now: ${q2.reasons.join('; ')}.`}`, spells: [s.id] };
        } catch (e) { return { text: (e as Error).message, spells: [s.id] }; }
      }
      return { text: `${s.name} at level ${Math.max(s.level, at)} costs ${upcastCost(s.level, Math.max(s.level, at), costsOf(b), r, s.manaCost ?? null)} mana. ${who} doesn't know it yet.`, spells: [s.id] };
    }
    return { text: named.map((x) => spellLine(b, c, x)).join('\n\n'), spells: named.map((x) => x.id) };
  }
  const rule = RULES.find((x) => x.keys.test(low));
  if (rule) return { text: rule.text };
  const found = searchSpells(b, text);
  if (found.length) return { text: `Spells that match: ${found.map((s) => `${s.name} (${lv(s.level)} ${s.school})`).join(', ')}. Ask about one by name for the details.`, spells: found.map((s) => s.id) };
  return { text: 'I search the spell list and the rules, so I can\'t answer that one. Try a spell name, "what can I learn", "how much mana", or "how does study work".' };
}
