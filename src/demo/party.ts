// The demo build's example party: three characters a table would recognise,
// each mid-campaign, so the tree, the study panel and the mana bar all have
// something to show on first launch. Built with the real model functions, so
// every number is what the rules give.
import { cast, newCharacter, startStudy, studyDaysLog, type Book, type Character } from '../local/model.ts';

const ids = (xs: string) => xs.split(' ').map((x) => ({ id: `srd:${x}`, how: 'learned' as const }));

function study(b: Book, c: Character, spell: string, source: 'alone' | 'text' | 'mentor', days: number) {
  let s;
  try { s = startStudy(b, c, `srd:${spell}`, { source, lab: false, scroll: false, arcana: 20 }); } catch { s = startStudy(b, c, `srd:${spell}`, { source, lab: false, scroll: false, anyway: true }); }
  if (days > 0) studyDaysLog(b, c, s.id, days);
}

export function demoParty(b: Book): Character[] {
  const lyra = newCharacter('Lyra Emberfall', { className: 'Wizard', level: 5, castingAbility: 'int', score: 18, casterLevels: { full: 5 } });
  lyra.known = ids('fire-bolt mage-hand prestidigitation light magic-missile shield detect-magic burning-hands mage-armor thunderwave scorching-ray misty-step shatter');
  study(b, lyra, 'fireball', 'text', 3);
  cast(b, lyra, 'srd:scorching-ray');
  lyra.cast.turnLeveled = 0;
  cast(b, lyra, 'srd:shield');
  lyra.cast.turnLeveled = 0;

  const oren = newCharacter('Brother Oren Stoneward', { className: 'Cleric', level: 5, castingAbility: 'wis', score: 16, casterLevels: { full: 5 } });
  oren.known = ids('sacred-flame guidance spare-the-dying thaumaturgy cure-wounds bless healing-word guiding-bolt shield-of-faith command spiritual-weapon aid lesser-restoration');
  cast(b, oren, 'srd:spiritual-weapon');
  oren.cast.turnLeveled = 0;
  cast(b, oren, 'srd:bless');
  oren.cast.turnLeveled = 0;

  const kael = newCharacter('Kael Brightwater', { className: 'Paladin', level: 6, castingAbility: 'cha', score: 16, casterLevels: { half: 6 } });
  kael.known = ids('bless cure-wounds shield-of-faith divine-favor command aid find-steed');
  kael.abilities.silent = true;
  // A paladin studying a bard and cleric spell: any class may, it just has no class discount.
  study(b, kael, 'calm-emotions', 'mentor', 1);

  return [lyra, oren, kael];
}
