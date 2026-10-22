import { test, expect } from '@playwright/test';

// SHA-256 of the unmodified clips served by the referenced Code.org lesson.
const soundHashes = {
  add: '1048f2539ac47e4eaa4bd1688968c0d7b9956bd6fef507644ee5131924c6517c',
  remove: '6ea0afab062cb3ba5409dc65d7a9fdf85d602b1870d231d80bdf3cc5b32432b6',
};

async function recordSounds(page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('chesscraft.v1.settings')) {
      localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ sound: true }));
    }
    window.blockSounds = [];
    window.chessNotes = [];
    window.decodedClips = [];
    const samples = new WeakMap();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    window.AudioContext = class extends AudioContext {
      async decodeAudioData(bytes) {
        const original = bytes.slice(0);
        const buffer = await super.decodeAudioData(bytes);
        const digest = await crypto.subtle.digest('SHA-256', original);
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        samples.set(buffer, hash);
        window.decodedClips.push(hash);
        return buffer;
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args) => {
          // Chess sounds also use generated noise buffers; only count decoded clips.
          if (samples.has(source.buffer)) window.blockSounds.push(samples.get(source.buffer));
          return start(...args);
        };
        return source;
      }
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        osc.start = (...args) => {
          window.chessNotes.push(osc.frequency.value);
          return start(...args);
        };
        return osc;
      }
    };
  });
}

async function expectSound(page, count, kind) {
  await expect.poll(() => page.evaluate(() => window.blockSounds.length)).toBe(count);
  if (kind) {
    const hash = await page.evaluate(() => window.blockSounds.at(-1));
    expect(hash).toBe(soundHashes[kind]);
  }
}

test('adding, Undo, Redo, and Clear play distinct effects once per action and honor mute', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await recordSounds(page);
  await page.goto('/#/play/knight-hop');
  const move = page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true });
  await expect(move).toBeVisible();
  await expectSound(page, 0);
  await move.click();
  await expectSound(page, 1, 'add');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectSound(page, 2, 'remove');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expectSound(page, 3, 'add');
  await move.click();
  await expectSound(page, 4, 'add');
  await page.getByRole('button', { name: 'Clear blocks', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('0 blocks');
  await expectSound(page, 5, 'remove');
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await move.click();
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('0 blocks');
  await expectSound(page, 5);
  await page.getByRole('button', { name: 'Sound off', exact: true }).click();
  await move.click();
  await expectSound(page, 6, 'add');
  await page.getByRole('button', { name: /^Run code/ }).click();
  await expect(page.getByRole('heading', { name: 'Amazing! You did it!', exact: true })).toBeVisible();
  await expectSound(page, 6);
  await expect.poll(() => page.evaluate(() => window.chessNotes.length)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('HTML drops and dragging a block back play sounds, while restoring a saved program stays silent', async ({ page }) => {
  await recordSounds(page);
  await page.goto('/#/play/knight-hop');
  const move = page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true });
  await move.dragTo(page.locator('.blockly-area'));
  await expectSound(page, 1, 'add');
  await move.click();
  await expectSound(page, 2, 'add');
  await page.reload();
  await expect(page.locator('.block-count')).toContainText('2 blocks');
  await expectSound(page, 0);
  const block = page.locator('.blockly-area .blocklyBlockCanvas .blocklyDraggable').last();
  const box = await block.boundingBox();
  const target = page.locator('.toolbox-panel');
  const destination = await target.boundingBox();
  await page.mouse.move(box.x + 65, box.y + 23);
  await page.mouse.down();
  await page.mouse.move(box.x + 77, box.y + 35, { steps: 4 });
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 18 });
  await expect(target).toHaveClass(/delete-drop-active/);
  await page.mouse.up();
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await expectSound(page, 1, 'remove');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('2 blocks');
  await expectSound(page, 2, 'add');
});

test('blocked audio does not interrupt adding or removing blocks', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('chesscraft.v1.settings', JSON.stringify({ sound: true }));
  });
  await page.goto('/#/play/knight-hop');
  await expect(page.locator('.blocklySvg')).toBeVisible();
  await page.evaluate(() => {
    window.AudioContext = class { constructor() { throw new Error('Audio unavailable'); } };
  });
  await page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await page.getByRole('button', { name: 'Clear blocks', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('0 blocks');
  expect(errors).toEqual([]);
});

test('muting cancels block sounds that are still loading', async ({ page }) => {
  await recordSounds(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/blockly-media/click.mp3', async route => {
    await gate;
    await route.continue();
  });
  await page.goto('/#/play/knight-hop');
  await page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  release();
  await expect.poll(() => page.evaluate(() => window.decodedClips)).toContain(soundHashes.add);
  await expectSound(page, 0);
});
