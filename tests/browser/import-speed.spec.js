import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { importPgn, importLichessData } from '../../src/services/importers.js';

const study = readFileSync(new URL('../fixtures/lichess-study.pgn', import.meta.url), 'utf8');
const source = 'https://lichess.org/api/study/moOcHMA4/0YWcsjfF.pgn';
const link = 'https://lichess.org/study/moOcHMA4/0YWcsjfF';

async function addMove(page, uci) {
  await page.getByRole('button', { name: new RegExp(`^${uci.slice(0, 2)} (White|Black) `) }).click();
  await page.locator('.move-options>button').filter({ has: page.locator('.destination-bubble').filter({ hasText: new RegExp(`^${uci.slice(2, 4)}$`) }) }).click();
}

async function playSource(page, puzzle, id) {
  const sessionKey = `chesscraft.v1.session.${id}`;
  for (let ply = 0; ply < puzzle.solution.length; ply += 2) {
    await addMove(page, puzzle.solution[ply]);
    await page.getByRole('button', { name: /^Run code/ }).click();
    if (ply + 1 === puzzle.solution.length) {
      await expect(page.getByRole('heading', { name: 'Amazing! You did it!', exact: true })).toBeVisible({ timeout: 1500 });
    } else {
      await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.moves, sessionKey), { timeout: 1500 }).toEqual(puzzle.solution.slice(0, ply + 2));
      await expect(page.getByRole('heading', { name: 'Amazing! You did it!', exact: true })).toHaveCount(0);
    }
  }
}

async function openImporter(page) {
  await page.goto('/#/add');
  await page.getByRole('tab', { name: 'Import a link', exact: true }).click();
  await page.getByLabel('Lichess or Chess.com link').fill(link);
}

test('the supplied study previews without an engine download and repeated previews reuse its PGN', async ({ page }) => {
  let downloads = 0;
  const backendOrEngine = [];
  page.on('request', request => { if (/\/(engine|api\/source)\//.test(request.url()) || request.url().includes('/api/source?')) backendOrEngine.push(request.url()); });
  await page.route(source, route => { downloads++; return route.fulfill({ body: study, contentType: 'application/x-chess-pgn' }); });
  await openImporter(page);
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await expect(page.getByText('Legal position', { exact: true })).toBeVisible({ timeout: 1500 });
  await expect(page.getByText('23 source plies · 1 variations', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Learning objective', { exact: true })).toHaveValue('capture');
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await expect(page.getByText('Legal position', { exact: true })).toBeVisible({ timeout: 1500 });
  expect(downloads).toBe(1);
  expect(backendOrEngine).toEqual([]);
  await expect(page.getByLabel('Student move limit', { exact: true })).toHaveValue('12');
  await page.getByLabel('I have reviewed and confirmed the objective').check();
  await page.getByRole('button', { name: 'Save & play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The Windmill. Puzzles.: Exercise # 1', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chesscraft.v1.puzzles'))[0].objective.moves)).toBe(12);
});

test('selecting a starting ply for a study URL reuses its download and exits history selection', async ({ page }) => {
  let downloads = 0;
  await page.route(source, route => { downloads++; return route.fulfill({ body: '[Event "Opening"]\n1. e4 e5 2. Nf3 Nc6 *' }); });
  await openImporter(page);
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await page.getByLabel('Starting half-move (ply)').selectOption('2');
  await page.getByRole('button', { name: 'Use this position', exact: true }).click();
  await expect(page.getByText('2 source plies · 1 variations', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Starting half-move (ply)')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'The chessboard', exact: true })).toBeVisible();
  expect(downloads).toBe(1);
});

test('editing a pending URL cancels its preview and ignores a late response', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(source, async route => { await gate; await route.fulfill({ body: study }).catch(() => {}); });
  await openImporter(page);
  const requested = page.waitForRequest(source);
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await requested;
  await page.getByLabel('Lichess or Chess.com link').fill('https://lichess.org/training/iUIdn');
  await expect(page.getByRole('button', { name: 'Analyze & preview', exact: true })).toBeEnabled();
  release();
  await expect(page.getByText('A new adventure starts here', { exact: true })).toBeVisible();
  await expect(page.getByText('Legal position', { exact: true })).toHaveCount(0);
});

test('the Windmill URL plays all twelve moves with matching replies and completes only on the queen capture', async ({ page }) => {
  const analysisRequests = [], errors = [];
  page.on('request', request => { if (/\/engine\/|objective\.worker/.test(request.url())) analysisRequests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ reducedMotion: true })));
  await page.route(source, route => route.fulfill({ body: study }));
  await openImporter(page);
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await page.getByLabel('I have reviewed and confirmed the objective').check();
  await page.getByRole('button', { name: 'Save & play', exact: true }).click();
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('chesscraft.v1.puzzles'))[0].id);
  await playSource(page, importPgn(study), id);
  await expect(page.getByRole('button', { name: 'a2 White Rook', exact: true })).toBeVisible();
  expect(analysisRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('an official Lichess puzzle URL runs its full solution without checking recorded moves again', async ({ page }) => {
  const data = JSON.parse(readFileSync(new URL('../fixtures/lichess.json', import.meta.url), 'utf8'));
  await page.addInitScript(() => localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ reducedMotion: true })));
  await page.route('https://lichess.org/api/puzzle/iUIdn', route => route.fulfill({ json: data }));
  await openImporter(page);
  await page.getByLabel('Lichess or Chess.com link').fill('https://lichess.org/training/iUIdn');
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await page.getByLabel('I have reviewed and confirmed the objective').check();
  await page.getByRole('button', { name: 'Save & play', exact: true }).click();
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('chesscraft.v1.puzzles'))[0].id);
  await playSource(page, importLichessData(data, ''), id);
});

test('Plan ahead predicts the same Windmill replies that Run code actually plays', async ({ page }) => {
  const puzzle = { ...importPgn(study), id: 'windmill-plan', needsConfirmation: false };
  await page.addInitScript(puzzle => {
    localStorage.setItem('chesscraft.v1.puzzles', JSON.stringify([puzzle]));
    localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ reducedMotion: true }));
  }, puzzle);
  await page.goto('/#/play/windmill-plan');
  await addMove(page, puzzle.solution[0]);
  await page.getByRole('button', { name: 'Plan ahead', exact: true }).click();
  await expect(page.getByRole('button', { name: 'g5 Black Pawn', exact: true })).toBeVisible({ timeout: 1500 });
  await addMove(page, puzzle.solution[2]);
  await expect(page.getByRole('button', { name: 'h7 Black King', exact: true })).toBeVisible({ timeout: 1500 });
  await addMove(page, puzzle.solution[4]);
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('chesscraft.v1.session.windmill-plan'))?.moves)).toEqual(puzzle.solution.slice(0, 6));
  await expect(page.getByRole('button', { name: 'e6 White Rook', exact: true })).toBeVisible();
});

test('an older saved Windmill with the accidental eight-move cap works without reimporting', async ({ page }) => {
  const puzzle = { ...importPgn(study), id: 'legacy-windmill' };
  delete puzzle.importVersion;
  puzzle.objective.moves = 8;
  await page.addInitScript(puzzle => {
    localStorage.setItem('chesscraft.v1.puzzles', JSON.stringify([puzzle]));
    localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ reducedMotion: true }));
  }, puzzle);
  await page.goto('/#/play/legacy-windmill');
  await playSource(page, puzzle, puzzle.id);
});
