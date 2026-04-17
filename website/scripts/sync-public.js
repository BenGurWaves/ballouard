/**
 * sync-public.js — runs as prebuild
 * Copies all non-Next.js static app shells into public/
 * so they land in dist/ after next build.
 *
 * RULE: Only Claude (or an AI with explicit permission) modifies
 * _onboard.html, _dashboard.html, admin/, functions/
 * This script must not be removed or altered by other processes.
 */
const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const COPIES = [
  ['_onboard.html',   'public/_onboard.html'],
  ['_dashboard.html', 'public/_dashboard.html'],
  ['admin/index.html','public/admin/index.html'],
  ['favicon.svg',     'public/favicon.svg'],
  ['robots.txt',      'public/robots.txt'],
  ['sitemap.xml',     'public/sitemap.xml'],
  ['404.html',        'public/404.html'],
  ['_headers',        'public/_headers'],
];

let count = 0;
for (const [src, dst] of COPIES) {
  const srcPath = path.join(root, src);
  const dstPath = path.join(root, dst);
  if (fs.existsSync(srcPath)) {
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
    count++;
  } else {
    console.warn('[sync-public] WARNING: source not found:', src);
  }
}
console.log('[sync-public] Synced', count, 'files to public/');
