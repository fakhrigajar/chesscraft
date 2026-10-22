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
  await expect(page.getByRole('heading', { name: 'Help your knight reach f3!' })).toBeVisible();
  await expect(page.locator('.blocklyBlockCanvas')).toContainText('When we start');
  await expect(page.locator('.header-stars b')).toHaveText('1');
  await expect(page.getByRole('combobox', { name: /language/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Little moves.*Big adventures/ })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Play & learn', exact: true }).click();
  const level = page.getByRole('button', { name: `Lesson 10: ${legacyPuzzle.titleEn}`, exact: true });
  await level.click();
  await expect(level).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { name: 'Help your knight reach f3!', exact: true })).toBeVisible();
  // A saved choice to keep sound off still wins over the new sound-on default.
  await expect(page.getByRole('button', { name: 'Sound off', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('import errors remain readable', async ({ page }) => {
  await page.goto('/#/add');
  await page.getByRole('tab', { name: 'FEN position', exact: true }).click();
  await page.getByLabel('Enter your FEN position').fill('invalid FEN');
  await page.getByRole('button', { name: 'Analyze & preview', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This FEN position is invalid.');
});
