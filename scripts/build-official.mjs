// Turns scripts/data/official-spells.txt (facts only: name, level, school,
// classes, book) into src/data/official-spells.json, in the SRD file's spell
// shape with no rules text. Spells already in the SRD are left out.
import fs from 'node:fs';
const SCHOOL = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation' };
const CLASS = { A: 'Artificer', B: 'Bard', C: 'Cleric', D: 'Druid', P: 'Paladin', R: 'Ranger', S: 'Sorcerer', K: 'Warlock', W: 'Wizard' };
export const BOOKS = {
  PHB: "Player's Handbook (2014)", PHB24: "Player's Handbook (2024)", XGE: "Xanathar's Guide to Everything", TCE: "Tasha's Cauldron of Everything",
  FTD: "Fizban's Treasury of Dragons", EGW: 'Explorer\'s Guide to Wildemount', SCC: 'Strixhaven: A Curriculum of Chaos', AI: 'Acquisitions Incorporated',
  AAG: 'Spelljammer: Adventures in Space', BMT: 'The Book of Many Things',
};
const srd = JSON.parse(fs.readFileSync('src/data/srd-5.2.1-spells.json', 'utf8'));
const have = new Set(srd.spells.map((s) => s.name.toLowerCase()));
const slug = (n) => n.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const spells = [];
const seen = new Set();
for (const raw of fs.readFileSync('scripts/data/official-spells.txt', 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [name, level, school, classes, book, damage, flags = ''] = line.split('|').map((x) => x.trim());
  if (!SCHOOL[school] || !BOOKS[book] || !/^\d$/.test(level)) throw new Error(`Bad line: ${line}`);
  if (have.has(name.toLowerCase()) || seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  spells.push({
    id: `book:${slug(name)}`, name, level: Number(level), school: SCHOOL[school], classes: classes.split(',').map((c) => { if (!CLASS[c]) throw new Error(`Bad class ${c} in ${line}`); return CLASS[c]; }),
    castingTime: flags.includes('b') ? 'Bonus Action' : flags.includes('x') ? 'Reaction' : 'Action', ritual: flags.includes('r'), range: '', components: { v: false, s: false, m: false }, material: '', materialCost: false, materialConsumed: false,
    duration: '', concentration: flags.includes('c'), damageTypes: damage ? damage.split(',') : [], saves: [], attack: '', text: '', source: book, book: BOOKS[book],
  });
}
const out = { id: 'official-books', name: 'Official D&D books (facts only)', note: 'Name, level, school, class lists and book only. The description is in the book.', books: BOOKS, spells };
fs.writeFileSync('src/data/official-spells.json', JSON.stringify(out));
console.log(`${spells.length} spells from ${Object.keys(BOOKS).length} books (${srd.spells.length} SRD, ${srd.spells.length + spells.length} in all)`);
