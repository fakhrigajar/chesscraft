import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Undo2,
  Redo2,
  Trash2,
  Blocks,
  GripVertical,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import { Piece } from "./Piece.jsx";
import { movement, PIECES, toUci } from "../services/chess.js";

import { readStore, writeStore } from "../services/storage.js";
import { playSound, prepareSound, setSoundEnabled } from "../services/sound.js";
import { ToolboxDeleteArea } from "./ToolboxDeleteArea.js";
import { attachWorkspaceScrolling } from "./workspaceScrolling.js";

Blockly.setLocale(En);
const dataImage = (type, color) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderToStaticMarkup(<Piece type={type} color={color} />).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
const theme = Blockly.Theme.defineTheme("chesscraft", {
  base: Blockly.Themes.Classic,
  blockStyles: Object.fromEntries(
    Object.entries(PIECES).map(([piece, { color }]) => [
      `move_${piece}`,
      { colourPrimary: color },
    ]),
  ),
  componentStyles: {
    workspaceBackgroundColour: "#fbfcf9",
    scrollbarColour: "#d7dfd4",
    scrollbarOpacity: 0.5,
    insertionMarkerColour: "#78ac91",
    insertionMarkerOpacity: 0.5,
    cursorColour: "#245b4c",
  },
  fontStyle: { family: "Nunito, sans-serif", weight: "bold", size: 14 },
  startHats: true,
});

Blockly.Blocks.chess_start = {
  init() {
    this.appendDummyInput()
      .appendField("▶")
      .appendField(new Blockly.FieldLabelSerializable("When we start"), "TITLE");
    this.setNextStatement(true);
    this.setColour("#e2ad4f");
    this.setDeletable(false);
    this.setMovable(false);
    this.setEditable(false);
  },
};
Blockly.Blocks.chess_move = {
  init() {
    this.chessOptions = [];
    this.chessMove = null;
    const destination = new Blockly.FieldDropdown(
      function () {
        const block = this.getSourceBlock();
        return block?.chessOptions?.length
          ? block.chessOptions.map((move) => [
              move.to +
                (move.promotion ? ` ♕${move.promotion.toUpperCase()}` : ""),
              toUci(move),
            ])
          : [["…", "none"]];
      },
      function (value) {
        const block = this.getSourceBlock(),
          selected = block?.chessOptions.find((m) => toUci(m) === value);
        if (selected) {
          block.chessMove = { ...selected };
          const { arrows, steps } = movement(selected);
          block.setFieldValue(`${arrows} ${steps}`, "WAY");
        }
        return value;
      },
    );
    this.appendDummyInput()
      .appendField(
        new Blockly.FieldImage(dataImage("n", "w"), 34, 34, "chess piece"),
        "PIECE",
      )
      .appendField(new Blockly.FieldLabelSerializable("g1"), "FROM")
      .appendField(new Blockly.FieldLabelSerializable("↑2 ←1"), "WAY")
      .appendField("→")
      .appendField(destination, "DEST");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle("move_n");
    this.setTooltip("Move a chess piece. Connect below the start block.");
  },
  saveExtraState() {
    return { move: this.chessMove, options: this.chessOptions };
  },
  loadExtraState(state) {
    if (!state?.move) return;
    this.chessOptions = state.options?.length ? state.options : [state.move];
    this.chessMove = state.move;
    this.getField("DEST").getOptions(false);
    const move = state.move,
      { arrows, steps } = movement(move);
    this.setStyle(`move_${move.piece}`);
    this.getField("PIECE").setValue(dataImage(move.piece, move.color));
    this.setFieldValue(move.from, "FROM");
    this.setFieldValue(`${arrows} ${steps}`, "WAY");
    this.setFieldValue(toUci(move), "DEST");
    this.setTooltip(
      `${move.from} → ${move.to}${move.promotion ? ` = ${move.promotion.toUpperCase()}` : ""}`,
    );
  },
};

