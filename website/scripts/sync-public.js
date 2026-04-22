/**
 * sync-public.js — runs as prebuild and can be run standalone
 * Copies all non-Next.js static app shells into BOTH public/ and dist/
 *
 * WHY BOTH:
 * - public/ feeds Next.js build, ensuring files land in dist/ on Cloudflare
 * - dist/  is committed to git, so it works even if Cloudflare skips the build
 *
 * PROTECTION RULE (enforced in Windsurf rules):
 * Only Claude may modify _onboard.html, _dashboard.html, admin/, functions/
 * This script must never be removed or bypassed.
 */
const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const SINGLE_FILES = [
  '_onboard.html',
  '_dashboard.html',
  'admin/index.html',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
  '404.html',
  '_headers',
  'previews/maciej-misnik/index.html',
  'previews/maciej-misnik/styles.css',
  'previews/maciej-misnik/script.js',
  'previews/maciej-misnik/robots.txt',
  'previews/maciej-misnik/assets/hero.png',
  'previews/maciej-misnik/assets/physicist.png',
  'previews/maciej-misnik/assets/chronometer.png',
];

let count = 0;

for (const file of SINGLE_FILES) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.warn('[sync-public] WARNING: source not found:', file);
    continue;
  }
  for (const destDir of ['public', 'dist']) {
    const dst = path.join(root, destDir, file);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  count++;
}

console.log('[sync-public] Synced', count, 'files to public/ and dist/');
