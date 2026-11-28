# Licensing in plain English

Manaweave's code is under the [PolyForm Shield License 1.0.0](LICENSE). This
page explains what that means for you. It is a summary, not legal advice, and
the license text is what applies if the two ever disagree.

Shield is a *source-available* license. The code is public and free, but it is
not "open source" in the official OSI sense, because it limits one kind of use:
competing with Manaweave or Alexandria.

## What you can do, free

- Read, download, build and run Manaweave, on the web, as an installed app or
  from the demo file.
- Use it for your own characters, your table, your friends or your club.
- Use it while you run games, including games where players pay you.
- Change it, fix it and share your changes back with a pull request.
- Make spell books, recipes and rule sets for it, and share them.
- Use pieces of it inside your own project, as long as that project doesn't
  compete with Manaweave or Alexandria.

## What needs permission

- Selling Manaweave, or a copy or fork of it, including in an app store.
- Offering it, or a fork of it, as a hosted service or app for other people to
  sign up to, whether you charge for it or not.
- Publishing a fork that is marketed as a substitute for Manaweave or
  Alexandria.

Only the maker can do these, or someone the maker has said yes to in writing.
To ask, open an issue on GitHub titled "License request" and say what you want
to do.

## "What if I rewrite it completely?"

The license covers Manaweave's code and things made from it. If you start from
this code, the license follows your changes, however large. If you build your
own app from scratch that does similar things, the license doesn't apply to
it: features, ideas and game rules can't be owned.

## Shared with Alexandria

The rules engine (`src/engine/`) and the tree view (`src/tree/`) are the same
files that [Alexandria](https://github.com/Wizard815/alexandria) uses, by the
same maker and under the same license.

## The name

"Manaweave" as the name of this app belongs to its maker. A fork must use a
different name and must not suggest it is the official Manaweave. Manaweave is
not affiliated with Wizards of the Coast.

## Spell data

The 339 spells in `src/data/srd-5.2.1-spells.json`, with their text, come from
the System Reference Document 5.2.1 by Wizards of the Coast LLC, under
CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode). That file
keeps its own license, and the Shield license does not limit it. Other
official spells (`src/data/official-spells.json`) are listed by facts only
(name, level, school, classes, book), with no rules text.

## Third-party software

Manaweave uses open source packages from npm (React, Vite and their
dependencies). Each keeps its own license; the Shield license covers only
Manaweave's own code. Every package is under a permissive license (MIT,
Apache-2.0, BSD, ISC, 0BSD) or, for the build-only CSS tool lightningcss, a
file-level one (MPL-2.0, used unmodified). None is GPL, AGPL, share-alike or
noncommercial.

## Contributing

Pull requests are welcome. Because the maker may sell Manaweave or offer it as
a paid service, by opening a pull request you agree that the maker may use,
change and relicense your contribution as part of Manaweave and Alexandria,
including commercially. You keep the copyright in your own work.
