# Chesscraft

A working visual chess programming adventure for ages 5–9. React + Vite, **JavaScript**, Tailwind CSS, real Blockly workspaces, chess.js rules, and locally bundled Stockfish 19 WebAssembly. The app is English-only.

## Run locally

Requires **Node.js 22 or newer**.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. Installation copies the lightweight, single-threaded Stockfish build, Blockly media, and license files into `public/`. No paid API, engine service, account, or environment secret is required. Fonts and engine assets are served locally.

If that port is occupied, use `npm run dev -- --port 5187`.

## Static deployment

```sh
npm run build
```

Upload the generated **`dist/`** folder to a static host, such as GitHub Pages, Netlify, or Cloudflare Pages. No custom Node server, database, backend API, API key, or environment variables are needed. Relative asset paths support hosting under a subdirectory, and hash-based routes need no rewrite rules. Serve the files over HTTP(S); opening `index.html` as a local file cannot run the app's modules and workers correctly.

To preview the production build locally, run `npm start` and open **http://localhost:5187**. This is Vite's local preview server, not a backend you need to deploy. Node.js is used for installation, building, and local development only.

URL imports make direct browser requests to the public **Lichess API** or **Chess.com PubAPI**. PGN/FEN imports, chess rules, Stockfish analysis, and saved progress run locally in the browser. If a provider blocks access to a source, the importer offers PGN/FEN instead.

## Playing

1. Select one of your pieces on the board or in the piece picker.
2. Drag a legal move block into the workspace, or click it to append it. Clicking a highlighted board destination also adds a block; it does not play the move.
3. Connect movement blocks under **When we start** and press **Run code**. The opponent replies automatically between student turns.

The workspace supports destination dropdowns, drag reordering, accessible reorder/delete controls, undo/redo, clear, execution highlighting, pause after the current turn, step, board reset, and retry from the position before a mistake. The start block stays in place.

**Step-by-step mode** is the default: add a move, run it, then plan after the reply. **Plan ahead** previews queued moves with Stockfish's predicted defensive replies, allowing several student moves to be built before running. Predictions are revalidated during actual execution; stale blocks stop execution safely.

Nine verified example lessons cover knight and pawn movement, queen capture, a knight fork, multiple mate-in-one solutions, a two-turn forced mate, Black to move, promotion, and castling.

## Teacher tools and imports

- **PGN**: paste or upload a single PGN. FEN/SetUp tags, comments, annotations, promotions, castling, and recursive variations are parsed, and every imported variation is checked for legal moves. A complete game's history requires an explicit starting-ply selection; it is never silently treated as the puzzle solution.
- **FEN**: validates the position, analyzes candidate moves with Stockfish, and requires teacher confirmation of the inferred objective. A FEN is never treated as a recorded solution.
- **Lichess puzzles**: `https://lichess.org/training/{five-character-id}` or `/training/daily`. Uses the official public API. Its zero-based `initialPly` includes the last setup move; reconstructed positions are cross-checked against the API's FEN when supplied.
- **Lichess studies**: public `/study/{studyId}/{chapterId}` links use the official PGN export. A study export containing multiple games asks for a single chapter.
- **Chess.com**: supports the current public daily puzzle through the documented PubAPI and links containing explicit `fen` or `pgn` query parameters. Arbitrary puzzle/problem links do not expose a documented solution API; the app explains this and offers PGN/FEN import.

The importer shows a position preview, source information, objective, difficulty, move limit, and child-facing explanation before saving. Recorded solutions are checked for legal moves and previewed immediately, without waiting for Stockfish. FEN-only positions still get engine analysis and candidate moves. Successful source downloads are cached in memory for one minute (five minutes for a fixed Lichess puzzle), so reviewing a URL or selecting a different starting ply reuses the download. Requests can be cancelled and time out after ten seconds, including when the caller supplies its own cancellation signal.

Teacher overrides include target squares, piece types, and strategic evaluation tolerances. Candidate moves are proposals, not claims of verified objective equivalence.

The library supports search, categories, play, duplication, and editing/deletion of custom lessons. Teacher settings include sound, reduced motion, and exploration mode. Local progress is stored independently of puzzle definitions. The teacher room is a local management interface, not an authenticated permission boundary.

Puzzles, settings, progress, current game history, and workspaces persist in **LocalStorage** under `chesscraft.v1.*`. Backups can be exported/imported as JSON in the teacher room. There is no existing database in this checkout, and no student information is sent to an external engine service.

Older imported lessons affected by the accidental eight-move save cap recover their source goal's move count when loaded. Current imports and subsequent teacher overrides retain their chosen limits.

PGNs with no clear tactical objective use their reviewed recorded line as the lesson, including every student move and any final opponent reply. The preview explains this choice. Their source objective is saved separately, so changing the goal or evaluation tolerance returns execution to objective/engine validation. Earlier generic PGN saves recover the full source endpoint when loaded.

## How correctness works

`chess.js` generates legal moves; visual arrows never determine move legality. Commands use normalized `from`, `to`, and optional `promotion` fields.

