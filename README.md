# Spell Tree

A D&D 5e spell tree with mana, studying and learning spells. It runs on its
own (install it on a phone or desktop; it works offline and keeps characters
on the device) or signs in to an [Alexandria](https://github.com/Wizard815/alexandria)
world and shows that world's tree.

## What it does

- **The tree.** Every spell, grouped by school of magic. Spells that mix two
  elements (Fire and Cold, Acid and Poison...) sit in their own groups after
  the schools; spells without a school go under Others. Spells start dark. A
  spell the character can study turns grey; known spells light up in their
  school's color.
- **Learning a spell.** Pick a spell to see what it still needs and how long
  it takes. Each 8-hour downtime day earns 1 to 3 study points: 1 alone, 2
  with a text, 3 with a mentor (a lab adds 1). For a 3rd-level spell:

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

Without recipes, a spell is taught by its school: the tier gate counts known
spells of the same school or element.

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
