import { parse } from '@mliebelt/pgn-parser';
import { Chess, validateFen, toUci, fromUci, positionKey } from './chess.js';
import { inferSourceObjective } from './continuation.js';
import { ImportError } from './importErrors.js';
import { fetchPublicSource } from './publicSource.js';

export { ImportError } from './importErrors.js';
const newId = () => `puzzle-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
function basePuzzle(initialFen, extra = {}) {
  const valid = validateFen(initialFen);
  if (!valid.ok) throw new ImportError('invalidFen', valid.error);
  const game = new Chess(initialFen);
  if (game.isGameOver()) throw new ImportError('finishedPosition');
  return { id: newId(), importVersion: 3, title: '', description: '', initialFen: game.fen(), studentColor: game.turn(), solution: [], variations: [], solutionMap: {}, objective: { type: 'strategic', moves: 1, toleranceCp: 75 }, difficulty: 1, ageGroup: '5–9', theme: '', source: { type: 'teacher' }, createdAt: new Date().toISOString(), needsConfirmation: true, ...extra };
}

export function importFen(text) { return basePuzzle(text.trim(), { source: { type: 'fen', raw: text.trim() } }); }

export function importPgn(text, { startPly, source } = {}) {
  if (!text.trim()) throw new ImportError('empty');
  if (text.length > 250000) throw new ImportError('tooLarge');
  let parsed;
  try { const games = parse(text.trim(), { startRule: 'games' }); if (games.length !== 1) throw new ImportError('oneGame'); parsed = games[0]; }
  catch (error) { if (error instanceof ImportError) throw error; throw new ImportError('invalidPgn', error.message); }
  const tags = parsed.tags || {};
  let game;
  try { game = new Chess(tags.FEN || undefined); } catch (error) { throw new ImportError('invalidFen', error.message); }
  const originFen = game.fen(), history = [{ fen: originFen, san: 'Start', ply: 0 }];
  const sourceMoves = parsed.moves || [];
  try {
    for (const node of sourceMoves) { const move = game.move(node.notation.notation); history.push({ fen: game.fen(), san: move.san, ply: history.length }); }
  } catch (error) { throw new ImportError('illegalPgn', error.message); }
  const isHistory = !tags.FEN && startPly === undefined;
  const ply = startPly ?? 0;
  if (!Number.isInteger(ply) || ply < 0 || ply >= history.length) throw new ImportError('invalidPly');
  const initialFen = history[ply].fen;
  const solutionMap = {}, variations = [];
  let nodeCount = 0;
  function walk(nodes, fen, prefix = []) {
    const current = new Chess(fen), line = [...prefix];
    for (const node of nodes) {
      if (++nodeCount > 10000) throw new ImportError('tooLarge');
      const before = current.fen();
      for (const variation of node.variations || []) walk(variation, before, line);
      let move;
      try { move = current.move(node.notation.notation); } catch (error) { throw new ImportError('illegalVariation', error.message); }
      const key = positionKey(before), uci = toUci(move);
      solutionMap[key] ||= [];
      if (!solutionMap[key].includes(uci)) solutionMap[key].push(uci);
      line.push(uci);
    }
    if (line.length) variations.push(line);
    return line;
  }
  const solution = walk(sourceMoves.slice(ply), initialFen);
  const objective = inferSourceObjective(initialFen, solution);
  const puzzle = basePuzzle(initialFen, { title: tags.Event && tags.Event !== '?' ? tags.Event : '', select: solution[0]?.slice(0, 2), solution, variations, solutionMap, objective, recordedObjective: { ...objective }, source: source || { type: 'pgn', raw: text, tags }, needsConfirmation: objective.type === 'strategic', history, originFen, startPly: ply, needsStartPly: isHistory });
  return puzzle;
}

export function importLichessData(data, url) {
  if (!data?.puzzle || !data?.game?.pgn || !Array.isArray(data.puzzle.solution)) throw new ImportError('missingData');
  const game = new Chess();
  try { game.loadPgn(data.game.pgn); } catch (error) { throw new ImportError('invalidPgn', error.message); }
  const history = game.history({ verbose: true });
  // Lichess initialPly is the ZERO-BASED index of the last setup half-move.
  // Replay that move as well: e.g. initialPly 75 means 76 setup half-moves.
  const initialPly = data.puzzle.initialPly;
  if (!Number.isInteger(initialPly) || initialPly < 0 || initialPly >= history.length) throw new ImportError('invalidPly');
  const setup = new Chess();
  for (const move of history.slice(0, initialPly + 1)) setup.move(move);
  if (data.puzzle.fen) {
    let apiPosition;
    try { apiPosition = new Chess(data.puzzle.fen); } catch { throw new ImportError('invalidFen'); }
    if (positionKey(apiPosition.fen()) !== positionKey(setup.fen())) throw new ImportError('invalidSourceSolution');
  }
  const initialFen = data.puzzle.fen || setup.fen(), solutionMap = {}, solution = data.puzzle.solution;
  const verify = new Chess(initialFen);
  try {
    for (const uci of solution) { const key = positionKey(verify.fen()); verify.move(fromUci(uci)); (solutionMap[key] ||= []).push(uci); }
  } catch (error) { throw new ImportError('invalidSourceSolution', error.message); }
  const objective = inferSourceObjective(initialFen, solution);
  return basePuzzle(initialFen, { title: `Lichess · ${data.puzzle.id}`, select: solution[0]?.slice(0, 2), solution, variations: [solution], solutionMap, objective, recordedObjective: { ...objective }, needsConfirmation: objective.type === 'strategic', theme: data.puzzle.themes?.join(', ') || '', difficulty: data.puzzle.rating < 1200 ? 1 : data.puzzle.rating < 1800 ? 2 : 3, source: { type: 'lichess', url, puzzleId: data.puzzle.id, initialPly, rating: data.puzzle.rating, themes: data.puzzle.themes, gamePgn: data.game.pgn } });
}

export async function importUrl(text, { signal, startPly } = {}) {
  if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
  let url;
  try { url = new URL(text.trim()); } catch { throw new ImportError('invalidUrl'); }
  if (url.protocol !== 'https:') throw new ImportError('httpsOnly');
  const host = url.hostname.replace(/^www\./, '');
  if (!['lichess.org', 'chess.com'].includes(host)) throw new ImportError('unsupportedUrl');
  const fen = url.searchParams.get('fen'), pgn = url.searchParams.get('pgn');
  if (fen) return { ...importFen(fen), source: { type: host, url: url.href } };
  if (pgn) return importPgn(pgn, { startPly, source: { type: host, url: url.href } });
  if (host === 'lichess.org') {
    const match = url.pathname.match(/^\/training\/([a-zA-Z0-9]{5}|daily)\/?$/);
    if (match) return importLichessData(await fetchPublicSource(`https://lichess.org/api/puzzle/${match[1]}`, { signal }), url.href);
    const study = url.pathname.match(/^\/study\/([a-zA-Z0-9]{8})(?:\/([a-zA-Z0-9]{8}))?\/?$/);
    if (study) {
      const pgnText = await fetchPublicSource(`https://lichess.org/api/study/${study[1]}${study[2] ? `/${study[2]}` : ''}.pgn`, { signal, asText: true });
      return importPgn(pgnText, { startPly, source: { type: 'lichess-study', url: url.href, raw: pgnText } });
    }
  }
  if (host === 'chess.com' && /^\/(daily-chess-puzzle|puzzles\/daily)\/?$/.test(url.pathname)) {
    const data = await fetchPublicSource('https://api.chess.com/pub/puzzle', { signal });
    if (!data.pgn) throw new ImportError('missingData');
    return importPgn(data.pgn, { startPly, source: { type: 'chess.com-daily', url: data.url || url.href, raw: data.pgn } });
  }
  throw new ImportError(host === 'chess.com' ? 'chessComRestricted' : 'unsupportedUrl');
}

export async function analyzeImport(puzzle, engineService, signal) {
  if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
  // Recorded moves have already been checked for legality by the importer.
  // Engine analysis remains authoritative during play; it need not delay this preview.
  if (puzzle.solution.length || puzzle.needsStartPly) return puzzle;
  const analysis = await engineService.analyze(puzzle.initialFen, { depth: 19, movetime: 1800, multiPV: 5, signal });
  const best = analysis.variations[0];
  const inferred = best?.score.type === 'mate' && best.score.value > 0 && !best.bound ? { type: 'mate', moves: best.score.value } : puzzle.objective;
  return { ...puzzle, select: puzzle.select || analysis.bestmove?.slice(0, 2), objective: puzzle.source.type === 'fen' ? inferred : puzzle.objective, enginePreview: analysis, needsConfirmation: puzzle.needsConfirmation || puzzle.source.type === 'fen' };
}
