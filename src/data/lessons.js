import { Chess, fromUci, positionKey } from '../services/chess.js';

const examples = [
  { id: 'knight-hop', title: 'A knight’s little leap', description: 'Help your knight reach f3. Knights jump in an L shape!', initialFen: '4k3/pp3ppp/8/3p4/8/8/PPP2PPP/R3K1NR w KQ - 0 1', objective: { type: 'reach', piece: 'n', target: 'f3', moves: 1 }, solution: ['g1f3'], select: 'g1', icon: 'n', difficulty: 1, theme: 'movement', color: '#ede6f8' },
  { id: 'pawn-trail', title: 'A pawn’s first steps', description: 'Move the e2 pawn two squares forward to e4.', initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', objective: { type: 'reach', piece: 'p', target: 'e4', moves: 1 }, solution: ['e2e4'], select: 'e2', icon: 'p', difficulty: 1, theme: 'movement', color: '#fbefce' },
  { id: 'queen-treasure', title: 'The queen treasure', description: 'Find the opponent’s queen and capture it with your knight!', initialFen: '6k1/5ppp/8/5q2/3N4/8/5PPP/6K1 w - - 0 1', objective: { type: 'capture', piece: 'q', moves: 1 }, solution: ['d4f5'], select: 'd4', icon: 'q', difficulty: 1, theme: 'capture', color: '#f8e3ea' },
  { id: 'double-surprise', title: 'A double surprise', description: 'Attack the king and rook with one knight. That’s a fork!', initialFen: 'r3k3/5ppp/8/3N4/8/8/5PPP/4K3 w - - 0 1', objective: { type: 'fork', piece: 'n', moves: 1 }, solution: ['d5c7'], select: 'd5', icon: 'n', difficulty: 2, theme: 'tactics', color: '#e6eafa' },
  { id: 'royal-finale', title: 'Checkmate in one!', description: 'Guide your queen. Checkmate the king in just one move!', initialFen: '7k/5K2/6Q1/8/8/8/8/8 w - - 0 1', objective: { type: 'mate', moves: 1 }, solution: ['g6g7'], select: 'g6', icon: 'k', difficulty: 2, theme: 'checkmate', color: '#dff0e8' },
  { id: 'royal-team', title: 'The royal team', description: 'King and queen, one plan! Finish the mate after your opponent replies.', initialFen: 'k7/8/2K5/8/8/7Q/8/8 w - - 0 1', objective: { type: 'mate', moves: 2 }, solution: ['c6c7', 'a8a7', 'h3a3'], select: 'c6', icon: 'k', difficulty: 2, theme: 'checkmate', color: '#f9e5da' },
  { id: 'night-kingdom', title: 'The dark pieces’ adventure', description: 'This time you play the dark pieces. Find checkmate in one!', initialFen: '8/8/8/8/8/1q6/2k5/K7 b - - 0 1', objective: { type: 'mate', moves: 1 }, solution: ['b3b2'], select: 'b3', icon: 'q', difficulty: 2, theme: 'checkmate', color: '#e7e5f2' },
  { id: 'little-big-pawn', title: 'A little pawn’s big dream', description: 'Take the a7 pawn to the last rank and promote it to a queen!', initialFen: '7k/P7/5K2/8/8/8/8/8 w - - 0 1', objective: { type: 'reach', piece: 'q', target: 'a8', moves: 1 }, solution: ['a7a8q'], select: 'a7', icon: 'p', difficulty: 1, theme: 'special', color: '#fff0ce' },
  { id: 'safe-castle', title: 'A safe castle for the king', description: 'Move your king to g1. The rook will come along too!', initialFen: '4k3/ppp2ppp/8/8/8/8/PPP2PPP/R3K2R w KQ - 0 1', objective: { type: 'reach', piece: 'k', target: 'g1', moves: 1 }, solution: ['e1g1'], select: 'e1', icon: 'k', difficulty: 1, theme: 'special', color: '#dff0e8' },
];

export const lessons = examples.map((lesson, index) => {
  const game = new Chess(lesson.initialFen), solutionMap = {};
  for (const uci of lesson.solution) { (solutionMap[positionKey(game.fen())] ||= []).push(uci); game.move(fromUci(uci)); }
  return { ...lesson, number: index+1, studentColor: new Chess(lesson.initialFen).turn(), variations: [lesson.solution], solutionMap, ageGroup: '5–9', source: { type: 'chesscraft', author: 'Chesscraft' } };
});
