import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { importPgn } from '../../src/services/importers.js';

const opening = readFileSync(new URL('../fixtures/opening-study.pgn', import.meta.url), 'utf8');
const windmill = readFileSync(new URL('../fixtures/lichess-study.pgn', import.meta.url), 'utf8');

async function upload(page, pgn) {
  await page.addInitScript(() => localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ reducedMotion: true })));
  await page.goto('/#/add');
  await page.locator('.import-source input[type=file]').setInputFiles({ name: 'downloaded-puzzle.pgn', mimeType: 'application/x-chess-pgn', buffer: Buffer.from('\uFEFF' + pgn.replaceAll('\n', '\r\n')) });
  await expect(page.getByLabel('Paste your PGN here')).toHaveValue(pgn);
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await expect(page.getByText('Legal position', { exact: true })).toBeVisible({ timeout: 1500 });
}

async function save(page) {
  await page.getByLabel('I have reviewed and confirmed the objective').check();
  await page.getByRole('button', { name: 'Save & play', exact: true }).click();
  await expect(page.locator('.blocklySvg')).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem('chesscraft.v1.puzzles'))[0].id);
}

async function addMove(page, uci) {
  await page.getByRole('button', { name: new RegExp(`^${uci.slice(0, 2)} (White|Black) `) }).click();
  await page.locator('.move-options>button').filter({ has: page.locator('.destination-bubble').filter({ hasText: new RegExp(`^${uci.slice(2, 4)}$`) }) }).click();
}

async function solve(page, solution, id) {
  for (let ply = 0; ply < solution.length; ply += 2) {
    await addMove(page, solution[ply]);
    await page.getByRole('button', { name: /^Run code/ }).click();
    if (ply + 2 >= solution.length) await expect(page.getByRole('heading', { name: 'Amazing! You did it!', exact: true })).toBeVisible({ timeout: 1500 });
    else {
      await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.moves, `chesscraft.v1.session.${id}`), { timeout: 1500 }).toEqual(solution.slice(0, ply + 2));
      await expect(page.getByRole('heading', { name: 'Amazing! You did it!', exact: true })).toHaveCount(0);
    }
  }
}

test('a downloaded tactical PGN file imports and executes its entire solution', async ({ page }) => {
  await upload(page, windmill);
  const id = await save(page);
  await solve(page, importPgn(windmill).solution, id);
  await expect(page.getByRole('button', { name: 'a2 White Rook', exact: true })).toBeVisible();
});

test('a downloaded PGN without a tactical goal runs to its recorded endpoint without engine waits', async ({ page }) => {
  const analysisRequests = [];
  page.on('request', request => { if (/\/engine\/|objective\.worker/.test(request.url())) analysisRequests.push(request.url()); });
  await upload(page, opening);
  await expect(page.getByText('No specific tactical goal was found.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Student move limit', { exact: true })).toHaveValue('2');
  const id = await save(page);
  await solve(page, importPgn(opening).solution, id);
  await expect(page.getByRole('button', { name: 'c6 Black Knight', exact: true })).toBeVisible();
  expect(analysisRequests).toEqual([]);
});

test('a normal game PGN uses the selected start position and then executes the remaining recorded moves', async ({ page }) => {
  await upload(page, '[Event "Game history"]\n1. e4 e5 2. Nf3 Nc6 *');
  await page.getByLabel('Starting half-move (ply)').selectOption('2');
  await page.getByRole('button', { name: 'Use this position', exact: true }).click();
  await expect(page.getByLabel('Starting half-move (ply)')).toHaveCount(0);
  const id = await save(page);
  await solve(page, ['g1f3', 'b8c6'], id);
});

test('a previously saved PGN receives its full endpoint when reopened', async ({ page }) => {
  const puzzle = { ...importPgn(opening), id: 'legacy-pgn', importVersion: 2 };
  delete puzzle.recordedObjective;
  puzzle.objective.moves = 1;
  await page.addInitScript(puzzle => {
    localStorage.setItem('chesscraft.v1.puzzles', JSON.stringify([puzzle]));
    localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ reducedMotion: true }));
  }, puzzle);
  await page.goto('/#/play/legacy-pgn');
  await solve(page, puzzle.solution, puzzle.id);
});

test('Run reports an empty program instead of stopping silently', async ({ page }) => {
  await page.goto('/#/play/knight-hop');
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expect(page.getByRole('alert')).toContainText('Add a move block');
});

test('failed move checking shows a retry message and can recover on the next Run', async ({ page }) => {
  const puzzle = { ...importPgn(opening), id: 'engine-required-pgn' };
  puzzle.objective = { ...puzzle.objective, toleranceCp: 0 };
  await page.addInitScript(puzzle => {
    localStorage.setItem('chesscraft.v1.puzzles', JSON.stringify([puzzle]));
    localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ reducedMotion: true }));
  }, puzzle);
  await page.route('**/engine/*.js', route => route.abort());
  await page.goto('/#/play/engine-required-pgn');
  await addMove(page, 'e2e4');
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expect(page.getByRole('alert')).toContainText('Move checking is unavailable');
  await expect(page.getByRole('button', { name: 'e2 White Pawn', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Run code/ })).toBeEnabled();
  await page.unroute('**/engine/*.js');
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expect(page.getByRole('button', { name: 'e4 White Pawn', exact: true })).toBeVisible({ timeout: 10000 });
});

test('Plan ahead stops at a PGN endpoint that ends on the student move', async ({ page }) => {
  const pgn = opening.replace('Nf3 Nc6 *', 'Nf3 *');
  const analysisRequests = [];
  page.on('request', request => { if (request.url().includes('/engine/')) analysisRequests.push(request.url()); });
  await upload(page, pgn);
  await save(page);
  await addMove(page, 'e2e4');
  await page.getByRole('button', { name: 'Plan ahead', exact: true }).click();
  await expect(page.getByRole('button', { name: 'e5 Black Pawn', exact: true })).toBeVisible();
  await addMove(page, 'g1f3');
  await expect(page.getByRole('button', { name: 'f3 White Knight', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expect(page.getByRole('heading', { name: 'Amazing! You did it!', exact: true })).toBeVisible();
  expect(analysisRequests).toEqual([]);
});
