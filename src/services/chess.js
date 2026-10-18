import { Chess, validateFen } from "chess.js";

export { Chess, validateFen };
export const PIECES = {
  p: { name: "Pawn", color: "#e8b854" },
  n: { name: "Knight", color: "#a88bda" },
  b: { name: "Bishop", color: "#73b6d9" },
  r: { name: "Rook", color: "#e28e7e" },
  q: { name: "Queen", color: "#d996b5" },
  k: { name: "King", color: "#81b89c" },
};
export const opposite = (color) => (color === "w" ? "b" : "w");
export const positionKey = (fen) => fen.split(" ").slice(0, 4).join(" ");
export const toUci = (move) => `${move.from}${move.to}${move.promotion || ""}`;
export const fromUci = (uci) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  ...(uci[4] ? { promotion: uci[4] } : {}),
});
export function legalMove(game, command) {
  if (!command?.from || !command?.to) return null;
  return (
    game
      .moves({ square: command.from, verbose: true })
      .find(
        (m) =>
          m.to === command.to &&
          (m.promotion || "") === (command.promotion || ""),
      ) || null
  );
}
export function movement(move) {
  if (move.flags?.includes("k"))
    return {
      arrows: move.color === "b" ? "♚ ↔ ♜" : "♔ ↔ ♖",
      steps: "",
      special: "castle",
    };
  if (move.flags?.includes("q"))
    return {
      arrows: move.color === "b" ? "♜ ↔ ♚" : "♖ ↔ ♔",
      steps: "",
      special: "castle",
    };
  const dx = move.to.charCodeAt(0) - move.from.charCodeAt(0);
  const dy = Number(move.to[1]) - Number(move.from[1]);
  if (move.piece === "n")
    return {
      arrows: `${dy > 0 ? "↑" : "↓"}${Math.abs(dy)} ${dx > 0 ? "→" : "←"}${Math.abs(dx)}`,
      steps: "",
      special: "jump",
    };
  const arrows =
    dy > 0
      ? dx > 0
        ? "↗"
        : dx < 0
          ? "↖"
          : "↑"
      : dy < 0
        ? dx > 0
          ? "↘"
          : dx < 0
            ? "↙"
            : "↓"
        : dx > 0
          ? "→"
          : "←";
  return {
    arrows,
    steps: Math.max(Math.abs(dx), Math.abs(dy)),
    special: move.promotion
      ? "promotion"
      : move.flags?.includes("e")
        ? "enPassant"
        : move.captured
          ? "capture"
          : "",
  };
}
export function pieceAttacks(game, from, to) {
  const p = game.get(from);
  if (!p || from === to) return false;
  const dx = to.charCodeAt(0) - from.charCodeAt(0),
    dy = Number(to[1]) - Number(from[1]);
  if (p.type === "n") return Math.abs(dx) * Math.abs(dy) === 2;
  if (p.type === "k") return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (p.type === "p")
    return Math.abs(dx) === 1 && dy === (p.color === "w" ? 1 : -1);
  if (
    !(
      p.type === "q" ||
      (p.type === "b" && Math.abs(dx) === Math.abs(dy)) ||
      (p.type === "r" && (!dx || !dy))
    )
  )
    return false;
  if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let n = 1; n < steps; n++) {
    if (
      game.get(
        String.fromCharCode(from.charCodeAt(0) + Math.sign(dx) * n) +
          (Number(from[1]) + Math.sign(dy) * n),
      )
    )
      return false;
  }
  return true;
}
export function ownPieces(game, color) {
  return game
    .board()
    .flat()
    .filter((p) => p && p.color === color)
    .map((p) => ({
      ...p,
      moves:
        game.turn() === color
          ? game.moves({ square: p.square, verbose: true })
          : [],
    }));
}
export function material(game, side) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return game
    .board()
    .flat()
    .filter(Boolean)
    .reduce((sum, p) => sum + values[p.type] * (p.color === side ? 1 : -1), 0);
}
