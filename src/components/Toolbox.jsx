import { useMemo } from 'react';
import { Hand, MousePointer2, Crosshair, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { Chess, ownPieces, movement, PIECES } from '../services/chess.js';
import { Piece } from './Piece.jsx';


export function Toolbox({ fen, selected, onSelect, onAdd, studentColor, disabled }) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const pieces = ownPieces(game, studentColor).filter(p => p.moves.length), piece = game.get(selected || 'a0');
  const moves = selected && piece?.color === studentColor && game.turn() === studentColor ? game.moves({ square: selected, verbose: true }) : [];
  const types = [...new Set(pieces.map(p => p.type))];
  return <div className="toolbox-body">
    <div className="piece-picker" role="group" aria-label={"Choose your piece on the board"}>{types.map(type => {
      const options = pieces.filter(p => p.type === type), active = piece?.type === type;
      return <button key={type} className={`piece-tab ${active ? 'active' : ''}`} style={{ '--piece-color': PIECES[type].color }} disabled={disabled} onClick={() => { const index = options.findIndex(p => p.square === selected); onSelect(options[(index+1)%options.length].square); }} aria-label={`${PIECES[type].name} ${options.map(p=>p.square).join(', ')}`} aria-pressed={active}><Piece type={type} color={studentColor} size={34}/><span>{PIECES[type].name}</span></button>;
    })}</div>
    <div className="toolbox-divider"/>
    {piece?.color === studentColor ? <>
      <p className="eyebrow small-eyebrow">{"YOUR SELECTED PIECE"}</p>
      <div className="selected-piece-card" style={{ '--selected-color': PIECES[piece.type].color }}><div className="selected-piece-icon"><Piece type={piece.type} color={studentColor} size={49}/></div><div><h3>{(studentColor === 'w' ? "White" : "Black")} {PIECES[piece.type].name.toLowerCase()}</h3><p><span className="coordinate-tag">{selected}</span><span>{moves.length} {"legal moves"}</span></p></div><span className="selection-dot"/></div>
      <div className="drag-instruction"><Hand size={14}/><span>{"Drag a block or click to add it"}</span></div>
      <div className="move-options">{moves.map(move => {
        const way = movement(move);
        return <button key={move.lan} className="move-block" style={{ '--block-color': PIECES[piece.type].color }} draggable={!disabled} disabled={disabled} onClick={() => onAdd(move, moves)} onDragStart={event => { event.dataTransfer.setData('application/chesscraft', JSON.stringify({ move, options: moves })); event.dataTransfer.effectAllowed = 'copy'; }} aria-label={`${PIECES[piece.type].name} ${move.from} ${way.arrows} ${way.steps} ${move.to}${move.promotion ? ` ${move.promotion}` : ''}`}>
          <span className="block-notch"/><Piece type={piece.type} color={studentColor} size={34}/><strong>{move.from}</strong><span className="block-divider"/><span className={`block-direction ${piece.type === 'n' ? 'knight-direction' : ''}`}>{way.arrows}</span>{way.steps !== '' && <span className="step-bubble">{way.steps}</span>}<ArrowRight className="to-arrow" size={14}/><span className="destination-bubble">{move.to}{move.promotion && <><Crown size={11}/><Piece type={move.promotion} color={studentColor} size={24}/></>}</span>{move.captured && <Crosshair size={14} className="capture-icon"/>}
        </button>;
      })}</div>
      {piece.type === 'n' && <div className="piece-tip"><span className="tip-icon">L</span><div><strong>{'Knights love to leap!'}</strong><p>{'Two squares over, one square across.'}</p></div></div>}
      {piece.type !== 'n' && <div className="piece-tip"><Sparkles size={22}/><div><strong>{'One block, one move.'}</strong><p>{'The arrows show you the way.'}</p></div></div>}
    </> : <div className="toolbox-prompt"><MousePointer2 size={36}/><h3>{"Choose your piece on the board"}</h3></div>}
  </div>;
}
