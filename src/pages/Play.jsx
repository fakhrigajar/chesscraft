import { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowRight,
  Play as PlayIcon,
  Pause,
  RotateCcw,
  SkipForward,
  HelpCircle,
  ChevronRight,
  Flag,
  Star,
  Blocks,
  MousePointer2,
  Code2,
  Trophy,
  Route,
  Trash2,
  Target,
} from "lucide-react";

import {
  Chess,
  ownPieces,
  legalMove,
  fromUci,
  toUci,
} from "../services/chess.js";
import { opponentMove } from "../services/validation.js";
import { goalAchieved, objectiveDescription } from "../services/objectives.js";
import { recordedContinuation } from "../services/continuation.js";
import { useChessLesson } from "../hooks/useChessLesson.js";
import { Toolbox } from "../components/Toolbox.jsx";
import { BlocklyWorkspace } from "../components/BlocklyWorkspace.jsx";
import { Chessboard } from "../components/Chessboard.jsx";
import { Modal } from "../components/Modal.jsx";

export function Play({
  puzzle,
  puzzles,
  progress,
  openLesson,
  settings,
  onComplete,
  onAttempt,
  onNotice,
}) {
  const game = useChessLesson(puzzle, {
    ...settings,
    onComplete,
    onAttempt,
    onNotice,
  });
  const workspace = useRef(null),
    [program, setProgram] = useState([]),
    [help, setHelp] = useState(false),
    [celebrate, setCelebrate] = useState(true);
  const toolboxPanel = useRef(null),
    toolboxTab = useRef(null),
    boardStage = useRef(null),
    levels = useRef(null);
  const [mobilePanel, setMobilePanel] = useState("board");
  const [planMode, setPlanMode] = useState(false),
    [planning, setPlanning] = useState(false),
    [previewFen, setPreviewFen] = useState(null),
    [previewLast, setPreviewLast] = useState(null);
  const flipped = puzzle.studentColor === "b";
  const currentIndex = puzzles.findIndex((p) => p.id === puzzle.id);
  const goal = objectiveDescription(puzzle.objective);
  const goalMoves = puzzle.objective.moves || 1;
  const activeFen =
    planMode && previewFen && !game.busy ? previewFen : game.fen;
  const activeGame = useMemo(() => new Chess(activeFen), [activeFen]);
  const selected =
    activeGame.get(game.selected || "a0")?.color === puzzle.studentColor
      ? game.selected
      : null;
  useEffect(() => {
    const stage = boardStage.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      const size = Math.floor(
        Math.min(entry.contentRect.width, entry.contentRect.height),
      );
      if (size > 0) stage.style.setProperty("--board-size", `${size}px`);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  // Keep the current level centered when the row resizes, and fade whichever
  // edge has more levels hidden.
  useEffect(() => {
    const nav = levels.current;
    if (!nav) return;
    const edges = () => {
      nav.dataset.moreLeft = nav.scrollLeft > 1;
      nav.dataset.moreRight =
        nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
    };
    const center = () => {
      const current = nav.querySelector(".current");
      if (current)
        nav.scrollLeft =
          current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
      edges();
    };
    const observer = new ResizeObserver(center);
    observer.observe(nav);
    nav.addEventListener("scroll", edges, { passive: true });
    return () => {
      observer.disconnect();
      nav.removeEventListener("scroll", edges);
    };
  }, [puzzles.length]);
  useEffect(() => {
    if (!planMode || game.busy || game.status === "complete") {
      setPreviewFen(null);
      setPlanning(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPlanning(true);
      const projected = new Chess(game.fen);
      let last = null;
      let studentMoves = game.studentMoves;
      try {
        for (const block of program.filter(
          (b) => !game.processed.includes(b.id),
        )) {
          if (
            !legalMove(projected, block.move) ||
            projected.turn() !== puzzle.studentColor
          )
            break;
          const continuation = recordedContinuation(
            puzzle,
            projected,
            studentMoves,
            toUci(block.move),
          );
          last = projected.move(block.move);
          studentMoves++;
          if (
            projected.isGameOver() ||
            goalAchieved(
              projected,
              puzzle.objective,
              puzzle.studentColor,
              last,
            ) ||
            (continuation?.recordedStrategy && continuation.line.length === 1)
          )
            break;
          const answer = await opponentMove({
            game: projected,
            puzzle,
            studentMoves,
            movetime: 400,
            depth: 13,
            signal: controller.signal,
          });
          const response = fromUci(answer || "");
          if (!legalMove(projected, response)) break;
          last = projected.move(response);
        }
        if (!controller.signal.aborted) {
          setPreviewFen(projected.fen());
          setPreviewLast(last);
          const pieces = ownPieces(projected, puzzle.studentColor);
          game.setSelected((old) =>
            pieces.some((p) => p.square === old && p.moves.length)
              ? old
              : pieces.find((p) => p.moves.length)?.square || null,
          );
        }
      } catch {
        if (!controller.signal.aborted) setPreviewFen(null);
      } finally {
        if (!controller.signal.aborted) setPlanning(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    planMode,
    program,
    game.fen,
    game.processed,
    game.busy,
    game.status,
    game.studentMoves,
    puzzle,
  ]);
  function showMobilePanel(panel) {
    if (window.matchMedia("(max-width: 900px)").matches) setMobilePanel(panel);
  }
  function select(square) {
    if (planMode) {
      if (activeGame.get(square)?.color === puzzle.studentColor)
        game.setSelected(square);
    } else game.select(square);
  }
  function selectOnBoard(square) {
    select(square);
    showMobilePanel("toolbox");
  }
  function addMove(move, options) {
    workspace.current?.addMove(move, options);
    showMobilePanel("workspace");
  }
  function run(single = false) {
    setPlanMode(false);
    showMobilePanel("board");
    game.run(workspace.current?.getProgram() || [], single);
  }
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const complete = game.status === "complete";
  return (
    <main className="play-page page-width">
      <div className="breadcrumb">
        <span className="world-icon">
          <Flag size={13} />
        </span>
        {"Your adventure"}
        <ChevronRight size={13} />
        <span>{"Meet the pieces"}</span>
      </div>
      <div className="lesson-heading">
        <div className="lesson-goal">
          <span className="goal-icon" aria-hidden="true">
            <Target size={19} />
          </span>
          <h1>{goal}</h1>
          {puzzle.objective.type !== "mate" && (
            <span className="goal-moves">
              {goalMoves} {goalMoves === 1 ? "move" : "moves"}
            </span>
          )}
        </div>
        <button className="help-button" onClick={() => setHelp(true)}>
          <HelpCircle size={18} />
          <span>{"How to play"}</span>
        </button>
      </div>
      <div
        className="play-panel-tabs"
        role="tablist"
        aria-label={"Play panels"}
      >
        {[
          { id: "board", label: "The chessboard", Icon: Flag },
          { id: "toolbox", label: "Move blocks", Icon: Blocks },
          { id: "workspace", label: "My program", Icon: Code2 },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`play-tab-${id}`}
            ref={id === "toolbox" ? toolboxTab : undefined}
            role="tab"
            aria-selected={mobilePanel === id}
            aria-controls={`play-panel-${id}`}
            className={`play-panel-tab ${mobilePanel === id ? "active" : ""}`}
            onClick={() => setMobilePanel(id)}
          >
            <span className="tab-label">
              <Icon size={16} />
              {label}
            </span>
            {id === "toolbox" && (
              <span className="tab-delete-label">
                <Trash2 size={16} />
                {"Drop to remove"}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="game-grid" data-mobile-panel={mobilePanel}>
        <section
          className="game-panel toolbox-panel"
          id="play-panel-toolbox"
          ref={toolboxPanel}
        >
          <div className="panel-heading">
            <span className="panel-icon orange-icon">
              <Blocks size={20} />
            </span>
            <div>
              <h2>{"Move blocks"}</h2>
              <p>{"Pick, drag, discover!"}</p>
            </div>
            <span className="panel-step">01</span>
          </div>
          <Toolbox
            fen={activeFen}
            selected={selected}
            onSelect={select}
            onAdd={addMove}
            studentColor={puzzle.studentColor}
            disabled={
              game.busy ||
              complete ||
              planning ||
              (game.status === "mistake" && !settings.exploration)
            }
          />
          <div className="toolbox-delete-overlay" aria-hidden="true">
            <span>
              <Trash2 size={30} />
            </span>
            <strong>{"Drop to remove"}</strong>
            <p>{"This block will be removed from your program."}</p>
          </div>
        </section>
        <section
          className="game-panel workspace-panel"
          id="play-panel-workspace"
        >
          <div className="panel-heading">
            <span className="panel-icon purple-icon">
              <Code2 size={21} />
            </span>
            <div>
              <h2>{"My program"}</h2>
              <p>{"Connect your ideas"}</p>
            </div>
            <span className="panel-step">02</span>
          </div>
          <BlocklyWorkspace
            ref={workspace}
            puzzleId={puzzle.id}
            sound={settings.sound}
            activeBlock={game.activeBlock}
            invalidBlock={game.invalidBlock}
            processed={game.processed}
            busy={game.busy || complete}
            onChange={setProgram}
            deleteAreaRefs={[toolboxPanel, toolboxTab]}
          />
          <div className="workspace-controls">
            <div className="plan-mode-row">
              <button
                className={`plan-toggle ${planMode ? "on" : ""}`}
                onClick={() => setPlanMode(!planMode)}
                disabled={game.busy || complete}
                aria-pressed={planMode}
              >
                <Route size={15} />
                {"Plan ahead"}
                <span className="mini-switch" />
              </button>
            </div>
            <div className="run-controls">
              <button
                className="run-button"
                onClick={() => (game.busy ? game.pause() : run())}
                disabled={
                  complete ||
                  (game.status === "mistake" && !settings.exploration)
                }
              >
                {game.busy ? (
                  <Pause size={21} fill="currentColor" />
                ) : (
                  <PlayIcon size={21} fill="currentColor" />
                )}
                {game.busy ? "Pause" : "Run code"}
                <span>⌘ ↵</span>
              </button>
              <button
                className="step-button"
                onClick={() => run(true)}
                title={"Step"}
                aria-label={"Step"}
                disabled={game.busy || complete || game.status === "mistake"}
              >
                <SkipForward size={21} />
              </button>
              <button
                className="reset-button"
                onClick={() => {
                  game.reset();
                  setCelebrate(true);
                }}
                title={"Reset board"}
                aria-label={"Reset board"}
              >
                <RotateCcw size={19} />
              </button>
            </div>
          </div>
        </section>
        <section className="game-panel board-panel" id="play-panel-board">
          <div className="panel-heading">
            <span className="panel-icon green-icon">
              <Flag size={20} />
            </span>
            <h2 className="sr-only">{"Playground"}</h2>
            <nav
              className="lesson-levels"
              aria-label={"Puzzle levels"}
              ref={levels}
              onWheel={(event) => {
                if (Math.abs(event.deltaY) > Math.abs(event.deltaX))
                  event.currentTarget.scrollLeft += event.deltaY;
              }}
            >
              {puzzles.map((p, i) => (
                <button
                  key={p.id}
                  className={`path-level ${puzzle.id === p.id ? "current" : ""} ${progress[p.id]?.completed ? "complete" : ""}`}
                  onClick={() => openLesson(p)}
                  aria-label={`${"Lesson"} ${i + 1}: ${p.title}${progress[p.id]?.completed ? `, ${"completed"}` : ""}`}
                  aria-current={puzzle.id === p.id ? "step" : undefined}
                >
                  {i + 1}
                </button>
              ))}
            </nav>
          </div>
          <div className="board-panel-body">
            <div className="board-stage" ref={boardStage}>
              <Chessboard
                fen={activeFen}
                selected={selected}
                onSelect={selectOnBoard}
                onDestination={(move) =>
                  addMove(
                    move,
                    activeGame.moves({ square: move.from, verbose: true }),
                  )
                }
                studentColor={puzzle.studentColor}
                flipped={flipped}
                mistakeSquare={game.mistakeMove?.to}
                lastMove={planMode && previewFen ? previewLast : game.lastMove}
                hint={game.hint}
                target={
                  puzzle.objective.type === "reach"
                    ? puzzle.objective.target
                    : null
                }
                disabled={
                  game.busy ||
                  complete ||
                  planning ||
                  (game.status === "mistake" && !settings.exploration)
                }
                feedback={game.feedback}
                reducedMotion={settings.reducedMotion}
              />
            </div>
          </div>
        </section>
      </div>
      {help && (
        <Modal
          title={"Your adventure in three little steps"}
          onClose={() => setHelp(false)}
          className="help-modal"
        >
          <div className="help-steps">
            {[MousePointer2, Blocks, PlayIcon].map((Icon, i) => (
              <div key={i}>
                <span className={`help-step-icon step-${i}`}>
                  <Icon size={27} />
                </span>
                <section>
                  <h3>
                    {
                      [
                        "1. Pick your piece",
                        "2. Build your moves",
                        "3. Run your plan",
                      ][i]
                    }
                  </h3>
                  <p>
                    {
                      [
                        "Click one of your pieces. The glowing squares show where it can go.",
                        "Drag a colorful move under When we start. You can also click a block to add it.",
                        "Press Run code and watch your plan! Your opponent takes its own turns.",
                      ][i]
                    }
                  </p>
                </section>
              </div>
            ))}
          </div>
          <button
            className="button primary-button"
            onClick={() => setHelp(false)}
          >
            {"Got it, let’s explore!"}
            <ArrowRight size={18} />
          </button>
        </Modal>
      )}
      {complete && celebrate && (
        <Modal
          title=""
          ariaLabel={"Amazing! You did it!"}
          className="completion-modal"
          onClose={() => setCelebrate(false)}
        >
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <i
                key={i}
                style={{
                  "--i": i,
                  "--color": ["#f3b94f", "#8ab39a", "#ad93d0", "#ec9a77"][
                    i % 4
                  ],
                }}
              />
            ))}
          </div>
          <div className="trophy-circle">
            <Trophy size={56} strokeWidth={1.6} />
            <Star className="trophy-star" size={22} fill="currentColor" />
          </div>
          <div className="completion-stars">✦ ★ ✦</div>
          <h2>{"Amazing! You did it!"}</h2>
          <p>{"You solved the puzzle. Ready for your next adventure?"}</p>
          <button
            className="button primary-button"
            onClick={() =>
              openLesson(puzzles[(currentIndex + 1) % puzzles.length])
            }
          >
            {"Next adventure"}
            <ArrowRight size={18} />
          </button>
          <button
            className="text-button"
            onClick={() => {
              game.reset();
              workspace.current?.clear();
              setCelebrate(true);
            }}
          >
            {"Play again"}
          </button>
        </Modal>
      )}
    </main>
  );
}
