import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function english(page, path = '') {
  await page.goto(`/${path}`);
  await expect(page.getByRole('heading', { name: 'Move blocks' })).toBeVisible();
  await expect(page.locator('.blocklySvg')).toBeVisible();
}
test('student builds a real Blockly program, can undo/redo, and completes the knight objective', async ({ page }) => {
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.stack);});
  await english(page);
  await expect(page.getByRole('button', { name: 'e8 Black King', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'e8 Black King', exact: true }).click();
  await expect(page.locator('.selected-piece-card .coordinate-tag')).toHaveText('g1');
  await page.getByRole('button', { name: 'Knight g1 ↑2 ←1  f3', exact: true }).click();
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await expect(page.locator('.blockly-area .blocklyBlockCanvas .blocklyDraggable').filter({hasText:'g1'})).toBeVisible();
  await expect(page.getByRole('button', { name: 'g1 White Knight', exact: true })).toBeVisible();
  await page.getByRole('button', {name:'Undo',exact:true}).click();
  await expect(page.locator('.block-count')).toContainText('0 blocks');
  await page.getByRole('button', {name:'Redo',exact:true}).click();
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toBeVisible();
  await expect(page.getByRole('button', { name: 'f3 White Knight', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('unrecorded checkmate is accepted, with no red X',async({page})=>{
  await english(page,'#/play/royal-finale');
  await page.getByRole('button',{name:'Queen g6 → 1 h6',exact:true}).click();
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toBeVisible();
  await expect(page.locator('.board-result.wrong')).toHaveCount(0);
});

test('dragging a legal move creates a connected executable Blockly block without moving the piece early',async({page})=>{
  await english(page);
  await page.getByRole('button',{name:'Knight g1 ↑2 ←1  f3',exact:true}).dragTo(page.locator('.blockly-area'));
  await expect(page.locator('.block-count')).toContainText('1 blocks');
  await expect(page.locator('.blockly-area .blocklyBlockCanvas .blocklyDraggable').filter({hasText:'g1'})).toContainText('f3');
  await expect(page.getByRole('button',{name:'g1 White Knight',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toBeVisible();
});

test('a wrong legal move animates the strongest legal reply and resets the original position',async({page})=>{
  await english(page,'#/play/royal-finale');
  await page.getByRole('button',{name:'Queen g6 ↓ 1 g5',exact:true}).click();
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.getByRole('button',{name:'h7 Black King',exact:true})).toBeVisible({timeout:15000});
  await expect(page.locator('.board-result.wrong')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toHaveCount(0);
  await page.getByRole('button',{name:'Reset board',exact:true}).click();
  await expect(page.getByRole('button',{name:'g6 White Queen',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'h8 Black King',exact:true})).toBeVisible();
});

test('a multi-turn lesson continues after the defense and completes only at mate',async({page})=>{
  await english(page,'#/play/royal-team');
  await page.getByRole('button',{name:'King c6 ↑ 1 c7',exact:true}).click();
  await page.getByRole('button',{name:'Step',exact:true}).click();
  await expect(page.getByRole('button',{name:'a7 Black King',exact:true})).toBeVisible({timeout:15000});
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'a7 Black King',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'h3 White Queen',exact:true}).click();
  await page.getByRole('button',{name:'Queen h3 ← 7 a3',exact:true}).click();
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toBeVisible();
  await expect(page.getByRole('button',{name:'a3 White Queen',exact:true})).toBeVisible();
});

test('teacher imports PGN variations, saves, duplicates, edits and deletes a puzzle',async({page})=>{
  const consoleErrors=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await english(page);
  await page.getByRole('button',{name:'Add puzzle',exact:true}).click();
  await page.getByRole('button',{name:'Try an example',exact:true}).click();
  await page.getByRole('button',{name:'Analyze & preview',exact:true}).click();
  await expect(page.getByText('Legal position',{exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByText('1 source plies · 2 variations')).toBeVisible();
  await page.getByLabel('Puzzle title',{exact:true}).fill('Browser tested puzzle');
  await page.getByLabel('I have reviewed and confirmed the objective').check();
  await page.getByRole('button',{name:'Save & play',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Browser tested puzzle',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Puzzle library',exact:true}).click();
  await page.getByRole('button',{name:'Duplicate Browser tested puzzle',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Browser tested puzzle (copy)',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit Browser tested puzzle (copy)',exact:true}).click();
  await page.getByLabel('Puzzle title',{exact:true}).fill('Edited adventure');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Edited adventure',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Delete Edited adventure',exact:true}).click();
  await page.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Edited adventure',exact:true})).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test('black side, castling, promotion choices, engine MultiPV, and mobile layout work',async({page})=>{
  await english(page,'#/play/night-kingdom');
  await expect(page.locator('.selected-piece-card h3')).toHaveText('Black queen');
  await page.getByRole('button',{name:'Queen b3 ↓ 1 b2',exact:true}).click();
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toBeVisible();
  const analysis=await page.evaluate(async()=>{const {engine}=await import('/src/services/engine.js');return engine.analyze('7k/5K2/6Q1/8/8/8/8/8 w - - 0 1',{multiPV:4,movetime:600,depth:14});});
  expect(analysis.variations).toHaveLength(4);expect(analysis.variations[0].score.type).toBe('mate');
  await page.goto('/#/play/little-big-pawn');
  await expect(page.locator('.move-options>button')).toHaveCount(4);
  await page.goto('/#/play/safe-castle');
  await page.getByRole('button',{name:'King e1 ♔ ↔ ♖  g1',exact:true}).click();
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toBeVisible();
  await page.goto('/#/play/knight-hop');
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('group',{name:'The chessboard'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/chesscraft-mobile.png',fullPage:true});
});

test('desktop and teacher views have no runtime errors or missing font assets',async({page})=>{
  const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'A knight’s little leap'})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'test-results/chesscraft-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Teacher room',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Learning settings'})).toBeVisible();
  await page.getByRole('switch',{name:'Reduced motion'}).click();
  await expect(page.getByRole('switch',{name:'Reduced motion'})).toBeChecked();
  await page.screenshot({path:'test-results/chesscraft-teacher.png',fullPage:true});
  expect(errors).toEqual([]);expect(failed).toEqual([]);
});

test('two planned blocks execute in order with a real defensive reply between them',async({page})=>{
  await english(page,'#/play/royal-team');
  await page.getByRole('button',{name:'King c6 ↑ 1 c7',exact:true}).click();
  await page.getByRole('button',{name:'Plan ahead',exact:true}).click();
  await expect(page.getByRole('button',{name:'a7 Black King',exact:true})).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:'h3 White Queen',exact:true}).click();
  await page.getByRole('button',{name:'Queen h3 ← 7 a3',exact:true}).click();
  await expect(page.locator('.block-count')).toContainText('2 blocks');
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.getByRole('heading',{name:'Amazing! You did it!',level:2})).toBeVisible({timeout:15000});
  await expect(page.getByRole('button',{name:'a3 White Queen',exact:true})).toBeVisible();
});

test('stale dependent blocks stop safely, and reset ignores late engine work',async({page})=>{
  await english(page,'#/play/royal-team');
  const first=page.getByRole('button',{name:'King c6 ↑ 1 c7',exact:true});
  await first.click();await first.click();
  await page.getByRole('button',{name:/^Run code/}).click();
  await expect(page.locator('.invalid-block')).toHaveCount(1,{timeout:15000});
  await expect(page.getByRole('button',{name:'c7 White King',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'a7 Black King',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reset board',exact:true}).click();
  await page.getByRole('button',{name:'Clear blocks',exact:true}).click();
  await first.click();
  await page.getByRole('button',{name:/^Run code/}).click();
  await page.getByRole('button',{name:'Reset board',exact:true}).click();
  await expect(page.getByRole('button',{name:'c6 White King',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'a8 Black King',exact:true})).toBeVisible();
  await expect(page.locator('.invalid-block')).toHaveCount(0);
});

test('URL import uses the verified official Lichess response and FEN requires teacher confirmation',async({page})=>{
  await english(page);
  const data=JSON.parse(readFileSync(new URL('../fixtures/lichess.json',import.meta.url),'utf8'));
  await page.route('https://lichess.org/api/puzzle/iUIdn',route=>route.fulfill({json:data}));
  await page.getByRole('button',{name:'Add puzzle',exact:true}).click();
  await page.getByRole('tab',{name:'Import a link',exact:true}).click();
  await page.getByLabel('Lichess or Chess.com link').fill('https://lichess.org/training/iUIdn');
  await page.getByRole('button',{name:'Analyze & preview',exact:true}).click();
  await expect(page.getByText('Legal position',{exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByLabel('Student move limit',{exact:true})).toHaveValue('2');
  await expect(page.getByText('White to play',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'FEN position',exact:true}).click();
  await page.getByLabel('Enter your FEN position').fill('7k/5K2/6Q1/8/8/8/8/8 w - - 0 1');
  await page.getByRole('button',{name:'Analyze & preview',exact:true}).click();
  await expect(page.getByText('Legal position',{exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByLabel('Learning objective',{exact:true})).toHaveValue('mate');
  await expect(page.getByRole('button',{name:'Save & play',exact:true})).toBeDisabled();
  await page.getByLabel('I have reviewed and confirmed the objective').check();
  await expect(page.getByRole('button',{name:'Save & play',exact:true})).toBeEnabled();
});

test('cancelling a UCI request drains the old response before analyzing the next position',async({page})=>{
  await english(page);
  const result=await page.evaluate(async()=>{
    const {engine}=await import('/src/services/engine.js');const abort=new AbortController();
    const first=engine.analyze('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',{movetime:2000,depth:24,multiPV:4,signal:abort.signal,useCache:false}).catch(e=>e.name);
    const fen='7k/5K2/6Q1/8/8/8/8/8 w - - 0 1';
    const second=engine.analyze(fen,{movetime:500,depth:14,multiPV:3,useCache:false});
    setTimeout(()=>abort.abort(),20);return {first:await first,second:await second};
  });
  expect(result.first).toBe('AbortError');expect(result.second.fen).toBe('7k/5K2/6Q1/8/8/8/8/8 w - - 0 1');expect(result.second.variations[0].score.type).toBe('mate');
});
