import { Chess, legalMove, toUci, fromUci, positionKey } from './chess.js';
import { engine, scoreFor } from './engine.js';
import { goalAchieved, proveObjective } from './objectives.js';
import { recordedContinuation } from './continuation.js';

let proofId = 0;
export function proveAsync(fen, objective, side, remaining, signal, preferred = []) {
  if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  // Node tests use the identical pure search, while the browser always offloads it.
  if (typeof Worker === 'undefined') return Promise.resolve(proveObjective(fen, objective, side, remaining, { preferred }));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./objective.worker.js', import.meta.url), { type: 'module' });
    const id = ++proofId;
    const cleanup = () => { clearTimeout(timeout); worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timeout = setTimeout(() => { cleanup(); resolve({ result: null, error: 'Search timeout' }); }, 5000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => { if (data.id === id) { cleanup(); resolve(data); } };
    worker.onerror = () => { cleanup(); resolve({ result: null, error: 'Search unavailable' }); };
    worker.postMessage({ id, fen, objective, side, remaining, options: { preferred } });
  });
}
export function importedMoves(puzzle, fen) {
  return puzzle.solutionMap?.[positionKey(fen)] || [];
}
export async function validateStudentMove({ fen, command, puzzle, studentMoves = 0, history, signal, engineService = engine }) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  let game = new Chess(fen);
  if (history) {
    const replay = new Chess(puzzle.initialFen);
    for (const uci of history) replay.move(fromUci(uci));
    if (replay.fen() !== fen) throw new Error('Position and move history disagree');
    game = replay;
  }
  const move = legalMove(game, command);
  if (!move || game.turn() !== puzzle.studentColor) return { kind: 'illegal', complete: false };
  const imported = importedMoves(puzzle, fen).includes(toUci(move));
  const continuation = imported && recordedContinuation(puzzle, game, studentMoves, toUci(move));
  game.move(move);
  const objective = puzzle.objective;
  const result = { move, fen: game.fen(), complete: false, kind: imported ? 'correct' : 'alternative' };
  if (goalAchieved(game, objective, puzzle.studentColor, move)) return { ...result, complete: true };
  const remaining = (objective.moves || 1) - studentMoves - 1;
  if (['strategic', 'defense'].includes(objective.type)) {
    if (game.isCheckmate()) return { ...result, complete: true };
    if (game.isGameOver() && !objective.allowDraw) return { ...result, kind: 'incorrect', reason: 'draw' };
    if (continuation?.recordedStrategy) {
      return { ...result, complete: continuation.line.length === 1, completeAfterReply: continuation.line.length === 2 ? continuation.endFen : undefined };
    }
    try {
      const before = await engineService.analyze(fen, { signal, multiPV: 4 });
      const after = await engineService.analyze(game.fen(), { signal, multiPV: 1 });
      const best = scoreFor(before.variations[0], puzzle.studentColor), candidate = scoreFor(after.variations[0], puzzle.studentColor);
      if (!best || !candidate || before.variations[0].bound || after.variations[0].bound) return { ...result, kind: 'uncertain' };
      let accepted;
      if (best.type === 'mate' || candidate.type === 'mate') {
        // Never compare mate values to centipawns. Defense may retain a draw when losing.
        accepted = candidate.type === 'mate' && candidate.value > 0 && (best.type !== 'mate' || best.value < 0 || candidate.value <= best.value + (objective.mateTolerance || 0));
      } else accepted = candidate.value >= best.value - (objective.toleranceCp ?? 75) && (objective.type !== 'defense' || candidate.value >= (objective.minimumCp ?? -150));
      return { ...result, kind: accepted ? result.kind : 'incorrect', complete: accepted && studentMoves+1 >= (objective.moves || 1), analysis: after };
    } catch (error) { if (error.name === 'AbortError') throw error; return { ...result, kind: 'uncertain', error: error.message }; }
  }
  if (remaining <= 0 || game.isGameOver()) return { ...result, kind: 'incorrect', reason: 'objective' };
  if (continuation) return result;
  const proof = await proveAsync(game.fen(), objective, puzzle.studentColor, remaining, signal, puzzle.solution || []);
  if (proof.result === true) return result;
  if (proof.result === false) return { ...result, kind: 'incorrect', reason: 'objective' };
  try {
    const analysis = await engineService.analyze(game.fen(), { signal, multiPV: 3, movetime: 1600, depth: 20 });
    const best = scoreFor(analysis.variations[0], puzzle.studentColor);
    if (objective.type === 'mate' && best?.type === 'mate' && best.value > 0 && best.value <= remaining && !analysis.variations[0].bound) return { ...result, analysis };
    // An unproven tactic is neutral, even when absent from the source variation.
    return { ...result, kind: 'uncertain', analysis };
  } catch (error) { if (error.name === 'AbortError') throw error; return { ...result, kind: 'uncertain', error: error.message }; }
}

export async function opponentMove({ game, puzzle, studentMoves = 0, signal, preferSource = true, engineService = engine, movetime = 800, depth = 17 }) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (game.isGameOver() || game.turn() === puzzle.studentColor) return null;
  const source = preferSource && recordedContinuation(puzzle, game, studentMoves);
  if (source) return source.move;
  const analysis = await engineService.analyze(game.fen(), { signal, multiPV: 1, movetime, depth });
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (!analysis.bestmove || !legalMove(game, fromUci(analysis.bestmove))) throw new Error('No legal engine reply');
  return analysis.bestmove;
}
