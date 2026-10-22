import { Chess, fromUci, positionKey } from './chess.js';
import { goalAchieved } from './objectives.js';

const indexes = new WeakMap();

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
// Words in Lichess themes or PGN headers that name a goal we can verify.
const THEME_GOALS = [[/fork/i, 'fork'], [/pin/i, 'pin'], [/skewer/i, 'skewer'], [/discover/i, 'discovery']];

/** Reads what a recorded line achieves: mate, a named tactic, promotion, or won material.
 * `hints` (Lichess themes, PGN Event names) only select goals the line really reaches. */
export function inferSourceObjective(initialFen, line, hints = []) {
  const game = new Chess(initialFen), side = game.turn();
  const hinted = THEME_GOALS.filter(([pattern]) => hints.some(hint => pattern.test(hint))).map(([, type]) => type);
  let studentMoves = 0, queenCapture = false, last, tactic = null, promotion = null, balance = 0, best = null;
  for (const command of line) {
    last = game.move(typeof command === 'string' ? fromUci(command) : command);
    if (last.color !== side) { balance -= VALUES[last.captured] || 0; continue; }
    studentMoves++;
    if (last.captured === 'q') queenCapture = true;
    if (last.captured && (!best || VALUES[last.captured] > VALUES[best.piece])) best = { piece: last.captured, moves: studentMoves };
    balance += (VALUES[last.captured] || 0) + (last.promotion ? VALUES[last.promotion] - 1 : 0);
    if (last.promotion && !promotion) promotion = { type: 'reach', piece: last.promotion, target: last.to, promotion: true, moves: studentMoves };
    for (const type of tactic ? [] : hinted) {
      const goal = { type, ...(type === 'fork' ? { piece: last.piece } : {}) };
      if (goalAchieved(game, goal, side, last)) { tactic = { ...goal, moves: studentMoves }; break; }
    }
  }
  const moves = Math.max(1, studentMoves);
  if (game.isCheckmate() && game.turn() !== side) return { type: 'mate', moves };
  if (tactic) return tactic;
  if (queenCapture) return { type: 'capture', piece: 'q', moves };
  if (promotion && game.get(promotion.target)?.color === side) return promotion;
  if (last?.color === side && goalAchieved(game, { type: 'fork', piece: last.piece }, side, last)) return { type: 'fork', piece: last.piece, moves };
  // Winning at least a minor piece overall is a concrete goal; even trades are not.
  if (best && balance >= 3) return { type: 'capture', piece: best.piece, moves: best.moves };
  return { type: 'strategic', moves, toleranceCp: 75 };
}

export function usesRecordedStrategy(puzzle) {
  if (puzzle.objective.type !== 'strategic' || puzzle.recordedObjective?.type !== 'strategic') return false;
  const keys = new Set([...Object.keys(puzzle.objective), ...Object.keys(puzzle.recordedObjective)]);
  return [...keys].every(key => puzzle.objective[key] === puzzle.recordedObjective[key]);
}

function sourcePositions(puzzle) {
  const prior = indexes.get(puzzle);
  if (prior?.solution === puzzle.solution && prior.variations === puzzle.variations && prior.fen === puzzle.initialFen && prior.side === puzzle.studentColor) return prior.positions;
  const positions = new Map();
  const lines = [puzzle.solution, ...(puzzle.variations || [])].filter(line => line?.length);
  const seen = new Set();
  for (const line of lines) {
    const signature = line.join(' ');
    if (seen.has(signature)) continue;
    seen.add(signature);
    const game = new Chess(puzzle.initialFen), steps = [];
    let studentMoves = 0;
    try {
      for (let ply = 0; ply < line.length; ply++) {
        if (game.isGameOver()) break;
        steps.push({ key: positionKey(game.fen()), studentMoves, ply, line });
        const move = game.move(fromUci(line[ply]));
        if (move.color === puzzle.studentColor) studentMoves++;
      }
    } catch { continue; }
    for (const step of steps) {
      const entries = positions.get(step.key) || [];
      entries.push(step);
      positions.set(step.key, entries);
    }
  }
  indexes.set(puzzle, { solution: puzzle.solution, variations: puzzle.variations, fen: puzzle.initialFen, side: puzzle.studentColor, positions });
  return positions;
}

function copyGame(game) {
  const history = game.history({ verbose: true });
  const copy = new Chess(history[0]?.before || game.fen());
  for (const move of history) copy.move(move);
  return copy;
}

// Concrete goals require a source suffix that reaches that goal. A reviewed,
// unchanged strategic PGN uses its recorded endpoint. Both paths replay legal
// moves from the actual board, including repetition history and move limits.
export function recordedContinuation(puzzle, game, studentMoves = 0, nextMove) {
  if (game.isGameOver() || puzzle.objective.type === 'defense') return null;
  const strategy = usesRecordedStrategy(puzzle);
  if (puzzle.objective.type === 'strategic' && !strategy) return null;
  const remaining = (puzzle.objective.moves || 1) - studentMoves;
  if (remaining < 0) return null;
  const entries = sourcePositions(puzzle).get(positionKey(game.fen())) || [];
  for (const entry of entries) {
    if (entry.studentMoves !== studentMoves || (nextMove && entry.line[entry.ply] !== nextMove)) continue;
    const replay = copyGame(game);
    let used = 0;
    try {
      for (let ply = entry.ply; ply < entry.line.length && !replay.isGameOver(); ply++) {
        const move = replay.move(fromUci(entry.line[ply]));
        if (move.color !== puzzle.studentColor) continue;
        if (++used > remaining) break;
        if (!strategy && goalAchieved(replay, puzzle.objective, puzzle.studentColor, move)) return { move: entry.line[entry.ply], line: entry.line.slice(entry.ply) };
      }
      // For a reviewed PGN with no concrete tactical goal, the recorded final
      // position is the lesson endpoint. Goal overrides still require analysis.
      if (strategy && studentMoves + used === puzzle.objective.moves && replay.history().length === game.history().length + entry.line.length - entry.ply && (!replay.isGameOver() || (puzzle.objective.allowDraw && replay.isDraw()))) {
        return { move: entry.line[entry.ply], line: entry.line.slice(entry.ply), recordedStrategy: true, endFen: replay.fen() };
      }
    } catch { /* A saved source line that does not fit this position is ignored. */ }
  }
  return null;
}
