import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importUrl, importFen, analyzeImport } from '../src/services/importers.js';
import { fetchPublicSource } from '../src/services/publicSource.js';

const study = readFileSync(new URL('./fixtures/lichess-study.pgn', import.meta.url), 'utf8');

test('the supplied study previews its complete legal solution without starting Stockfish and reuses its download', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => { requests.push(url); return new Response(study); });
  const url = 'https://lichess.org/study/moOcHMA4/0YWcsjfF';
  const puzzle = await importUrl(url);
  const preview = await analyzeImport(puzzle, { analyze() { assert.fail('Recorded solutions must not wait for engine analysis'); } });
  assert.equal(preview.solution.length, 23);
  assert.deepEqual(preview.objective, { type: 'capture', piece: 'q', moves: 12 });
  assert.equal(preview.needsStartPly, false);
  const selected = await importUrl(url, { startPly: 2 });
  assert.equal(selected.startPly, 2);
  assert.equal(selected.solution.length, 21);
  assert.deepEqual(requests, ['https://lichess.org/api/study/moOcHMA4/0YWcsjfF.pgn']);
});

test('a study URL with game history honors the chosen starting ply', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('[Event "Game"]\n1. e4 e5 2. Nf3 Nc6 *'));
  const url = 'https://lichess.org/study/abcdefgh/ABCDEFGH';
  assert.equal((await importUrl(url)).needsStartPly, true);
  const puzzle = await importUrl(url, { startPly: 2 });
  assert.equal(puzzle.needsStartPly, false);
  assert.deepEqual(puzzle.solution, ['g1f3', 'b8c6']);
});

test('FEN-only previews still analyze and require teacher confirmation', async () => {
  const puzzle = importFen('7k/5K2/6Q1/8/8/8/8/8 w - - 0 1');
  let analyzed = false;
  const preview = await analyzeImport(puzzle, { async analyze(fen) {
    assert.equal(fen, puzzle.initialFen); analyzed = true;
    return { bestmove: 'g6g7', variations: [{ score: { type: 'mate', value: 1 }, bound: false }] };
  } });
  assert.equal(analyzed, true);
  assert.equal(preview.needsConfirmation, true);
  assert.deepEqual(preview.objective, { type: 'mate', moves: 1 });
});

test('cached JSON cannot be changed by callers and expires for daily sources', async t => {
  let calls = 0, now = Date.now();
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ solution: ['e2e4'] }); });
  for (const url of ['https://api.chess.com/pub/puzzle', 'https://lichess.org/api/puzzle/daily']) {
    const before = calls;
    const first = await fetchPublicSource(url);
    first.solution.push('e7e5');
    assert.deepEqual((await fetchPublicSource(url)).solution, ['e2e4']);
    assert.equal(calls, before + 1);
    now += 61000;
    await fetchPublicSource(url);
    assert.equal(calls, before + 2);
  }
});

test('request timeout still works with a caller signal and covers downloading the body', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  }));
  const controller = new AbortController();
  await assert.rejects(fetchPublicSource('https://lichess.org/api/puzzle/Time1', { signal: controller.signal, timeoutMs: 10 }), error => error.code === 'networkTimeout');
  assert.equal(controller.signal.aborted, false);
});

test('cancelling an import aborts its fetch and does not cache a failed response', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    calls++;
    if (calls > 1) return Response.json({ ok: true });
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const controller = new AbortController();
  const pending = fetchPublicSource('https://lichess.org/api/puzzle/Abort', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(await fetchPublicSource('https://lichess.org/api/puzzle/Abort'), { ok: true });
  assert.equal(calls, 2);
});

test('network and rate-limit failures do not retry through a backend or get cached', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url);
    if (requests.length === 1) throw new TypeError('Failed to fetch');
    return new Response('', { status: 429 });
  });
  const url = 'https://lichess.org/api/puzzle/Error';
  await assert.rejects(fetchPublicSource(url), error => error.code === 'network');
  await assert.rejects(fetchPublicSource(url), error => error.code === 'rateLimit');
  assert.deepEqual(requests, [url, url]);
});

test('recorded lines name promotions, won material, and theme-tagged tactics as goals', async () => {
  const { inferSourceObjective } = await import('../src/services/continuation.js');
  assert.deepEqual(inferSourceObjective('7k/P7/5K2/8/8/8/8/8 w - - 0 1', ['a7a8q']), { type: 'reach', piece: 'q', target: 'a8', promotion: true, moves: 1 });
  assert.deepEqual(inferSourceObjective('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1', ['a1a8']), { type: 'capture', piece: 'r', moves: 1 });
  assert.equal(inferSourceObjective('r3k3/1b6/8/8/8/8/8/R3K3 w - - 0 1', ['a1a8', 'b7a8']).type, 'strategic');
  assert.deepEqual(inferSourceObjective('4k3/3n4/8/8/8/8/8/4KB2 w - - 0 1', ['f1b5'], ['pin', 'short']), { type: 'pin', moves: 1 });
  assert.equal(inferSourceObjective('4k3/3n4/8/8/8/8/8/4KB2 w - - 0 1', ['f1b5']).type, 'strategic');
});

test('FEN previews read a material-winning goal from the engine line', async () => {
  const puzzle = importFen('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  const preview = await analyzeImport(puzzle, { async analyze() {
    return { bestmove: 'a1a8', variations: [{ pv: ['a1a8', 'e8e7', 'a8a7'], score: { type: 'cp', value: 520 }, bound: false }] };
  } });
  assert.deepEqual(preview.objective, { type: 'capture', piece: 'r', moves: 1 });
  assert.equal(preview.needsConfirmation, true);
});
