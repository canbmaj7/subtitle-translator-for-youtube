// Firefox paketi: node scripts/build-firefox.cjs -> dist/subtitle-translator-<sürüm>-firefox.zip
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const out = path.join(root, 'dist', 'firefox');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'extension'), out, { recursive: true, filter: (s) => !s.endsWith('icon.svg') });
const mp = path.join(out, 'manifest.json');
const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
delete m.minimum_chrome_version;
m.background = { scripts: ['background.js'] }; // Firefox MV3: service_worker yerine event page
m.browser_specific_settings = {
  gecko: {
    id: 'subtitle-translator@canbmaj7.github.io',
    strict_min_version: '140.0', // world:"MAIN" içerik betiği (128+) ve data_collection_permissions (140+)
    data_collection_permissions: { required: ['websiteContent'] },
  },
};
fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
const zip = path.join(root, 'dist', `subtitle-translator-${m.version}-firefox.zip`);
fs.rmSync(zip, { force: true });
execFileSync('python3', ['-c', `
import os, sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    for r, _, fs in os.walk(src):
        for f in sorted(fs):
            p = os.path.join(r, f); z.write(p, os.path.relpath(p, src))
`, out, zip]);
console.log('Firefox paketi:', path.relative(root, zip));