`validation.js` combines imported position-indexed variations, explicit learning objectives, bounded tactical proofs, and actual Stockfish analysis. Imported PGN equality alone never determines correctness.

Recorded tactical moves use a quick continuation check: replay the legal source suffix from the actual position, preserve repetition history, and verify that it reaches the current objective within the remaining move budget. These moves do not repeat an expensive tactical search. Reviewed generic PGNs replay their recorded continuation to its actual final position. The opponent follows a verified recorded reply while that continuation applies. Plan-ahead previews use the same reply selection as execution. Alternative moves, changed goals, independent strategic evaluations, and positions outside a verified continuation still use the objective/engine checks; incorrect moves request the engine's strongest legal reply. Completion always checks the actual position.

- Immediate goals check the resulting position: actual checkmate, the specified capture or destination, check, fork, pin, skewer, or discovered check.
- Tactical continuation search checks **every legal defensive reply**, with a student-move budget. It runs in a separate worker and returns `unknown` when its node/time budget is exhausted.
- Mate distances are handled separately from centipawns. A Stockfish mate proof can validate a continuation within the remaining move budget.
- Independent strategic/defensive checks use the teacher's evaluation tolerance and defensive floor. Evaluations are normalized to the student's side, including after the side to move changes. Repetition history is preserved for actual move validation.
- A genuinely valid alternative is accepted and continued from its new position. A legal move that demonstrably fails the goal is played temporarily, followed by a legal strongest engine response when available, then a retry is offered. An illegal move never changes the board or triggers a reply.
- **Inconclusive analysis stays neutral and does not play the proposed move or display a definitive red X.** Deeper/open-ended tactics may require a shorter lesson or teacher review; finite browser analysis is not an exhaustive proof for every chess position.

Stockfish requests are serialized over one UCI worker. Cancellation drains the old `bestmove` response before issuing the next position. Reset/import changes cancel stale work. Analyses are cached by the complete FEN and analysis settings; engine timeouts and initialization failures have visible recovery states.

Run reports empty/exhausted programs, stale blocks, and unavailable or inconclusive checks through the existing notification area, so a stopped check is never silent. The program remains retryable after an analysis failure.

## Architecture

| Location | Responsibility |
|---|---|
| `src/components/Chessboard.jsx` | Board rendering, selection, legal targets, orientation, and animated pieces |
| `src/components/BlocklyWorkspace.jsx` | Real custom Blockly blocks, serialization, reordering, and undo/redo |
| `src/components/Toolbox.jsx` | Position-aware, side-correct legal movement blocks |
| `src/hooks/useChessLesson.js` | Authoritative game instance, sequential execution, replies, retry, hints, and resume |
| `src/services/chess.js` | Chess rules utilities and coordinate-to-arrow display |
| `src/services/engine.js` | Stockfish worker lifecycle, UCI queue, MultiPV, cancellation, and analysis cache |
| `src/services/objectives.js` | Extensible completion predicates and bounded AND/OR goal proofs |
| `src/services/objective.worker.js` | Off-thread tactical proof execution |
| `src/services/validation.js` | Hybrid, objective-specific student move validation |
| `src/services/continuation.js` | Legal source continuations that reach the current lesson goal |
| `src/services/importers.js` | PGN, FEN, official public URL imports, and objective inference |
| `src/services/publicSource.js` | Direct public API downloads, short-lived caching, cancellation, and timeouts |
| `src/services/storage.js` | Persistence and backups |
| `src/pages/` | Student adventure, home, library, import preview, and teacher room |

## Verification

```sh
npm test
npm run test:browser
npm run build
```

The rules/import suite covers the requested chess scenarios, alternative mates and captures, PGN variations and game histories, real Lichess response semantics, special moves, Black to move, objective proof uncertainty, score normalization, source endpoint validation, caching, cancellation, and timeouts.

The browser suite uses a real local Stockfish worker. It covers Blockly creation/undo/redo, legal incorrect moves and replies, alternative mate, multi-turn and multi-block execution, stale dependencies, cancellation/reset, teacher import and library management, FEN confirmation, MultiPV, desktop/mobile layouts, and missing assets/runtime errors. URL tests use a captured real official response for repeatability; a live Lichess import was separately verified during development.

Browser tests use installed Chrome on macOS when present. Elsewhere set `PLAYWRIGHT_CHROME` to a Chrome/Chromium executable path or adjust `playwright.config.js` for your Playwright installation.

## Third-party notices

See [`public/licenses/NOTICE.md`](public/licenses/NOTICE.md). License texts are copied from installed packages at install/build time. Original Chesscraft piece and mascot illustrations are SVG source in `src/components/Piece.jsx`.

Stockfish is a separate GPL-3.0 engine, distributed unmodified as a UCI worker. The matching upstream source for bundled **19.0.1** is [Stockfish.js v19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1), commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`. Its build scripts and complete corresponding source are available in that release. Retain the GPL license and corresponding-source access when redistributing the engine.
