// Mağaza öncesi denetim: node scripts/check-store.cjs
// Manifest, ikonlar, yerel dosyalar, kopya anahtar/sır taraması ve gereksiz dosya kontrolü yapar.
const fs = require('fs');
const path = require('path');
const ext = path.join(__dirname, '../extension');
let fail = 0;
const ok = (m) => console.log('  ✓', m);
const bad = (m) => { fail++; console.log('  ✗', m); };
const read = (p) => fs.readFileSync(path.join(ext, p), 'utf8');
const m = JSON.parse(read('manifest.json'));

// i18n çözümleme
const msgs = {};
for (const loc of fs.readdirSync(path.join(ext, '_locales'))) msgs[loc] = JSON.parse(read(`_locales/${loc}/messages.json`));
const resolve = (s, loc) => s.replace(/__MSG_(\w+)__/g, (_, k) => (msgs[loc][k] || {}).message || `<${k}?>`);

console.log('Manifest');
m.manifest_version === 3 ? ok('manifest_version 3') : bad('manifest_version 3 olmalı');
/^\d+(\.\d+){0,3}$/.test(m.version) ? ok('sürüm ' + m.version) : bad('geçersiz sürüm');
m.default_locale && msgs[m.default_locale] ? ok('default_locale ' + m.default_locale) : bad('default_locale eksik/geçersiz');
for (const loc of Object.keys(msgs)) {
  const name = resolve(m.name, loc), desc = resolve(m.description, loc);
  name.length <= 75 && !name.includes('?>') ? ok(`[${loc}] ad (${name.length}): ${name}`) : bad(`[${loc}] ad >75 veya eksik: ${name}`);
  desc.length <= 132 && !desc.includes('?>') ? ok(`[${loc}] açıklama ${desc.length}/132`) : bad(`[${loc}] açıklama ${desc.length} > 132 veya eksik`);
  if (/^youtube(?! için)/i.test(name)) bad(`[${loc}] ad "YouTube" ile başlıyor: marka ihlali riski, "... for YouTube" / "YouTube için ..." kullan`);
}
const baseKeys = Object.keys(msgs[m.default_locale] || {});
let keyDiffs = 0;
for (const loc of Object.keys(msgs)) {
  const have = new Set(Object.keys(msgs[loc]));
  const missing = baseKeys.filter((k) => !have.has(k));
  const extra = [...have].filter((k) => !baseKeys.includes(k));
  if (missing.length || extra.length) { keyDiffs++; bad(`[${loc}] eksik: ${missing.join(', ') || '-'} | fazla: ${extra.join(', ') || '-'}`); }
}
if (!keyDiffs) ok(`${Object.keys(msgs).length} dilin mesaj anahtarları aynı (${Object.keys(msgs).join(', ')})`);

console.log('İkonlar');
for (const s of [16, 32, 48, 128]) {
  const p = m.icons && m.icons[s];
  if (!p || !fs.existsSync(path.join(ext, p))) { bad(`icons[${s}] yok`); continue; }
  const b = fs.readFileSync(path.join(ext, p));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  w === s && h === s ? ok(`${p} ${w}x${h}`) : bad(`${p} boyutu ${w}x${h}, beklenen ${s}`);
}

console.log('Dosyalar');
const files = [...(m.content_scripts || []).flatMap((c) => [...(c.js || []), ...(c.css || [])]), m.background && m.background.service_worker, m.action && m.action.default_popup].filter(Boolean);
for (const f of new Set(files)) fs.existsSync(path.join(ext, f)) ? ok(f) : bad(`${f} manifestte var ama dosya yok`);
const all = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : all.push(p); } })(ext);
for (const f of all) if (/\.(map|log|tmp|bak|orig)$|\.DS_Store$/.test(f)) bad('gereksiz dosya: ' + path.relative(ext, f));
const big = all.filter((f) => fs.statSync(f).size > 1024 * 1024);
big.length ? big.forEach((f) => bad('1 MB üstü dosya: ' + path.relative(ext, f))) : ok(`${all.length} dosya, hepsi küçük`);

console.log('Gizli bilgi taraması');
const secret = /AIza[0-9A-Za-z_-]{20,}|gsk_[A-Za-z0-9]{20,}|AQ\.[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9]{20,}/;
let leaks = 0;
for (const f of all.filter((f) => /\.(js|json|html|css|md|svg)$/.test(f))) if (secret.test(fs.readFileSync(f, 'utf8'))) { bad('olası anahtar: ' + path.relative(ext, f)); leaks++; }
if (!leaks) ok('anahtar benzeri değer bulunmadı');

console.log('İzinler');
console.log('  izinler:', (m.permissions || []).join(', ') || '-', '| host:', (m.host_permissions || []).join(', ') || '-');
const known = new Set(['storage']);
(m.permissions || []).filter((p) => !known.has(p)).forEach((p) => bad('beklenmeyen izin: ' + p));
if (/<all_urls>|\*:\/\/\*\/\*/.test(JSON.stringify(m.host_permissions) + JSON.stringify(m.content_scripts))) bad('geniş host izni');

console.log(fail ? `\n${fail} sorun var` : '\nTüm denetimler geçti');
process.exit(fail ? 1 : 0);
