import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess, fromUci, toUci } from '../src/services/chess.js';
import { importPgn, importLichessData } from '../src/services/importers.js';
import { recordedContinuation } from '../src/services/continuation.js';
import { validateStudentMove, opponentMove } from '../src/services/validation.js';
import { lessons } from '../src/data/lessons.js';

const study = () => importPgn(readFileSync(new URL('./fixtures/lichess-study.pgn', import.meta.url), 'utf8'));
const noEngine = { analyze() { assert.fail('A verified source continuation must not wait for engine analysis'); } };

async function solveSource(puzzle) {
  const game = new Chess(puzzle.initialFen);
  let studentMoves = 0;
  const results = [];
  for (let ply = 0; ply < puzzle.solution.length; ply++) {
    const uci = puzzle.solution[ply];
    if (game.turn() === puzzle.studentColor) {
      const result = await validateStudentMove({ fen: game.fen(), command: fromUci(uci), puzzle, studentMoves, history: game.history({ verbose: true }).map(toUci), engineService: noEngine });
      assert.equal(result.kind, 'correct', uci);
      assert.equal(result.complete, ply === puzzle.solution.length - 1, uci);
      game.move(result.move);
      studentMoves++;
      results.push(result);
    } else {
      const reply = await opponentMove({ game, puzzle, studentMoves, engineService: noEngine });
      assert.equal(reply, uci);
      game.move(fromUci(reply));
    }
  }
  return { game, studentMoves, results };
}

test('all twelve Windmill moves follow legal source continuations and complete only at the queen capture', async () => {
  const { game, studentMoves, results } = await solveSource(study());
  assert.equal(studentMoves, 12);
  assert.equal(results.at(-1).move.captured, 'q');
  assert.equal(game.get('a2').type, 'r');
});

test('the official Lichess puzzle also plays through to real checkmate without repeated analysis', async () => {
  const data = JSON.parse(readFileSync(new URL('./fixtures/lichess.json', import.meta.url), 'utf8'));
  const { game, studentMoves } = await solveSource(importLichessData(data, 'https://lichess.org/training/iUIdn'));
  assert.equal(studentMoves, 2);
  assert.equal(game.isCheckmate(), true);
});

test('changing a lesson goal or shortening its move budget invalidates the source shortcut', async () => {
  const puzzle = study(), game = new Chess(puzzle.initialFen);
  assert.ok(recordedContinuation(puzzle, game));
  puzzle.objective = { type: 'mate', moves: 1 };
  assert.equal(recordedContinuation(puzzle, game), null);
  const result = await validateStudentMove({ fen: game.fen(), command: fromUci('e3g5'), puzzle, engineService: noEngine });
  assert.equal(result.kind, 'incorrect');
  puzzle.objective = { type: 'capture', piece: 'q', moves: 8 };
  assert.equal(recordedContinuation(puzzle, game), null);
});

test('a line that reaches a draw before its goal cannot be used as a source continuation', () => {
  const puzzle = {
    initialFen: '7k/8/8/8/8/8/p7/R5K1 w - - 0 1', studentColor: 'w',
    objective: { type: 'capture', piece: 'p', moves: 5 },
    solution: ['a1b1','h8g8','b1a1','g8h8','a1b1','h8g8','b1a1','g8h8','a1a2'],
  };
  assert.equal(recordedContinuation(puzzle, new Chess(puzzle.initialFen)), null);
});

test('positions outside a verified continuation and incorrect moves still get a legal engine reply', async () => {
  const puzzle = lessons.find(p => p.id === 'royal-team');
  const game = new Chess(puzzle.initialFen);
  game.move(fromUci('c6b6'));
  let calls = 0;
  const engineService = { async analyze(fen) { calls++; assert.equal(fen, game.fen()); return { bestmove: 'a8b8' }; } };
  assert.equal(await opponentMove({ game, puzzle, studentMoves: 1, engineService }), 'a8b8');
  game.undo(); game.move(fromUci('c6c7'));
  engineService.analyze = async () => { calls++; return { bestmove: 'a8a7' }; };
  assert.equal(await opponentMove({ game, puzzle, studentMoves: 1, engineService, preferSource: false }), 'a8a7');
  assert.equal(calls, 2);
});

test('cancelled checks and opponent requests never execute even a known source move', async () => {
  const puzzle = study(), game = new Chess(puzzle.initialFen), controller = new AbortController();
  controller.abort();
  await assert.rejects(validateStudentMove({ fen: game.fen(), command: fromUci('e3g5'), puzzle, signal: controller.signal }), { name: 'AbortError' });
  game.move(fromUci('e3g5'));
  await assert.rejects(opponentMove({ game, puzzle, studentMoves: 1, signal: controller.signal }), { name: 'AbortError' });
});

test('ambiguous PGNs retain the full recorded line and finish after its final opponent reply', async () => {
  const puzzle = importPgn(readFileSync(new URL('./fixtures/opening-study.pgn', import.meta.url), 'utf8'));
  assert.deepEqual(puzzle.objective, { type: 'strategic', moves: 2, toleranceCp: 75 });
  assert.equal(puzzle.needsConfirmation, true);
  const game = new Chess(puzzle.initialFen);
  for (let studentMoves = 0; studentMoves < 2; studentMoves++) {
    const result = await validateStudentMove({ fen: game.fen(), command: fromUci(puzzle.solution[studentMoves * 2]), puzzle, studentMoves, history: game.history({ verbose: true }).map(toUci), engineService: noEngine });
    assert.equal(result.kind, 'correct');
    assert.equal(result.complete, false);
    game.move(result.move);
    game.move(fromUci(await opponentMove({ game, puzzle, studentMoves: studentMoves + 1, engineService: noEngine })));
    assert.equal(result.completeAfterReply === game.fen(), studentMoves === 1);
  }
  assert.equal(game.get('f3').type, 'n');
  assert.equal(game.get('c6').type, 'n');
});

test('recorded PGN variations can also reach their own final position', async () => {
  const puzzle = importPgn(readFileSync(new URL('./fixtures/opening-study.pgn', import.meta.url), 'utf8'));
  const game = new Chess(puzzle.initialFen);
  const result = await validateStudentMove({ fen: game.fen(), command: fromUci('d2d4'), puzzle, engineService: noEngine });
  assert.equal(result.kind, 'correct');
  assert.equal(result.complete, false);
  game.move(result.move);
  assert.equal(await opponentMove({ game, puzzle, studentMoves: 1, engineService: noEngine }), 'd7d5');
});

test('changing a strategic goal keeps engine validation for recorded moves', async () => {
  const puzzle = importPgn(readFileSync(new URL('./fixtures/opening-study.pgn', import.meta.url), 'utf8'));
  puzzle.objective = { ...puzzle.objective, toleranceCp: 0 };
  assert.equal(recordedContinuation(puzzle, new Chess(puzzle.initialFen)), null);
  let calls = 0;
  const result = await validateStudentMove({ fen: puzzle.initialFen, command: fromUci('e2e4'), puzzle, engineService: { async analyze() { calls++; return { variations: [{ whiteScore: { type: 'cp', value: 30 }, bound: false }] }; } } });
  assert.equal(calls, 2);
  assert.equal(result.kind, 'correct');
  assert.equal(result.complete, false);
});
