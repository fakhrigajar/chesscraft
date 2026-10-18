import { test, expect } from '@playwright/test';

async function openProgram(page) {
  await page.goto('/#/play/knight-hop');
  const move = page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true });
  await expect(move).toBeVisible();
  for (let i = 0; i < 24; i++) await move.click();
  await expect(page.locator('.block-count')).toContainText('24 blocks');
}

test('rapid, fractional trackpad input scrolls a long program without rewriting it', async ({ page }) => {
  await openProgram(page);
  const result = await page.evaluate(async () => {
    const blocklyUrl = performance.getEntriesByType('resource')
      .find(entry => entry.name.includes('/blockly_core.js?')).name;
    const Blockly = await import(blocklyUrl);
    const workspace = Blockly.common.getAllWorkspaces().find(workspace =>
      workspace.rendered && workspace.getParentSvg().closest('.blockly-area'));
    const nextFrame = () => new Promise(requestAnimationFrame);
    workspace.scroll(0, 0, false);
    await nextFrame();
    const before = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
    const start = workspace.scrollY;
    let scrollCalls = 0;
    const scroll = workspace.scroll.bind(workspace);
    workspace.scroll = (...args) => { scrollCalls++; return scroll(...args); };
    const wheel = (deltaY) => workspace.getCanvas().dispatchEvent(new WheelEvent('wheel', {
      deltaY, deltaMode: 0, bubbles: true, cancelable: true,
    }));
    for (let i = 0; i < 80; i++) wheel(0.25);
    await nextFrame();
    const burstCalls = scrollCalls;
    const burstDistance = start - workspace.scrollY;
    const slowStart = workspace.scrollY;
    for (let i = 0; i < 8; i++) {
      wheel(0.25);
      await nextFrame();
    }
    workspace.scroll = scroll;
    return {
      burstCalls, burstDistance,
      slowDistance: slowStart - workspace.scrollY,
      unchanged: before === JSON.stringify(Blockly.serialization.workspaces.save(workspace)),
      pageScroll: scrollY,
    };
  });
  expect(result.burstCalls).toBe(1);
  expect(result.burstDistance).toBe(20);
  expect(result.slowDistance).toBe(2);
  expect(result.unchanged).toBe(true);
  expect(result.pageScroll).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('23 blocks');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('24 blocks');
});

test('mouse and Shift-wheel scrolling work, and scrolling pauses during block dragging', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openProgram(page);
  const workspace = await page.evaluateHandle(async () => {
    const blocklyUrl = performance.getEntriesByType('resource')
      .find(entry => entry.name.includes('/blockly_core.js?')).name;
    const Blockly = await import(blocklyUrl);
    return Blockly.common.getAllWorkspaces().find(workspace =>
      workspace.rendered && workspace.getParentSvg().closest('.blockly-area'));
  });
  await workspace.evaluate(workspace => workspace.scroll(0, 0, false));
  const area = await page.locator('.blockly-area').boundingBox();
  await page.mouse.move(area.x + area.width - 40, area.y + 80);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => workspace.evaluate(workspace => workspace.scrollY)).toBe(-120);
  const startX = await workspace.evaluate(workspace => workspace.scrollX);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 10);
  await page.keyboard.up('Shift');
  await expect.poll(() => workspace.evaluate(workspace => workspace.scrollX)).toBe(startX - 10);
  expect(await workspace.evaluate(workspace => workspace.scrollY)).toBe(-120);

  await workspace.evaluate(workspace => workspace.scroll(0, 0, false));
  const block = page.locator('.blocklyDraggable').filter({ hasText: 'g1' }).first();
  const box = await block.boundingBox();
  await page.mouse.move(box.x + 65, box.y + 23);
  await page.mouse.down();
  await page.mouse.move(box.x + 85, box.y + 43, { steps: 5 });
  await expect(page.locator('.workspace-body')).toHaveClass(/is-dragging/);
  const before = await workspace.evaluate(workspace => workspace.scrollY);
  await page.mouse.wheel(0, 120);
  await workspace.evaluate(() => new Promise(requestAnimationFrame));
  expect(await workspace.evaluate(workspace => workspace.scrollY)).toBe(before);
  await page.mouse.up();
  await expect(page.locator('.workspace-body')).not.toHaveClass(/is-dragging/);
  await expect(page.locator('.block-count')).toContainText('24 blocks');
  expect(errors).toEqual([]);
  await workspace.dispose();
});
