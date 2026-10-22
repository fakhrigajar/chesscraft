import { useState, useRef, useEffect, useCallback } from 'react';
import { Chess, legalMove, fromUci, toUci, ownPieces, positionKey } from '../services/chess.js';
import { engine } from '../services/engine.js';
import { validateStudentMove, importedMoves, opponentMove } from '../services/validation.js';
import { goalAchieved } from '../services/objectives.js';
import { readStore, writeStore } from '../services/storage.js';
import { playSound } from '../services/sound.js';

const delay = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
  const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
  const timer = setTimeout(done, ms);
  const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
  signal?.addEventListener('abort', abort, { once: true });
});
function restoredGame(puzzle) {
  const game = new Chess(puzzle.initialFen), session = readStore(`session.${puzzle.id}`, null);
  if (session?.initialFen !== puzzle.initialFen) return { game, processed: [], studentMoves: 0 };
  try {
    for (const uci of session.moves) game.move(fromUci(uci));
    if (game.turn() !== puzzle.studentColor || game.isGameOver()) return { game: new Chess(puzzle.initialFen), processed: [], studentMoves: 0 };
    return { game, processed: session.processed || [], studentMoves: session.studentMoves || 0 };
  } catch { return { game: new Chess(puzzle.initialFen), processed: [], studentMoves: 0 }; }
}

