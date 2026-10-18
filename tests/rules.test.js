import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, legalMove, ownPieces, fromUci, movement, positionKey } from '../src/services/chess.js';
import { goalAchieved, proveObjective } from '../src/services/objectives.js';
import { validateStudentMove } from '../src/services/validation.js';
import { importPgn, importFen, importLichessData, importUrl } from '../src/services/importers.js';
import { lessons } from '../src/data/lessons.js';
import { readFileSync } from 'node:fs';
import { allowedSource } from '../src/services/publicSource.js';

const pgn='[Event "Mate test"]\n[SetUp "1"]\n[FEN "7k/5K2/6Q1/8/8/8/8/8 w - - 0 1"]\n1. Qg7# (1. Qh6# {another solution}) 1-0';
test('every built-in lesson has a legal source line and a real completed goal',()=>{
  for(const p of lessons){const g=new Chess(p.initialFen);let last;for(const uci of p.solution)last=g.move(fromUci(uci));assert.ok(goalAchieved(g,p.objective,p.studentColor,last),p.id);}
});
test('PGN comments and recursive variations produce verified position-indexed solutions',()=>{
  const p=importPgn(pgn);assert.equal(p.studentColor,'w');assert.equal(p.objective.type,'mate');assert.deepEqual(p.solution,['g6g7']);assert.ok(p.variations.some(v=>v[0]==='g6h6'));assert.deepEqual(new Set(p.solutionMap[positionKey(p.initialFen)]),new Set(['g6g7','g6h6']));
});
test('recorded PGN move is accepted and actually checkmates',async()=>{
  const p=importPgn(pgn),r=await validateStudentMove({fen:p.initialFen,command:fromUci('g6g7'),puzzle:p});assert.equal(r.kind,'correct');assert.equal(r.complete,true);assert.ok(new Chess(r.fen).isCheckmate());
});
test('unrecorded, objectively valid checkmates are accepted independently of PGN',async()=>{
  const p=importPgn(pgn.replace(' (1. Qh6# {another solution})',''));
  for(const move of ['g6h6','g6g8','g6h5']){const r=await validateStudentMove({fen:p.initialFen,command:fromUci(move),puzzle:p});assert.equal(r.kind,'alternative',move);assert.equal(r.complete,true);}
});
test('legal wrong move fails the mate objective while illegal knight moves never execute',async()=>{
  const p=importPgn(pgn),r=await validateStudentMove({fen:p.initialFen,command:fromUci('g6g5'),puzzle:p});assert.equal(r.kind,'incorrect');assert.equal(r.complete,false);
  const n=lessons[0],before=n.initialFen,illegal=await validateStudentMove({fen:before,command:fromUci('g1f2'),puzzle:n});assert.equal(illegal.kind,'illegal');assert.equal(illegal.fen,undefined);assert.equal(n.initialFen,before);
  assert.ok(!ownPieces(new Chess(n.initialFen),'w').find(p=>p.square==='g1').moves.some(m=>m.to==='f2'));
});
test('black student sees black pieces and black pawn arrows match board coordinates',async()=>{
  const p=lessons.find(p=>p.studentColor==='b');assert.ok(ownPieces(new Chess(p.initialFen),'b').every(p=>p.color==='b'));const r=await validateStudentMove({fen:p.initialFen,command:fromUci('b3b2'),puzzle:p});assert.equal(r.kind,'correct');assert.equal(r.complete,true);assert.deepEqual(movement({piece:'p',from:'e7',to:'e5'}),{arrows:'↓',steps:2,special:''});
});
test('multi-turn mate has no mate in one, accepts the first move without completion, and finishes later',async()=>{
  const p=lessons.find(p=>p.id==='royal-team'),g=new Chess(p.initialFen);assert.ok(!g.moves().some(m=>m.includes('#')));
  const first=await validateStudentMove({fen:g.fen(),command:fromUci('c6c7'),puzzle:p});assert.equal(first.kind,'correct');assert.equal(first.complete,false);g.move(first.move);assert.equal(g.turn(),'b');assert.deepEqual(g.moves(),['Ka7']);g.move('Ka7');
  const last=await validateStudentMove({fen:g.fen(),command:fromUci('h3a3'),puzzle:p,studentMoves:1});assert.equal(last.complete,true);assert.ok(new Chess(last.fen).isCheckmate());
});
test('queen capture accepts two real capture routes, not a high evaluation unrelated to capture',async()=>{
  const p={...lessons[2],initialFen:'6k1/5ppp/8/5q2/3N3N/8/5PPP/6K1 w - - 0 1'};
  const r=await validateStudentMove({fen:p.initialFen,command:fromUci('h4f5'),puzzle:p});assert.equal(r.kind,'alternative');assert.equal(r.complete,true);
  const wrong=await validateStudentMove({fen:p.initialFen,command:fromUci('d4e6'),puzzle:p});assert.equal(wrong.kind,'incorrect');
});
test('castling, underpromotion, en passant, pins, king safety, and L-shaped jumps use legal chess rules',()=>{
  let g=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');assert.ok(legalMove(g,fromUci('e1g1')));assert.equal(movement(g.moves({verbose:true}).find(m=>m.lan==='e1g1')).special,'castle');g.move('O-O');assert.equal(g.get('f1').type,'r');
  g=new Chess('7k/P7/5K2/8/8/8/8/8 w - - 0 1');assert.equal(g.moves({square:'a7',verbose:true}).filter(m=>m.to==='a8').length,4);g.move(fromUci('a7a8n'));assert.equal(g.get('a8').type,'n');
  g=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');const ep=legalMove(g,fromUci('e5d6'));assert.ok(ep);assert.equal(movement(ep).special,'enPassant');g.move(ep);assert.equal(g.get('d5'),undefined);
  g=new Chess('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');assert.equal(legalMove(g,fromUci('e2d2')),null);assert.ok(legalMove(g,fromUci('e2e8')));assert.equal(legalMove(g,fromUci('e1e2')),null);
  assert.equal(movement({piece:'n',from:'g1',to:'f3'}).arrows,'↑2 ←1');
});
test('a full game PGN requires a deliberate start ply and never treats game history as the puzzle',()=>{
  const text='[Event "Opening history"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *',initial=importPgn(text);assert.equal(initial.needsStartPly,true);
  const p=importPgn(text,{startPly:4});assert.equal(p.needsStartPly,false);assert.equal(new Chess(p.initialFen).get('f3').type,'n');assert.deepEqual(p.solution,['f1b5','a7a6']);
});
test('Lichess uses initialPly and validates its real solution against the reconstructed board',()=>{
  const p=importLichessData({game:{pgn:'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6'},puzzle:{id:'abc12',initialPly:4,solution:['a7a6','b5c6','d7c6'],themes:[],rating:1000}},'https://lichess.org/training/abc12');
  assert.equal(p.studentColor,'b');assert.equal(new Chess(p.initialFen).get('b5').type,'b');assert.deepEqual(p.solution,['a7a6','b5c6','d7c6']);
  assert.throws(()=>importLichessData({game:{pgn:'1. e4 e5'},puzzle:{initialPly:0,solution:['e2e5']}},''));
});
test('unsupported Chess.com puzzle URLs give an honest PGN/FEN fallback',async()=>{
  await assert.rejects(importUrl('https://www.chess.com/puzzles/problem/12345'),e=>e.code==='chessComRestricted');await assert.rejects(importUrl('https://evil.example/training/abc12'),e=>e.code==='unsupportedUrl');
});
test('the real Lichess response reconstructs all 76 setup plies and matches its authoritative FEN',()=>{
  const data=JSON.parse(readFileSync(new URL('./fixtures/lichess.json',import.meta.url),'utf8'));
  const p=importLichessData(data,'https://lichess.org/training/iUIdn');assert.equal(p.initialFen,data.puzzle.fen);assert.equal(p.studentColor,'w');assert.deepEqual(p.objective,{type:'mate',moves:2});
  const g=new Chess(p.initialFen);for(const u of p.solution)g.move(fromUci(u));assert.ok(g.isCheckmate());
});
test('public-source requests accept only the supported official API endpoints',()=>{
  assert.ok(allowedSource('https://lichess.org/api/puzzle/iUIdn'));assert.ok(allowedSource('https://lichess.org/api/study/abcdefgh/ABCDEFGH.pgn'));assert.ok(allowedSource('https://api.chess.com/pub/puzzle'));
  for(const url of ['http://lichess.org/api/puzzle/daily','https://lichess.org.evil.test/api/puzzle/daily','https://localhost/api/puzzle/daily','https://user:pass@lichess.org/api/puzzle/daily','https://lichess.org:123/api/puzzle/daily','https://lichess.org/api/account','https://lichess.org/api/puzzle/daily?url=https://evil.test'])assert.equal(allowedSource(url),false,url);
});
test('invalid FEN, invalid PGN variations, and completed positions cannot be imported',()=>{
  assert.throws(()=>importFen('bad fen'));assert.throws(()=>importPgn(pgn.replace('Qh6#','Qh2#')));assert.throws(()=>importFen('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1'));
});
test('an inconclusive goal search returns neutral rather than a definitive wrong answer',()=>{
  const result=proveObjective(lessons[5].initialFen,lessons[5].objective,'w',2,{maxNodes:0});assert.equal(result.result,null);
});
test('strategic score comparison is normalized to the student, and mate scores stay separate',async()=>{
  const p={...lessons[1],objective:{type:'strategic',moves:1,toleranceCp:50}};
  const stub={analyze:async fen=>({variations:[{whiteScore:{type:'cp',value:fen.split(' ')[1]==='w'?40:25},bound:false}]})};
  const r=await validateStudentMove({fen:p.initialFen,command:fromUci('e2e4'),puzzle:p,engineService:stub});assert.equal(r.complete,true);
  const losing={analyze:async fen=>({variations:[{whiteScore:{type:fen.split(' ')[1]==='w'?'cp':'mate',value:fen.split(' ')[1]==='w'?40:-3},bound:false}]})};
  const bad=await validateStudentMove({fen:p.initialFen,command:fromUci('e2e4'),puzzle:p,engineService:losing});assert.equal(bad.kind,'incorrect');
});
