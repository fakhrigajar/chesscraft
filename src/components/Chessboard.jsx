import { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Chess, PIECES } from '../services/chess.js';
import { Piece } from './Piece.jsx';

import { Star, X, Check } from 'lucide-react';

let pieceId = 0;
export function Chessboard({ fen, selected, onSelect, studentColor = 'w', flipped = false, lastMove, mistakeSquare, hint, target, disabled = false, feedback, reducedMotion = false, compact = false, onDestination }) {
  const previous = useRef({ fen: null, ids: new Map() });
  const game = useMemo(() => new Chess(fen), [fen]);
  const SquareElement = compact ? 'span' : 'button';
  const files = flipped ? 'hgfedcba' : 'abcdefgh', ranks = flipped ? '12345678' : '87654321';
  const squares = [...ranks].flatMap(rank => [...files].map(file => `${file}${rank}`));
  const legal = selected && game.turn() === studentColor ? game.moves({ square: selected, verbose: true }) : [];
  const ids = useMemo(() => {
    const old = previous.current, next = new Map(old.ids);
    if (old.fen !== fen) {
      if (lastMove?.before === old.fen) {
        const id = next.get(lastMove.from); next.delete(lastMove.from); next.delete(lastMove.to); if (id) next.set(lastMove.to, id);
        if (lastMove.flags?.includes('e')) next.delete(lastMove.to[0]+lastMove.from[1]);
        if (lastMove.flags?.includes('k') || lastMove.flags?.includes('q')) { const from = (lastMove.flags.includes('k') ? 'h' : 'a')+lastMove.from[1], to = (lastMove.flags.includes('k') ? 'f' : 'd')+lastMove.from[1]; const rookId = next.get(from); next.delete(from); if (rookId) next.set(to, rookId); }
      } else next.clear();
      for (const [square] of next) if (!game.get(square)) next.delete(square);
      for (const piece of game.board().flat().filter(Boolean)) if (!next.has(piece.square)) next.set(piece.square, `piece-${++pieceId}`);
      previous.current = { fen, ids: next };
    }
    return next;
  }, [fen, lastMove, game]);
  const king = game.isCheck() ? game.board().flat().find(p => p?.type === 'k' && p.color === game.turn())?.square : null;
  return <div className={`chessboard-frame ${compact ? 'compact' : ''}`}><div className="chessboard" role="group" aria-label={"The chessboard"}>
    <div className="board-squares">{squares.map((square, i) => {
      const piece = game.get(square), row = Math.floor(i/8), col = i%8;
      const destination = legal.some(m => m.to === square), chosen = selected === square, isHint = hint?.move && (hint.level === 1 ? hint.move.from === square : hint.move.from === square || hint.move.to === square);
      return <SquareElement key={square} type={compact ? undefined : 'button'} className={`square ${(Number(square[1])+square.charCodeAt(0))%2 ? 'light' : 'dark'} ${chosen ? 'selected' : ''} ${lastMove && [lastMove.from,lastMove.to].includes(square) ? 'last-move' : ''} ${king === square ? 'in-check' : ''} ${isHint ? 'hint-square' : ''}`} aria-label={compact ? undefined : `${square}${piece ? ` ${(piece.color === 'w' ? "White" : "Black")} ${PIECES[piece.type].name}` : ''}${destination ? ` ${"legal moves"}` : ''}`} aria-pressed={compact ? undefined : chosen} disabled={compact ? undefined : disabled} onClick={compact ? undefined : () => { if (piece?.color === studentColor) onSelect?.(square); else if (destination) onDestination?.(legal.find(m => m.to === square)); }}>
        {col === 0 && <span className="rank-label">{square[1]}</span>}{row === 7 && <span className="file-label">{square[0]}</span>}
        {destination && <span className={`legal-dot ${piece ? 'capture-ring' : ''}`}/>}
        {target === square && !piece && <Star className="target-star" size={compact ? 14 : 25} fill="currentColor"/>}
      </SquareElement>;
    })}</div>
    <div className="board-pieces" aria-hidden="true">{game.board().flat().filter(Boolean).map(piece => {
      const index = squares.indexOf(piece.square), col = index%8, row = Math.floor(index/8);
      return <motion.div key={ids.get(piece.square) || `${piece.color}${piece.type}${piece.square}`} className="board-piece" initial={false} animate={{ left: `${col*12.5}%`, top: `${row*12.5}%` }} transition={{ type: 'tween', duration: reducedMotion || compact ? 0 : 0.48, ease: [0.25,0.8,0.25,1] }}><Piece type={piece.type} color={piece.color}/></motion.div>;
    })}</div>
    {lastMove && ['incorrect','consequence'].includes(feedback) && <motion.div className="board-result wrong" key={`wrong-${mistakeSquare || lastMove.to}`} initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ left: `${(squares.indexOf(mistakeSquare || lastMove.to)%8+0.7)*12.5}%`, top: `${(Math.floor(squares.indexOf(mistakeSquare || lastMove.to)/8)+0.05)*12.5}%` }}><X size={20}/></motion.div>}
    {lastMove && ['correct','alternative'].includes(feedback) && <motion.div className="board-result right" key={`right-${lastMove.lan}`} initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ left: `${(squares.indexOf(lastMove.to)%8+0.7)*12.5}%`, top: `${(Math.floor(squares.indexOf(lastMove.to)/8)+0.05)*12.5}%` }}><Check size={18}/></motion.div>}
  </div></div>;
}
