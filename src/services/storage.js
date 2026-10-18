import { Chess, fromUci } from './chess.js';
import { goalAchieved } from './objectives.js';
import { inferSourceObjective } from './continuation.js';

const PREFIX = 'chesscraft.v1.';
let storageWarning = false;
export function readStore(key, fallback) {
  try { const value = localStorage.getItem(PREFIX + key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}
export function writeStore(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch { storageWarning = true; return false; }
}
export const hasStorageWarning = () => storageWarning;
// Keep English titles/descriptions from older saved puzzles and backups.
export function normalizePuzzle({ titleEn, descriptionEn, ...puzzle }) {
  const result = { ...puzzle, title: titleEn || puzzle.title, description: descriptionEn || puzzle.description || '' };
  const imported = ['pgn', 'lichess', 'lichess-study', 'chess.com-daily', 'lichess.org', 'chess.com', 'duplicate'].includes(puzzle.source?.type);
  if (puzzle.importVersion >= 3 || !imported) return result;
  result.importVersion = 3;
  if (puzzle.solution?.length && !puzzle.recordedObjective) {
    try {
      const inferred = inferSourceObjective(puzzle.initialFen, puzzle.solution);
      result.recordedObjective = inferred;
      // Earlier ambiguous PGNs defaulted to one student move and had no source
      // endpoint. Restore their full line, leaving current teacher overrides alone.
      if (inferred.type === 'strategic' && puzzle.objective?.type === 'strategic' && puzzle.objective.moves === 1 && (puzzle.objective.toleranceCp ?? 75) === 75 && Object.keys(puzzle.objective).every(key => ['type', 'moves', 'toleranceCp'].includes(key))) result.objective = { ...inferred };
    } catch { /* Invalid saved source data cannot enable recorded execution. */ }
  }
  // Older saves silently capped imported lessons at eight student moves. Repair
  // that cap once, using the source's actual goal, and preserve later overrides.
  if (puzzle.importVersion >= 2 || puzzle.objective?.moves !== 8 || !puzzle.solution?.length || ['strategic', 'defense'].includes(puzzle.objective.type)) return result;
  try {
    const game = new Chess(puzzle.initialFen);
    let studentMoves = 0;
    for (const uci of puzzle.solution) {
      if (game.isGameOver()) break;
      const move = game.move(fromUci(uci));
      if (move.color !== puzzle.studentColor) continue;
      studentMoves++;
      if (goalAchieved(game, puzzle.objective, puzzle.studentColor, move)) {
        if (studentMoves > 8) result.objective = { ...puzzle.objective, moves: studentMoves };
        break;
      }
    }
  } catch { /* Leave malformed legacy data for normal puzzle validation. */ }
  return result;
}
export const savePuzzle = (puzzles, puzzle) => {
  const result = [...puzzles.filter(p => p.id !== puzzle.id), { ...normalizePuzzle(puzzle), updatedAt: new Date().toISOString() }];
  if (!writeStore('puzzles', result)) throw new Error('storage');
  return result;
};
export function exportData(puzzles, progress) {
  const blob = new Blob([JSON.stringify({ app: 'chesscraft', version: 1, puzzles, progress, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'chesscraft-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
