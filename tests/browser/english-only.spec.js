import { test, expect } from '@playwright/test';
import { lessons } from '../../src/data/lessons.js';

const legacyPuzzle = {
  ...lessons[0], id: 'legacy-puzzle', title: 'Original saved title',
  titleEn: 'My saved English puzzle', description: 'Original saved description',
  descriptionEn: 'My saved English instructions.', source: { type: 'teacher' },
};

test('legacy language settings, puzzles, and workspaces open in English without language controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(puzzle => {
    if (localStorage.getItem('english-test-seeded')) return;
    localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ language: 'az', sound: false, reducedMotion: true, exploration: true }));
    localStorage.setItem('chesscraft.v1.puzzles', JSON.stringify([puzzle]));
    localStorage.setItem('chesscraft.v1.progress', JSON.stringify({ 'knight-hop': { completed: true, attempts: 3 } }));
    localStorage.setItem('chesscraft.v1.workspace.knight-hop', JSON.stringify({ blocks: { languageVersion: 0, blocks: [{ type: 'chess_start', id: 'legacy-start', x: 30, y: 34, fields: { TITLE: '\u0042a\u015flayanda' } }] } }));
    localStorage.setItem('english-test-seeded', 'true');
  }, legacyPuzzle);
  await page.goto('/#/play/knight-hop');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Chesscraft · Little moves, big adventures');
  await expect(page.getByRole('heading', { name: 'A knight’s little leap' })).toBeVisible();
  await expect(page.locator('.blocklyBlockCanvas')).toContainText('When we start');
  await expect(page.locator('.header-stars b')).toHaveText('1');
  await expect(page.getByRole('combobox', { name: /language/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Little moves.*Big adventures/ })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Puzzle library', exact: true }).click();
  const card = page.locator('.puzzle-card').filter({ has: page.getByRole('heading', { name: legacyPuzzle.titleEn, exact: true }) });
  await expect(card).toContainText('Reach a square');
  await card.getByRole('button', { name: 'Let’s play', exact: true }).click();
  await expect(page.getByRole('heading', { name: legacyPuzzle.titleEn, exact: true })).toBeVisible();
  await expect(page.getByText(legacyPuzzle.descriptionEn, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Teacher room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Learning settings' })).toBeVisible();
  await expect(page.locator('.teacher-settings').getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Exploration mode' })).toBeChecked();
  await page.getByRole('switch', { name: 'Reduced motion' }).click();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Reduced motion' })).not.toBeChecked();
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('chesscraft.v1.settings')));
  expect(settings).toEqual({ sound: false, reducedMotion: false, exploration: true });
  expect(errors).toEqual([]);
});

test('older backups restore editable English content and import errors remain readable', async ({ page }) => {
  await page.goto('/#/teacher');
  const restored = { ...legacyPuzzle, id: 'restored-puzzle' };
  await page.locator('.teacher-page input[type=file]').setInputFiles({
    name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'chesscraft', version: 1, puzzles: [restored], progress: {} })),
  });
  await expect(page.getByText('Your backup has been restored.')).toBeVisible();
  await page.getByRole('button', { name: 'Puzzle library', exact: true }).click();
  await page.getByRole('button', { name: `Edit ${restored.titleEn}`, exact: true }).click();
  await expect(page.getByLabel('Puzzle title', { exact: true })).toHaveValue(restored.titleEn);
  await expect(page.getByLabel('A short explanation for the child')).toHaveValue(restored.descriptionEn);
  await page.getByLabel('Puzzle title', { exact: true }).fill('Updated saved puzzle');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Updated saved puzzle', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chesscraft.v1.puzzles'))[0]);
  expect(saved.title).toBe('Updated saved puzzle');
  expect(saved).not.toHaveProperty('titleEn');
  expect(saved).not.toHaveProperty('descriptionEn');
  await page.getByRole('button', { name: 'Add puzzle', exact: true }).first().click();
  await page.getByRole('tab', { name: 'FEN position', exact: true }).click();
  await page.getByLabel('Enter your FEN position').fill('invalid FEN');
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This FEN position is invalid.');
});
