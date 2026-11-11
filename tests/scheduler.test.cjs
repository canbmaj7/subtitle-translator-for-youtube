const assert = require('assert');
const path = require('path');

globalThis.YTR = {};
require(path.join(__dirname, '../extension/scheduler.js'));
const { createScheduler } = globalThis.YTR;

(async () => {
  // 1) 60 cümlelik senaryo: Chunk'lar arası bağlam (before <= 4, after <= 2)
  const sentences = [];
  for (let i = 0; i < 60; i++) {
    sentences.push({ s: i * 1000, e: (i + 1) * 1000, text: `Sentence ${i}` });
  }

  const calls = [];
  let doneResolver;
  const allDone = new Promise((resolve) => { doneResolver = resolve; });

  const sched = createScheduler({
    sentences,
    sl: 'en',
    target: 'tr',
    gen: 1,
    getPlayheadMs: () => 0,
    send: async (lines, ctx) => {
      calls.push({ lines, ctx });
      return { ok: true, res: lines.map((l) => 'TR: ' + l) };
    },
    onProgress: (p) => {
      if (p.done === p.total && p.total > 0) doneResolver();
    },
  });

  await allDone;
  sched.stop();

  assert.equal(calls.length, 3, '60 cümle 25+25+10 olarak 3 chunk olmalı');

  // İlk chunk (0..24): before boş, after ilk 2 cümle (25, 26)
  assert.equal(calls[0].lines.length, 25);
  assert.equal(calls[0].lines[0], 'Sentence 0');
  assert.equal(calls[0].lines[24], 'Sentence 24');
  assert.deepEqual(calls[0].ctx.before, [], 'İlk chunk için before boş olmalı');
  assert.deepEqual(calls[0].ctx.after, ['Sentence 25', 'Sentence 26'], 'İlk chunk için after sonraki 2 cümle olmalı');

  // Orta chunk (25..49): before son 4 cümle (21..24), after ilk 2 cümle (50, 51)
  assert.equal(calls[1].lines.length, 25);
  assert.equal(calls[1].lines[0], 'Sentence 25');
  assert.equal(calls[1].lines[24], 'Sentence 49');
  assert.deepEqual(calls[1].ctx.before, [
    'Sentence 21', 'Sentence 22', 'Sentence 23', 'Sentence 24',
  ], 'Orta chunk için before önceki en fazla 4 cümle olmalı');
  assert.deepEqual(calls[1].ctx.after, [
    'Sentence 50', 'Sentence 51',
  ], 'Orta chunk için after sonraki en fazla 2 cümle olmalı');

  // Son chunk (50..59): before son 4 cümle (46..49), after boş
  assert.equal(calls[2].lines.length, 10);
  assert.equal(calls[2].lines[0], 'Sentence 50');
  assert.equal(calls[2].lines[9], 'Sentence 59');
  assert.deepEqual(calls[2].ctx.before, [
    'Sentence 46', 'Sentence 47', 'Sentence 48', 'Sentence 49',
  ], 'Son chunk için before önceki en fazla 4 cümle olmalı');
  assert.deepEqual(calls[2].ctx.after, [], 'Son chunk için after boş olmalı');

  // 2) Geriye uyumluluk: send fonksiyonu yalnızca tek parametre (lines) beklese de sorunsuz çalışır
  let compatDone;
  const compatDonePromise = new Promise((resolve) => { compatDone = resolve; });
  const compatCalls = [];
  const sched2 = createScheduler({
    sentences: [{ s: 0, e: 1000, text: 'Hello' }],
    sl: 'en',
    target: 'tr',
    gen: 1,
    getPlayheadMs: () => 0,
    send: async (lines) => {
      compatCalls.push(lines);
      return { ok: true, res: ['Merhaba'] };
    },
    onProgress: (p) => {
      if (p.done === p.total) compatDone();
    },
  });

  await compatDonePromise;
  sched2.stop();

  assert.equal(compatCalls.length, 1);
  assert.deepEqual(compatCalls[0], ['Hello']);

  // 3) Boş cümle listesi
  const emptySched = createScheduler({
    sentences: [],
    sl: 'en',
    target: 'tr',
    gen: 1,
    send: async () => ({ ok: true, res: [] }),
  });
  const emptyProg = emptySched.getProgress();
  assert.equal(emptyProg.total, 0);
  assert.equal(emptyProg.done, 0);
  emptySched.stop();

  console.log('scheduler: 3/3 test geçti');
})().catch((e) => { console.error('BAŞARISIZ:', e.message); process.exit(1); });
