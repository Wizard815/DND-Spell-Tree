import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cast, changeMana, emptyBook, finalCheck, importProfile, newCharacter, rest, scrollCast, spells, startStudy, stopStudy, studyDaysLog, studyPlan, tree } from '../src/local/model.ts';

const wizard = () => newCharacter('Mira', { level: 5, casterLevels: { full: 5 }, score: 16, castingAbility: 'int' });

test('Model: the SRD ships, every spell is on the tree, a new character sees cantrips to learn', () => {
  const b = emptyBook();
  assert.equal(spells(b).length, 339);
  const c = wizard();
  const t = tree(b, c);
  const all = [...t.schools.flatMap((g) => g.spells), ...t.hybrids];
  assert.equal(all.length, 339);
  assert.ok(t.schools.some((g) => g.name === 'Evocation'));
  assert.ok(t.hybrids.length > 0, 'spells with two elements sit apart');
  assert.equal(all.find((s) => s.id === 'srd:fire-bolt')!.status, 'learn', 'cantrips have no gate');
  assert.equal(all.find((s) => s.id === 'srd:wish')!.status, 'dark', 'far above what she can cast');
});

test('Model: the study table for a 3rd-level spell is 13 / 7 / 5 days, 250 / 250 / 500 gold', () => {
  const b = emptyBook();
  const c = wizard();
  c.known.push({ id: 'srd:scorching-ray', how: 'learned' }, { id: 'srd:shatter', how: 'learned' });
  const p = studyPlan(b, c, 'srd:fireball', 'text');
  assert.deepEqual(p.missing, []);
  assert.deepEqual([p.days, p.gold, p.needed, p.finalDC, p.checkBonus], [{ alone: 13, text: 7, mentor: 5 }, { alone: 250, text: 250, mentor: 500 }, 13, 15, 6]);
  // Any class may study it; on their own class list it earns a point a day more (learning.classBonus).
  const own = { ...c, className: 'Wizard' };
  assert.deepEqual(studyPlan(b, own, 'srd:fireball', 'text').days, { alone: 7, text: 5, mentor: 4 });
  assert.deepEqual(studyPlan(b, { ...c, className: 'Cleric' }, 'srd:fireball', 'text').days, { alone: 13, text: 7, mentor: 5 }, 'no penalty off the list');
  const none = studyPlan(b, wizard(), 'srd:fireball');
  assert.match(none.missing.join(), /know 2 spells of its school or lines one level lower \(knows 0\)/);
});

test('Model: study, fail, long rest, learn; the scroll; pause and resume', () => {
  const b = emptyBook();
  const c = wizard();
  c.known.push({ id: 'srd:scorching-ray', how: 'learned' }, { id: 'srd:shatter', how: 'learned' });
  let s = startStudy(b, c, 'srd:fireball', { source: 'text', lab: false, scroll: false });
  assert.deepEqual([s.banked, s.daysLeft], [0, 7]);
  s = studyDaysLog(b, c, s.id, 7);
  assert.equal(s.status, 'ready');
  const fail = finalCheck(b, c, s.id, 2);
  assert.deepEqual([fail.outcome, fail.study.banked, fail.study.waitLongRest], ['fail', 13, true]);
  assert.throws(() => finalCheck(b, c, s.id, 20), /after a long rest/);
  rest(b, c, 'long');
  const ok = finalCheck(b, c, s.id, 12);
  assert.equal(ok.learned, true);
  assert.ok(c.known.some((k) => k.id === 'srd:fireball'));
  assert.equal(tree(b, c).schools.find((g) => g.name === 'Evocation')!.spells.find((x) => x.id === 'srd:fireball')!.status, 'known');
  // A scroll: a quarter of the points, lost if cast first.
  c.known.push({ id: 'srd:misty-step', how: 'gift' });
  const sc = startStudy(b, c, 'srd:lightning-bolt', { source: 'alone', lab: false, scroll: true });
  assert.equal(sc.banked, 3);
  assert.equal(scrollCast(b, c, sc.id).banked, 0);
  studyDaysLog(b, c, sc.id, 2);
  assert.equal(stopStudy(b, c, sc.id).status, 'stopped');
  const again = startStudy(b, c, 'srd:lightning-bolt', { source: 'mentor', lab: false, scroll: false });
  assert.deepEqual([again.id, again.banked, again.status], [sc.id, 2, 'studying']);
});

test('Model: casting spends mana with the limits, silent casting needs the ability, mana changes are capped', () => {
  const b = emptyBook();
  const c = wizard();
  c.known.push({ id: 'srd:fireball', how: 'learned' });
  assert.equal(cast(b, c, 'srd:fireball').manaAfter, 22);
  assert.equal(cast(b, c, 'srd:fireball').surge, true, 'the second leveled spell this turn is a surge');
  assert.throws(() => cast(b, c, 'srd:fireball', undefined, true), /Silent casting/);
  rest(b, c, 'short');
  c.abilities.silent = true;
  assert.equal(cast(b, c, 'srd:fireball', undefined, true).cost, 5, 'a short rest clears echo strain; silent costs nothing extra');
  assert.equal(changeMana(b, c, { delta: 100 }, 'Potion'), 27);
  assert.equal(c.log[0].note, 'Potion');
});

test('Model: an Alexandria profile brings its recipes and lines by name', () => {
  const b = emptyBook();
  const r = importProfile(b, { format: 'alexandria-spell-rules', settings: { spellRules: { upcastSurcharge: 0 } }, lines: [{ name: 'Fire', spells: ['Fire Bolt', 'Fireball', 'Nope'] }], recipes: [{ result: 'Fireball', prereqs: ['Fire Bolt', 'Burning Hands'] }] });
  assert.deepEqual(r, { lines: 1, recipes: 1, missing: ['Nope'] });
  const p = studyPlan(b, wizard(), 'srd:fireball');
  assert.deepEqual(p.recipe!.prereqs, ['Fire Bolt', 'Burning Hands']);
  assert.ok(p.missing.includes('know Fire Bolt'));
});
