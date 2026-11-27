# Manaweave

A D&D 5e spell tree with mana, studying and learning spells. It runs on its
own (install it on a phone or desktop; it works offline and keeps characters
on the device) or signs in to an [Alexandria](https://github.com/Wizard815/alexandria)
world and shows that world's tree.

## What it does

- **The tree.** Every spell as a web around the character: a region per
  school of magic, cantrips nearest the middle and higher levels farther out.
  Early spells link into the schools next to them, and spells that share an
  element (fire, cold...) are tied with a line in that element's colour. Each
  spell shows an icon for its element, or its school when it has none ("What
  the icons mean" under the legend). Known spells glow gold, ones the
  character can study now are white, locked ones are dim, and unknown ones
  show no icon or name. The top bar shows the character's level, mana, the
  highest spell level they can cast, their casting score, check bonus and
  known spells.
- **Learning a spell.** Pick a spell to see what it still needs and how long
  it takes. Each 8-hour downtime day earns 1 to 3 study points: 1 alone, 2
  with a text, 3 with a mentor (a lab adds 1). Any class can study any
  spell; a spell on your own class list needs 25% fewer points. For a 3rd-level
  spell off your class list:

  | How | Days | Gold |
  |---|---|---|
  | Alone | 13 | 250 |
  | With a text | 7 | 250 |
  | With a mentor | 5 | 500 |

  When the points are in, roll the final check (d20 + casting modifier +
  proficiency). A failure keeps the points; try again after a long rest.
- **Scrolls.** A scroll is used once. Studying with one adds a quarter of the
  points and the scroll is kept, so it can still be cast later. Casting it
  first loses that help.
- **Mana.** Pools by caster level (full, half, third and multiclass), casting
  with upcasting, one leveled spell per turn with a surge cast, echo strain,
  the high-level limit, overchannel and low mana. Short and long rests. Mana
  changes (a potion) are logged and never go above the pool. Silent casting
  and dual cast are abilities the DM grants.
- **Rules.** The defaults are the MANA plan's numbers. Change any of them in
  Settings (the same `spellRules` JSON an Alexandria world uses), or import a
  DM's Alexandria spell rules profile with its recipes and lines.

## Spell requirements

Every spell has requirements. With no recipe, a spell is taught by its
school: the character must know spells of the same school or element (one
level lower for a leveled spell), be able to cast its level, and pass an
Arcana check for the higher levels. A recipe names the exact spells, 1 to 5,
that teach a spell instead.

To change a spell's requirements: open it on the tree and press **Edit
requirements**, or go to Settings → Spell requirements. Type the spell, add
the spells that teach it, and save. **Use its school** goes back to the
default. A DM can also bring a whole set of recipes from Alexandria with
Settings → Import an Alexandria profile.

## Try it

**Random character** (on the Character page or in the character menu) makes
a character with a class, a level from 1 to 20, a casting score and spells
from its class list. Change any of it on the Character page. A demo build
(`VITE_DEMO=1 npx vite build --outDir dist-demo`) starts with one already
made.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/, a static site
npm test           # the rules and the study flow
node test/e2e.mjs  # after a build; needs Playwright
```

`dist/` runs from any static host. `.github/workflows/pages.yml` publishes it
to GitHub Pages from main (Settings → Pages → Source: GitHub Actions).

## With Alexandria

Settings → Connect to Alexandria: the server address, your username and
password, then a world. The server must allow this app's address in
`ALX_CORS_ORIGINS` (for GitHub Pages: `https://wizard815.github.io`).

The tree view (`src/tree/`) is shared: Alexandria's Codex uses the same files.
The rules engine (`src/engine/rules.ts`) comes from Alexandria.
`scripts/sync-alexandria.sh ../alexandria` copies the tree there and the
engine here.

## License

Code: MIT. Spells: System Reference Document 5.2.1 by Wizards of the Coast
LLC, CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode).

## Demo for your table

`node scripts/build-demo.mjs` builds a demo as one HTML file (`dist-demo/manaweave-demo.html`, opens from a download) with an example
party mid-campaign: Lyra (wizard 5, studying Fireball), Brother Oren (cleric 5)
and Kael (paladin 6, studying Calm Emotions). A popup explains the app on first
launch, and the **Ask** button opens a helper that answers questions about
spells, study, mana and the rules. It searches the spell list and the app's own
numbers, with no AI model.
