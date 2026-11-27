// Builds the demo as one self-contained HTML file (dist-demo/manaweave-demo.html):
// the script, styles and icon inlined, so it opens from a download or a file share.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
execSync('npx vite build --outDir dist-demo --sourcemap false --emptyOutDir', { stdio: 'inherit', env: { ...process.env, VITE_DEMO: '1' } });
const dir = 'dist-demo';
let h = fs.readFileSync(`${dir}/index.html`, 'utf8');
const js = h.match(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/);
const css = h.match(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/);
const icon = `data:image/svg+xml;base64,${fs.readFileSync(`${dir}/icon.svg`).toString('base64')}`;
h = h.replace(js[0], '').replace(css[0], () => `<style>${fs.readFileSync(`${dir}/${css[1]}`, 'utf8')}</style>`)
  .replace(/\s*<link rel="manifest"[^>]*>/, '').replaceAll('href="./icon.svg"', `href="${icon}"`)
  .replace('</body>', () => `<script type="module">${fs.readFileSync(`${dir}/${js[1]}`, 'utf8').replaceAll('</script', '<\\/script')}</script>\n</body>`);
fs.writeFileSync(`${dir}/manaweave-demo.html`, h);
console.log(`${dir}/manaweave-demo.html: ${(h.length / 1024).toFixed(0)} KB`);
