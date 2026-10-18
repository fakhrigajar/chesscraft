import { test, expect } from '@playwright/test';

async function openPlay(page, lesson = 'knight-hop') {
  await page.goto(`/#/play/${lesson}`);
  await expect(page.locator('.blocklySvg')).toBeVisible();
}

async function expectCentered(page, dialog) {
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox(), viewport = page.viewportSize();
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  expect(box.y).toBeGreaterThanOrEqual(15);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 15);
}

async function dragProgramBlock(page, target) {
  const block = page.locator('.blockly-area .blocklyBlockCanvas .blocklyDraggable').filter({ hasText: 'g1' });
  const box = await block.boundingBox(), destination = await target.boundingBox();
  await page.mouse.move(box.x + 65, box.y + 23);
  await page.mouse.down();
  await page.mouse.move(box.x + 77, box.y + 35, { steps: 4 });
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 18 });
  await expect(target).toHaveClass(/delete-drop-active/);
  await page.mouse.up();
}

test('play fits one viewport at laptop, desktop, tablet, and phone sizes', async ({ page }) => {
  await openPlay(page);
  for (const viewport of [
    { width: 1440, height: 900 }, { width: 1366, height: 768 },
    { width: 1280, height: 720 }, { width: 1024, height: 768 },
    { width: 800, height: 600 }, { width: 390, height: 844 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    if (viewport.width <= 900) {
      await page.getByRole('tab', { name: 'My program', exact: true }).click();
      await expect(page.getByRole('button', { name: /^Run code/ })).toBeInViewport({ ratio: 1 });
      await page.getByRole('tab', { name: 'The chessboard', exact: true }).click();
    } else await expect(page.getByRole('button', { name: /^Run code/ })).toBeInViewport({ ratio: 1 });
    await expect.poll(async () => {
      const box = await page.locator('.board-stage .chessboard-frame').boundingBox();
      const stage = await page.locator('.board-stage').boundingBox();
      return box && stage && box.y >= 0 && box.y + box.height <= viewport.height && box.height > 0 &&
        Math.abs(box.height - Math.floor(Math.min(stage.width, stage.height))) <= 1;
    }).toBe(true);
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      viewportWidth: innerWidth, viewportHeight: innerHeight, scroll: scrollY,
    }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight);
    expect(dimensions.scroll).toBe(0);
    if (viewport.width > 900) {
      for (const panel of ['.toolbox-panel', '.workspace-panel', '.board-panel']) {
        await expect(page.locator(panel)).toBeInViewport({ ratio: 1 });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/play-one-screen-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/play-one-screen-mobile.png', fullPage: true });
});

test('help and completion dialogs are centered horizontally and vertically', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPlay(page);
  await page.getByRole('button', { name: 'How to play' }).click();
  await expectCentered(page, page.getByRole('dialog'));
  await page.screenshot({ path: 'test-results/play-centered-help.png' });
  await page.getByRole('button', { name: 'Got it, let’s explore!' }).click();
  await page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true }).click();
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expectCentered(page, page.getByRole('dialog', { name: 'Amazing! You did it!' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await expectCentered(page, page.getByRole('dialog'));
});

test('library dialogs stay centered after scrolling down the page', async ({ page }) => {
  await openPlay(page);
  await page.getByRole('button', { name: 'Puzzle library', exact: true }).click();
  const card = page.locator('.puzzle-card').filter({ has: page.getByRole('heading', { name: 'A safe castle for the king', exact: true }) });
  await card.getByRole('button', { name: /^Duplicate / }).click();
  await page.getByRole('button', { name: 'Edit A safe castle for the king (copy)', exact: true }).click();
  await expectCentered(page, page.getByRole('dialog', { name: 'Edit', exact: true }));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test('a new block stays snapped in place throughout its arrival animation', async ({ page }) => {
  await openPlay(page);
  const frames = await page.evaluate(async () => {
    document.querySelector('.move-options button[aria-label="Knight g1 ↑2 ←1  f3"]').click();
    const samples = [];
    await new Promise(resolve => {
      const sample = () => {
        const block = document.querySelector('.new-block');
        if (block) {
          const rect = block.getBoundingClientRect();
          samples.push({ x: rect.x, y: rect.y, opacity: Number(getComputedStyle(block).opacity) });
        }
        if (samples.length >= 16) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return samples;
  });
  expect(Math.max(...frames.map(f => f.x)) - Math.min(...frames.map(f => f.x))).toBeLessThan(2);
  expect(Math.max(...frames.map(f => f.y)) - Math.min(...frames.map(f => f.y))).toBeLessThan(2);
  await expect(page.locator('.blockly-area .blocklyBlockCanvas .blocklyDraggable').filter({ hasText: 'g1' })).toContainText('f3');
});

test('dragging a program block back into Move blocks deletes it and Undo restores it', async ({ page }) => {
  await openPlay(page);
  await page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await dragProgramBlock(page, page.locator('.toolbox-panel'));
  await expect(page.locator('.block-count')).toContainText('0 blocks');
  await expect(page.locator('.program-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'g1 White Knight', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await expect(page.locator('.blockly-area .blocklyBlockCanvas .blocklyDraggable').filter({ hasText: 'g1' })).toContainText('f3');
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expect(page.getByRole('heading', { name: 'Amazing! You did it!', level: 2 })).toBeVisible();
});

test('phone tabs support selecting, building, deleting, and running without page scroll', async ({ page }) => {
  await openPlay(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'g1 White Knight', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Move blocks', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'My program', exact: true })).toHaveAttribute('aria-selected', 'true');
  await dragProgramBlock(page, page.locator('#play-tab-toolbox'));
  await expect(page.locator('.block-count')).toContainText('0 blocks');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.blockly-area .blocklyBlockCanvas .blocklyDraggable').filter({ hasText: 'g1' })).toContainText('f3');
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expect(page.getByRole('tab', { name: 'The chessboard', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Amazing! You did it!', level: 2 })).toBeVisible();
  await expectCentered(page, page.getByRole('dialog'));
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