export function useChessLesson(puzzle, { sound, reducedMotion, exploration, onComplete, onAttempt, onNotice }) {
  const [initial] = useState(() => restoredGame(puzzle));
  const gameRef = useRef(initial.game);
  const [fen, setFen] = useState(initial.game.fen());
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState('ready');
  const [selected, setSelected] = useState(() => puzzle.select || ownPieces(initial.game, puzzle.studentColor).find(p => p.moves.length)?.square || null);
  const [lastMove, setLastMove] = useState(null);
  const [mistakeMove, setMistakeMove] = useState(null);
  const [processed, setProcessed] = useState(initial.processed);
  const processedRef = useRef(new Set(initial.processed));
  const [studentMoves, setStudentMoves] = useState(initial.studentMoves);
  const countRef = useRef(initial.studentMoves);
  const [activeBlock, setActiveBlock] = useState(null);
  const [invalidBlock, setInvalidBlock] = useState(null);
  const [hint, setHint] = useState(null);
  const hintLevel = useRef(0), runRef = useRef(false), pauseRef = useRef(false), controllerRef = useRef(null), retryRef = useRef(null);
  const callbacks = useRef({ onComplete, onAttempt, onNotice, sound, reducedMotion, exploration });
  callbacks.current = { onComplete, onAttempt, onNotice, sound, reducedMotion, exploration };
  const history = gameRef.current.history({ verbose: true });
  const publish = useCallback(move => {
    const game = gameRef.current;
    setLastMove(move || null); setFen(game.fen());
    setSelected(ownPieces(game, puzzle.studentColor).find(p => p.square === move?.to && p.moves.length)?.square || ownPieces(game, puzzle.studentColor).find(p => p.moves.length)?.square || null);
  }, [puzzle.studentColor]);
  const persist = useCallback(() => {
    writeStore(`session.${puzzle.id}`, { initialFen: puzzle.initialFen, moves: gameRef.current.history({ verbose: true }).map(toUci), processed: [...processedRef.current], studentMoves: countRef.current });
  }, [puzzle.id, puzzle.initialFen]);
  useEffect(() => () => { controllerRef.current?.abort(); runRef.current = false; }, []);
  const select = useCallback(square => {
    const game = gameRef.current, piece = game.get(square);
    if (runRef.current || ['complete', 'mistake'].includes(status)) return;
    if (piece?.color === puzzle.studentColor && game.turn() === puzzle.studentColor) { setSelected(square); setHint(null); }
  }, [puzzle.studentColor, status]);
  async function reply(signal, preferSource = true) {
    const game = gameRef.current;
    if (game.isGameOver() || game.turn() === puzzle.studentColor) return null;
    setFeedback('opponent');
    const expectedFen = game.fen();
    const uci = await opponentMove({ game, puzzle, studentMoves: countRef.current, signal, preferSource });
    if (signal.aborted || game.fen() !== expectedFen) throw new DOMException('Cancelled', 'AbortError');
    const command = fromUci(uci || '');
    if (!legalMove(game, command)) throw new Error('No legal engine reply');
    await delay(callbacks.current.reducedMotion ? 80 : 450, signal);
    const move = game.move(command); publish(move); playSound(callbacks.current.sound, move.captured ? 'capture' : 'move');
    await delay(callbacks.current.reducedMotion ? 100 : 650, signal);
    return move;
  }
  async function run(program, single = false) {
    if (runRef.current || status === 'complete' || (status === 'mistake' && !callbacks.current.exploration)) return;
    const pending = program.filter(block => !processedRef.current.has(block.id));
    if (!pending.length && gameRef.current.turn() === puzzle.studentColor) { setFeedback('noBlocks'); callbacks.current.onNotice?.('Add a move block, or reset the board to run your program again.'); return; }
    runRef.current = true; pauseRef.current = false; setInvalidBlock(null); setMistakeMove(null); setHint(null);
    const controller = new AbortController(); controllerRef.current?.abort(); controllerRef.current = controller;
    const signal = controller.signal;
    setStatus('thinking'); setFeedback('thinking');
    callbacks.current.onAttempt?.(puzzle.id);
    const finish = () => {
      setStatus('complete'); setFeedback('complete'); setHint(null);
      callbacks.current.onComplete?.(puzzle.id); playSound(callbacks.current.sound, 'complete');
      writeStore(`session.${puzzle.id}`, null);
    };
    try {
      if (gameRef.current.turn() !== puzzle.studentColor && !gameRef.current.isGameOver()) { await reply(signal); persist(); setFeedback('correct'); }
      for (const block of pending) {
        if (pauseRef.current || signal.aborted) break;
        const game = gameRef.current;
        if (game.isGameOver()) { setFeedback('uncertain'); setStatus('uncertain'); callbacks.current.onNotice?.('This position has ended. Reset the board to try again.'); break; }
        setActiveBlock(block.id); setStatus('thinking'); setFeedback('thinking');
        if (!legalMove(game, block.move)) {
          setFeedback('stale'); setInvalidBlock(block.id); setSelected(game.get(block.move.from)?.color === puzzle.studentColor ? block.move.from : null); setStatus('idle'); callbacks.current.onNotice?.('That block does not match the current board. Replace the highlighted move.'); break;
        }
        const snapshot = { moves: game.history({ verbose: true }).map(toUci), studentMoves: countRef.current, processed: [...processedRef.current] };
        const result = await validateStudentMove({ fen: game.fen(), command: block.move, puzzle, studentMoves: countRef.current, history: game.history({ verbose: true }).map(toUci), signal });
        if (signal.aborted) break;
        if (result.kind === 'illegal') { setFeedback('illegal'); setInvalidBlock(block.id); setStatus('idle'); callbacks.current.onNotice?.('That move is not legal here. Choose a highlighted destination.'); break; }
        if (result.kind === 'uncertain') { setFeedback('uncertain'); setStatus('uncertain'); callbacks.current.onNotice?.(result.error ? 'Move checking is unavailable. Try Run again.' : 'This move needs a closer look. Try another move or reset the board.'); break; }
        retryRef.current = snapshot;
        setStatus('running');
        const played = game.move(result.move); publish(played); playSound(callbacks.current.sound, played.captured ? 'capture' : 'move');
        setFeedback(result.kind);
        await delay(callbacks.current.reducedMotion ? 120 : 750, signal);
        if (result.kind === 'incorrect') {
          setMistakeMove(played);
          setInvalidBlock(block.id);
          let response = null;
          try { response = await reply(signal, false); } catch (error) { if (error.name === 'AbortError') throw error; }
          setFeedback(response ? 'consequence' : 'incorrect'); setStatus('mistake'); break;
        }
        countRef.current++; setStudentMoves(countRef.current);
        processedRef.current.add(block.id); setProcessed([...processedRef.current]);
        if (result.complete) {
          finish(); break;
        }
        await reply(signal);
        if (result.completeAfterReply === game.fen()) { finish(); break; }
        setFeedback(result.kind); playSound(callbacks.current.sound, 'correct');
        persist();
        if (single || pauseRef.current) { setStatus('paused'); break; }
        setStatus('idle');
      }
    } catch (error) {
      if (error.name !== 'AbortError') { setFeedback('uncertain'); setStatus('uncertain'); callbacks.current.onNotice?.('The puzzle could not continue. Try Run again or reset the board.'); }
    } finally {
      if (!signal.aborted) { setActiveBlock(null); setStatus(previous => ['thinking','running'].includes(previous) ? 'idle' : previous); }
      if (controllerRef.current === controller) runRef.current = false;
    }
  }
  function pause() { pauseRef.current = true; setStatus(previous => ['running','thinking'].includes(previous) ? previous : 'paused'); }
  function reset({ retry = false } = {}) {
    controllerRef.current?.abort(); runRef.current = false; pauseRef.current = false;
    const snapshot = retry ? retryRef.current : null, game = new Chess(puzzle.initialFen);
    if (snapshot) for (const uci of snapshot.moves) game.move(fromUci(uci));
    gameRef.current = game; countRef.current = snapshot?.studentMoves || 0; processedRef.current = new Set(snapshot?.processed || []);
    setStudentMoves(countRef.current); setProcessed([...processedRef.current]); publish(null);
    setSelected(puzzle.select && game.get(puzzle.select)?.color === puzzle.studentColor ? puzzle.select : ownPieces(game, puzzle.studentColor).find(p => p.moves.length)?.square || null);
    setStatus('idle'); setFeedback('ready'); setInvalidBlock(null); setMistakeMove(null); setActiveBlock(null); setHint(null); hintLevel.current = 0;
    persist();
  }
  async function getHint() {
    if (runRef.current || status === 'complete') return;
    const game = gameRef.current, requestFen = game.fen();
    if (game.turn() !== puzzle.studentColor) return;
    controllerRef.current?.abort(); const controller = new AbortController(); controllerRef.current = controller;
    setHint({ loading: true });
    let candidates = importedMoves(puzzle, requestFen);
    try {
      // Include every legal immediate goal, even one the engine would not rank highly.
      for (const m of game.moves({ verbose: true })) { const next = new Chess(requestFen); next.move(m); if (goalAchieved(next, puzzle.objective, puzzle.studentColor, m)) candidates.unshift(toUci(m)); }
      try {
        const analysis = await engine.analyze(requestFen, { multiPV: 5, signal: controller.signal, movetime: 800 });
        candidates = [...new Set([...candidates, ...analysis.variations.map(v => v.pv[0])])];
      } catch (error) { if (error.name === 'AbortError') throw error; }
      let found;
      for (const uci of candidates) {
        const command = fromUci(uci), valid = legalMove(game, command); if (!valid) continue;
        const result = await validateStudentMove({ fen: requestFen, command, puzzle, studentMoves: countRef.current, signal: controller.signal });
        if (['correct', 'alternative'].includes(result.kind)) { found = valid; break; }
      }
      if (controller.signal.aborted || gameRef.current.fen() !== requestFen) return;
      if (!found) { setHint({ unavailable: true }); return; }
      const level = Math.min(3, ++hintLevel.current); setSelected(found.from); setHint({ level, move: found });
    } catch (error) { if (error.name !== 'AbortError') setHint({ unavailable: true }); }
  }
  return { fen, status, feedback, selected, select, setSelected, lastMove, mistakeMove, processed, studentMoves, activeBlock, invalidBlock, hint, history, run, pause, reset, getHint, busy: ['thinking','running'].includes(status), game: gameRef.current };
}
