export class ImportError extends Error {
  constructor(code, detail = '') { super(code); this.code = code; this.detail = detail; }
}

const errors = {
  "invalidFen": "This FEN position is invalid.",
  "finishedPosition": "This position is already game over. Choose another start.",
  "invalidPgn": "Could not read this PGN. Check the chess notation.",
  "illegalPgn": "The PGN contains an illegal move.",
  "illegalVariation": "A PGN variation contains an illegal move.",
  "empty": "Add some notation or a position first.",
  "oneGame": "Import one game or one study chapter at a time.",
  "tooLarge": "This file is too large. Import a single puzzle.",
  "invalidUrl": "Enter a valid URL.",
  "httpsOnly": "Please use an HTTPS link.",
  "unsupportedUrl": "Use a Lichess puzzle/study or a link with accessible FEN/PGN.",
  "chessComRestricted": "This Chess.com URL does not expose its solution through a public API. Import PGN or FEN instead. The current daily puzzle link is supported.",
  "network": "Could not reach the source. Check your connection or import PGN/FEN.",
  "networkTimeout": "The source took too long to respond. Try again or import PGN/FEN.",
  "inaccessible": "The source is not accessible. Use a public study chapter or PGN/FEN.",
  "rateLimit": "The source is rate limited. Please try again shortly.",
  "missingData": "The source is missing required puzzle data.",
  "invalidSourceSolution": "The source solution does not match its position. Import PGN/FEN instead.",
  "invalidPly": "Choose a valid starting ply for the puzzle."
};

export function importErrorText(error) {
  return errors[error.code] || 'Import failed. Check the source and try again.';
}