export const BlocklyWorkspace = forwardRef(function BlocklyWorkspace(
  {
    puzzleId,
    activeBlock,
    invalidBlock,
    processed,
    busy,
    sound = false,
    onChange,
    onNotice,
    deleteAreaRefs = [],
  },
  ref,
) {
  const container = useRef(null),
    workspaceRef = useRef(null),
    callbacks = useRef({ onChange, onNotice });
  const [count, setCount] = useState(0),
    [program, setProgram] = useState([]),
    [dragOver, setDragOver] = useState(false),
    [isDragging, setIsDragging] = useState(false);
  callbacks.current = { onChange, onNotice, busy, sound, deleteAreaRefs };
  function getStart() {
    return workspaceRef.current
      ?.getAllBlocks(false)
      .find((b) => b.type === "chess_start");
  }
  function getProgram() {
    const result = [];
    let block = getStart()?.getNextBlock();
    while (block && result.length < 100) {
      if (block.chessMove)
        result.push({ id: block.id, move: { ...block.chessMove } });
      block = block.getNextBlock();
    }
    return result;
  }
  function addMove(move, options = [move]) {
    const workspace = workspaceRef.current;
    if (!workspace || busy || workspace.getAllBlocks(false).length >= 40)
      return;
    prepareSound(sound);
    Blockly.Events.setGroup(true);
    // Capture creation only after extra state exists, so undo/redo restores the
    // normalized move and dropdown options along with the visible SVG block.
    Blockly.Events.disable();
    let block;
    try {
      block = workspace.newBlock("chess_move");
      block.loadExtraState({ move, options });
      block.initSvg();
      block.render();
    } finally {
      Blockly.Events.enable();
    }
    Blockly.Events.fire(new Blockly.Events.BlockCreate(block));
    let last = getStart();
    while (last?.getNextBlock()) last = last.getNextBlock();
    last.nextConnection.connect(block.previousConnection);
    Blockly.Events.setGroup(false);
    block.getSvgRoot()?.classList.add("new-block");
  }
  function clear() {
    const workspace = workspaceRef.current;
    if (!workspace || busy) return;
    Blockly.Events.setGroup(true);
    workspace
      .getAllBlocks(false)
      .filter((b) => b.type === "chess_move")
      .forEach((b) => {
        if (!b.isDisposed()) b.dispose(false);
      });
    Blockly.Events.setGroup(false);
  }
  function reorder(id, direction) {
    const workspace = workspaceRef.current,
      blocks = getProgram().map((p) => workspace.getBlockById(p.id));
    const index = blocks.findIndex((b) => b.id === id),
      target = index + direction;
    if (target < 0 || target >= blocks.length || busy) return;
    Blockly.Events.setGroup(true);
    blocks.forEach((b) => b.unplug(false));
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    let prev = getStart();
    for (const block of blocks) {
      prev.nextConnection.connect(block.previousConnection);
      prev = block;
    }
    Blockly.Events.setGroup(false);
  }
  useImperativeHandle(ref, () => ({
    addMove,
    getProgram,
    clear,
    undo: () => workspaceRef.current?.undo(false),
    redo: () => workspaceRef.current?.undo(true),
    save: () =>
      workspaceRef.current &&
      Blockly.serialization.workspaces.save(workspaceRef.current),
  }));
  useEffect(() => {
    const workspace = Blockly.inject(container.current, {
      renderer: "zelos",
      theme,
      toolbox: undefined,
      trashcan: false,
      sounds: false,
      move: { scrollbars: true, drag: true, wheel: false },
      zoom: {
        controls: false,
        wheel: false,
        startScale: 0.93,
        minScale: 0.65,
        maxScale: 1.2,
      },
      grid: { spacing: 22, length: 2, colour: "#dce3d9", snap: false },
      media: `${import.meta.env.BASE_URL}blockly-media/`,
    });
    workspaceRef.current = workspace;
    const detachScrolling = attachWorkspaceScrolling(workspace, container.current);
    const deleteArea = new ToolboxDeleteArea(
      () =>
        callbacks.current.deleteAreaRefs
          .map((ref) => ref.current)
          .find((element) => element?.getClientRects().length),
      () => callbacks.current.busy,
    );
    workspace.getComponentManager().addComponent({
      component: deleteArea,
      capabilities: [
        Blockly.ComponentManager.Capability.DRAG_TARGET,
        Blockly.ComponentManager.Capability.DELETE_AREA,
      ],
      weight: 0,
    });
    const saved = readStore(`workspace.${puzzleId}`, null);
    if (saved) {
      try {
        Blockly.serialization.workspaces.load(saved, workspace);
      } catch {
        workspace.clear();
      }
    }
    let start = workspace
      .getAllBlocks(false)
      .find((b) => b.type === "chess_start");
    if (!start) {
      start = workspace.newBlock("chess_start");
      start.initSvg();
      start.render();
      start.moveBy(30, 34);
    }
    start.setFieldValue("When we start", "TITLE");
    // Seed from restored blocks so opening a saved program stays silent.
    let moveCount = workspace.getAllBlocks(false).filter(b => b.type === "chess_move").length;
    const changed = (event) => {
      if (event?.type === Blockly.Events.BLOCK_DRAG) {
        setIsDragging(!!event.isStart);
        if (!event.isStart) deleteArea.clearHighlight();
      }
      if (event?.isUiEvent) return;
      const all = workspace
        .getAllBlocks(false)
        .filter((b) => b.type === "chess_move");
      if (all.length !== moveCount) {
        playSound(callbacks.current.sound, all.length > moveCount ? "block-add" : "block-remove");
        moveCount = all.length;
      }
      const connected = getProgram();
      setProgram(connected);
      setCount(all.length);
      callbacks.current.onChange?.(connected);
      writeStore(
        `workspace.${puzzleId}`,
        Blockly.serialization.workspaces.save(workspace),
      );
    };
    workspace.addChangeListener(changed);
    changed();
    workspace.clearUndo();
    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      detachScrolling();
      deleteArea.clearHighlight();
      workspace.getComponentManager().removeComponent(deleteArea.id);
      workspace.removeChangeListener(changed);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [puzzleId]);
  useEffect(() => {
    setSoundEnabled(sound);
    return () => setSoundEnabled(false);
  }, [sound]);
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    for (const block of workspace.getAllBlocks(false)) {
      const root = block.getSvgRoot();
      if (!root) continue;
      root.classList.toggle("executing-block", activeBlock === block.id);
      root.classList.toggle("invalid-block", invalidBlock === block.id);
      root.classList.toggle("executed-block", processed.includes(block.id));
    }
  }, [activeBlock, invalidBlock, processed, count]);
  return (
    <div
      className={`workspace-body ${dragOver ? "drag-over" : ""} ${isDragging ? "is-dragging" : ""}`}
      onPointerDownCapture={() => prepareSound(sound)}
      onKeyDownCapture={() => prepareSound(sound)}
    >
      <div className="workspace-toolbar">
        <span className="block-count">
          <Blocks size={14} />
          {count} {"blocks"}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="icon-button small"
            onClick={() => workspaceRef.current?.undo(false)}
            disabled={busy}
            title={"Undo"}
            aria-label={"Undo"}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button small"
            onClick={() => workspaceRef.current?.undo(true)}
            disabled={busy}
            title={"Redo"}
            aria-label={"Redo"}
          >
            <Redo2 size={17} />
          </button>
          <span className="toolbar-divider" />
          <button
            className="icon-button small"
            onClick={clear}
            disabled={busy || count === 0}
            title={"Clear blocks"}
            aria-label={"Clear blocks"}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div
        className={`blockly-area ${busy ? "is-busy" : ""}`}
        ref={container}
        aria-label={"My program"}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("application/chesscraft"))
            return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          try {
            const data = JSON.parse(
              event.dataTransfer.getData("application/chesscraft"),
            );
            addMove(data.move, data.options);
          } catch {}
        }}
      />
      {count === 0 && (
        <div className="workspace-empty">
          <svg viewBox="0 0 120 60" width="114" height="57" aria-hidden="true">
            <path
              d="M5 8h32v6q0 6 7 6h15q7 0 7-6V8h45q5 0 5 5v38q0 5-5 5H66v-6q0-6-7-6H44q-7 0-7 6v6H5Z"
              fill="#f1f4eb"
              stroke="#c5d1bc"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <path
              d="M51 30h19m-9-9v18"
              stroke="#a4b797"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <strong>{"Add your first move here"}</strong>
          <span>{"Choose a colorful block from the left."}</span>
        </div>
      )}
    </div>
  );
});
