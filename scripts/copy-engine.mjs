import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dest = path.join(root, 'public/engine');
await mkdir(dest, { recursive: true });
const bin = path.join(root, 'node_modules/stockfish/bin');
for (const name of await readdir(bin)) {
  if (/^stockfish-19-lite-single\.(js|wasm)$/.test(name)) await copyFile(path.join(bin, name), path.join(dest, name));
}
await copyFile(path.join(root, 'node_modules/stockfish/Copying.txt'), path.join(dest, 'COPYING.txt'));
const mediaDest = path.join(root, 'public/blockly-media');
await mkdir(mediaDest, { recursive: true });
for (const name of await readdir(path.join(root, 'node_modules/blockly/media'))) {
  if (/\.(svg|png|cur|gif)$/.test(name) || ['click.mp3', 'delete.mp3'].includes(name)) {
    await copyFile(path.join(root, 'node_modules/blockly/media', name), path.join(mediaDest, name));
  }
}
const licenses = {
  'React.txt': 'react/LICENSE', 'React-DOM.txt': 'react-dom/LICENSE',
  'chess-js.txt': 'chess.js/LICENSE', 'Blockly.txt': 'blockly/LICENSE',
  'Lucide.txt': 'lucide-react/LICENSE', 'Motion.txt': 'motion/LICENSE.md',
  'PGN-parser.txt': '@mliebelt/pgn-parser/LICENSE', 'Nunito.txt': '@fontsource-variable/nunito/LICENSE',
  'DM-Sans.txt': '@fontsource-variable/dm-sans/LICENSE', 'Stockfish-GPL-3.txt': 'stockfish/Copying.txt',
};
await mkdir(path.join(root, 'public/licenses'), { recursive: true });
for (const [name, source] of Object.entries(licenses)) await copyFile(path.join(root, 'node_modules', source), path.join(root, 'public/licenses', name));
