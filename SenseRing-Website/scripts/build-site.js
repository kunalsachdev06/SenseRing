'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const publicFiles = ['index.html', 'gesture-ring-style.css', 'gesture-ring-script.js', 'sense-ring-core.js', 'product-state.js', 'companion-state.js', 'theme.js', 'ring-visual.js', 'android-section.css', 'android-experience.js'];
async function build() {
  const out = path.join(root, 'dist');
  if (path.relative(root, path.resolve(out)) !== 'dist') throw new Error('Unexpected build output path');
  // dist is generated output. Clear it so a previous build cannot leave private files published.
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });
  for (const file of publicFiles) await fs.copyFile(path.join(root, file), path.join(out, file));
  for (const folder of ['assets', 'downloads']) await fs.cp(path.join(root, folder), path.join(out, folder), { recursive: true });
  console.log('Static website built in dist/. The companion is a download; its server runs locally.');
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
