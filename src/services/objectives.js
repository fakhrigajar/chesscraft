import { Chess, PIECES, pieceAttacks, opposite, positionKey } from './chess.js';

export const OBJECTIVES = {
  reach: 'Reach a square',
  mate: 'Checkmate',
  capture: 'Capture a piece',
  fork: 'Create a fork',
  check: 'Give check',
  pin: 'Create a pin',
  skewer: 'Create a skewer',
  discovery: 'Discovered check',
  defense: 'Defend the position',
  strategic: 'Find a strong move',
};
export function objectiveDescription(objective) {
  const piece = PIECES[objective.piece]?.name.toLowerCase() || 'piece';
  const text = {
    mate: `Checkmate the opponent’s king in ${objective.moves || 1} move${(objective.moves || 1) === 1 ? '' : 's'}!`,
    capture: `Capture the opponent’s ${piece}!`,
    reach: objective.promotion ? `Promote your pawn to a ${piece} on ${objective.target}!` : `Help your ${piece} reach ${objective.target || '…'}!`,
    fork: 'Attack two important enemy pieces with one move!',
    check: 'Attack the opponent’s king. Give check!',
    pin: 'Pin an enemy piece in front of its king!',
    skewer: 'Line up two enemy pieces. When the important one moves, win the piece behind it!',
    discovery: 'Move a piece aside and let its friend behind it give check!',
    defense: 'Keep your king safe and stop your opponent’s plan!',
    strategic: 'Find a strong plan. There may be more than one smart way!',
  };
  return text[objective.type] || text.strategic;
}
// A short name for a puzzle, used when the source does not give one.
export function objectiveTitle(objective) {
  const piece = PIECES[objective.piece]?.name.toLowerCase() || 'piece', moves = objective.moves || 1;
  if (objective.type === 'mate') return `Checkmate in ${moves}`;
  if (objective.type === 'capture') return `Win the ${piece}`;
  if (objective.type === 'reach') return objective.promotion ? `A new ${piece}` : `${PIECES[objective.piece]?.name || 'Piece'} to ${objective.target}`;
  return OBJECTIVES[objective.type] || OBJECTIVES.strategic;
}
export function objectiveMistakeExplanation(objective) {
  const explanations = {
    mate: 'This plan did not make checkmate. Try to cover the king’s escape squares!',
    capture: 'Look for another way to capture the target piece!',
    reach: 'Try another path to reach your target square!',
    fork: 'A fork needs to attack two important pieces at the same time.',
    check: 'Look for a move that attacks the opponent’s king!',
  };
  return explanations[objective.type] || 'Let’s build another plan that keeps our mission on track!';
}
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
function alignedTargets(game, square, side) {
  const piece = game.get(square);
  if (!piece || !['b', 'r', 'q'].includes(piece.type)) return [];
  const directions = [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]].filter(([x, y]) => piece.type === 'q' || (piece.type === 'b' ? x && y : !x || !y));
  return directions.map(([dx,dy]) => {
    const targets = [];
    for (let n = 1; n < 8; n++) {
      const x = square.charCodeAt(0) + dx*n, y = Number(square[1]) + dy*n;
      if (x < 97 || x > 104 || y < 1 || y > 8) break;
      const p = game.get(String.fromCharCode(x)+y);
      if (p) { if (p.color === side) break; targets.push(p); if (targets.length === 2) break; }
    }
    return targets;
  });
}
export function goalAchieved(game, objective, side, lastMove, context = {}) {
  switch (objective.type) {
    case 'mate': return game.isCheckmate() && game.turn() === opposite(side);
    case 'reach': { const p = game.get(objective.target); return !!p && p.color === side && (!objective.piece || p.type === objective.piece); }
    case 'capture': return lastMove?.color === side && !!lastMove.captured && (!objective.piece || lastMove.captured === objective.piece) && (!objective.target || lastMove.to === objective.target);
    case 'check': return game.isCheck() && game.turn() === opposite(side);
    case 'fork': {
      if (!lastMove || lastMove.color !== side || (objective.piece && lastMove.piece !== objective.piece)) return false;
      // A pinned piece may geometrically attack a queen without being able to
      // capture it. Require real legal capture threats for non-king targets.
      const parts = game.fen().split(' '); parts[1] = side; parts[3] = '-';
      const captureThreats = new Chess(parts.join(' ')).moves({ square: lastMove.to, verbose: true });
      const targets = game.board().flat().filter(p => p && p.color !== side && (objective.targetTypes || ['k', 'q', 'r']).includes(p.type) && pieceAttacks(game, lastMove.to, p.square) && (p.type === 'k' || captureThreats.some(m => m.to === p.square && m.captured)));
      return targets.length >= (objective.count || 2);
    }
    case 'pin': return !!lastMove && lastMove.color === side && alignedTargets(game, lastMove.to, side).some(t => t.length === 2 && t[1].type === 'k' && t[0].type !== 'k');
    case 'skewer': return !!lastMove && lastMove.color === side && alignedTargets(game, lastMove.to, side).some(t => t.length === 2 && VALUES[t[0].type] > VALUES[t[1].type]);
    case 'discovery': return !!lastMove && lastMove.color === side && game.isCheck() && game.board().flat().some(p => p && p.color === side && p.square !== lastMove.to && pieceAttacks(game, p.square, game.board().flat().find(q => q?.type === 'k' && q.color !== side)?.square || 'a0'));
    case 'defense': case 'strategic': return !!context.strategyVerified && context.studentMoves >= (objective.moves || 1);
    default: return false;
  }
}

/** Bounded AND/OR search: every legal defense must still allow the student's goal.
 * Unknown propagates conservatively; an unfinished search never proves failure. */
export function proveObjective(fen, objective, side, remainingMoves, { maxNodes = 45000, timeLimit = 1600, preferred = [] } = {}) {
  const game = new Chess(fen), started = Date.now(), memo = new Map();
  let nodes = 0;
  const unknown = null;
  const visit = (remaining, lastMove, path) => {
    if (++nodes > maxNodes || Date.now() - started > timeLimit) return unknown;
    if (goalAchieved(game, objective, side, lastMove)) return true;
    if (remaining <= 0 || game.isGameOver()) return false;
    const key = `${positionKey(game.fen())}|${remaining}`;
    if (path.has(key)) return false;
    if (memo.has(key)) return memo.get(key);
    const student = game.turn() === side;
    const moves = game.moves({ verbose: true }).sort((a, b) => {
      const weight = m => (preferred.includes(m.from+m.to+(m.promotion||'')) ? 100 : 0) + (m.san.includes('#') ? 80 : 0) + (m.captured === objective.piece ? 30 : 0) + (m.captured ? 10 : 0) + (m.san.includes('+') ? 4 : 0);
      return weight(b)-weight(a);
    });
    if (!moves.length) return false;
    let uncertain = false;
    const nextPath = new Set(path).add(key);
    for (const move of moves) {
      const played = game.move(move);
      const won = goalAchieved(game, objective, side, played);
      const result = won || visit(remaining - (student ? 1 : 0), played, nextPath);
      game.undo();
      if (student && result === true) { memo.set(key, true); return true; }
      if (!student && result === false) { memo.set(key, false); return false; }
      if (result === unknown) uncertain = true;
      if (nodes > maxNodes || Date.now()-started > timeLimit) return unknown;
    }
    const result = uncertain ? unknown : !student;
    memo.set(key, result);
    return result;
  };
  const result = visit(remainingMoves, null, new Set());
  return { result, nodes, elapsed: Date.now()-started };
}
