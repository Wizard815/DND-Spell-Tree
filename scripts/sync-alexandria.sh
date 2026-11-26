#!/usr/bin/env bash
# Copy the tree view into an Alexandria checkout, and the rules engine back
# from it. Alexandria owns rules.ts; this app owns src/tree.
#   scripts/sync-alexandria.sh ../alexandria
set -euo pipefail
alx="${1:?path to the alexandria checkout}"
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="$alx/web/src/features/spells/tree"
mkdir -p "$dest"
for f in types.ts treeCss.ts icons.tsx TreeGraph.tsx SpellTree.tsx; do
  { echo "// Copied from Wizard815/DND-Spell-Tree src/tree/$f by scripts/sync-alexandria.sh: change it there."; cat "$here/src/tree/$f"; } > "$dest/$f"
done
cp "$alx/librarian/src/features/spells/rules.ts" "$here/src/engine/rules.ts"
echo "Synced the tree into $dest and rules.ts into src/engine."
