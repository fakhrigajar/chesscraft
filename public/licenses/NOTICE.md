# Third-party software

Chesscraft bundles these libraries and fonts. Their license texts are copied into this directory from `node_modules` by `scripts/copy-engine.mjs` during installation and builds.

- React and React DOM — MIT (`React.txt`, `React-DOM.txt`)
- chess.js — BSD-2-Clause (`chess-js.txt`)
- Blockly — Apache-2.0 (`Blockly.txt`), including the original `click.mp3` and `delete.mp3` interface sounds in `/blockly-media/`. These are the same unmodified Blockly audio files used by Code.org's Minecraft lesson at `https://studio.code.org/courses/mc/units/1/lessons/1/levels/1`.
- @mliebelt/pgn-parser — MIT (`PGN-parser.txt`)
- Motion — MIT (`Motion.txt`)
- Lucide — ISC (`Lucide.txt`)
- Nunito and DM Sans — SIL Open Font License (`Nunito.txt`, `DM-Sans.txt`)
- Stockfish.js 19.0.1 — GPL-3.0 (`Stockfish-GPL-3.txt`, also `/engine/COPYING.txt`)

The unmodified Stockfish 19 lite single-threaded JavaScript/WASM worker comes from the `stockfish@19.0.1` npm distribution. Matching complete corresponding source, build scripts, and source download:

- https://github.com/nmrugg/stockfish.js/tree/v19.0.1
- https://github.com/nmrugg/stockfish.js/archive/refs/tags/v19.0.1.tar.gz
- Release commit: `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`

The engine's own copyright and license notices remain intact. Stockfish communicates with the application through the public UCI protocol in a Web Worker.

Puzzle URLs and public API data remain subject to their respective providers' usage terms. Chesscraft uses official public endpoints and does not access protected puzzle data. The bundled Lichess test fixture records only public puzzle/game notation.
