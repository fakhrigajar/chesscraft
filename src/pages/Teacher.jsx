import { useRef, useState } from "react";
import {
  Plus,
  Trophy,
  BookOpen,
  MousePointer2,
  Download,
  Upload,
  ArrowRight,
  GraduationCap,
  Check,
  Sparkles,
  Settings2,
  Volume2,
  Route,
  Accessibility,
  AlertCircle,
} from "lucide-react";

import { exportData } from "../services/storage.js";
import { Chess, fromUci } from "../services/chess.js";
import { OBJECTIVES } from "../services/objectives.js";

export function Teacher({
  puzzles,
  customPuzzles,
  progress,
  settings,
  updateSettings,
  onAdd,
  onLibrary,
  onRestore,
}) {
  const upload = useRef(null),
    [notice, setNotice] = useState("");
  const completed = puzzles.filter((p) => progress[p.id]?.completed).length,
    attempts = Object.values(progress).reduce(
      (s, p) => s + (p.attempts || 0),
      0,
    );
  async function restore(file) {
    try {
      if (file.size > 5000000) throw new Error("size");
      const data = JSON.parse(await file.text());
      if (
        data.app !== "chesscraft" ||
        data.version !== 1 ||
        !Array.isArray(data.puzzles) ||
        data.puzzles.length > 250
      )
        throw new Error("format");
      for (const p of data.puzzles) {
        const game = new Chess(p.initialFen);
        if (
          typeof p.id !== "string" ||
          typeof p.title !== "string" ||
          !OBJECTIVES[p.objective?.type] ||
          game.turn() !== p.studentColor
        )
          throw new Error("puzzle");
        for (const u of p.solution || []) game.move(fromUci(u));
      }
      onRestore(data);
      setNotice(
        "Your backup has been restored.",
      );
    } catch {
      setNotice(
        "Could not restore this backup. Choose a Chesscraft JSON file.",
      );
    }
  }
  return (
    <main className="teacher-page page-width">
      <div className="page-intro">
        <div>
          <span className="eyebrow">
            <GraduationCap size={16} />
            {"Teacher room"}
          </span>
          <h1>{"A little room for big ideas"}</h1>
          <p>{"Manage lessons, follow progress, and create new adventures."}</p>
        </div>
        <button className="button primary-button" onClick={onAdd}>
          <Plus size={18} />
          {"Add puzzle"}
        </button>
      </div>
      <div className="teacher-stats">
        {[
          {
            icon: BookOpen,
            value: puzzles.length,
            label: "Puzzle library",
            color: "peach",
          },
          {
            icon: Trophy,
            value: completed,
            label: "Puzzles completed",
            color: "sage",
          },
          {
            icon: MousePointer2,
            value: attempts,
            label: "Attempts",
            color: "lilac",
          },
        ].map(({ icon: Icon, value, label, color }) => (
          <div className={`stat-card ${color}`} key={label}>
            <span className="stat-icon">
              <Icon size={25} />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
            <Sparkles size={21} />
          </div>
        ))}
      </div>
      <div className="teacher-grid">
        <section className="card teacher-settings">
          <h2>
            <Settings2 size={21} />
            {"Learning settings"}
          </h2>
          {[
            {
              key: "sound",
              icon: Volume2,
              label: "Sound",
              body: "Gentle sounds for blocks, moves, and celebrations.",
            },
            {
              key: "reducedMotion",
              icon: Accessibility,
              label: "Reduced motion",
              body: "A calmer learning space with less movement.",
            },
            {
              key: "exploration",
              icon: Route,
              label: "Exploration mode",
              body: "Keep playing after a mistake to explore the consequences.",
            },
          ].map(({ key, icon: Icon, label, body }) => (
            <div className="setting-row" key={key}>
              <span className="setting-icon">
                <Icon size={20} />
              </span>
              <div>
                <strong>{label}</strong>
                <p>{body}</p>
              </div>
              <button
                className={`toggle ${settings[key] ? "on" : ""}`}
                role="switch"
                aria-checked={settings[key]}
                aria-label={label}
                onClick={() => updateSettings({ [key]: !settings[key] })}
              >
                <span />
              </button>
            </div>
          ))}
          
        </section>
        <section className="card data-card">
          <span className="data-illustration">
            <BookOpen size={42} />
            <span>✧</span>
          </span>
          <h2>
            {"Keep your adventures close"}
          </h2>
          <p>
            {"Puzzles and progress are saved in this browser."}{" "}
            {"Download a backup to take them to another device."}
          </p>
          <button
            className="button secondary-button"
            onClick={() => exportData(customPuzzles, progress)}
          >
            <Download size={17} />
            {"Download backup"}
          </button>
          <button
            className="text-button"
            onClick={() => upload.current.click()}
          >
            <Upload size={15} />
            {"Restore backup"}
          </button>
          <input
            type="file"
            hidden
            accept=".json"
            ref={upload}
            onChange={(e) => {
              if (e.target.files?.[0]) restore(e.target.files[0]);
              e.target.value = "";
            }}
          />
          {notice && (
            <p className="form-info" role="status">
              {notice}
            </p>
          )}
        </section>
      </div>
      <section className="card progress-card">
        <div className="progress-heading">
          <h2>
            <FlagIcon />
            {"Your learning map"}
          </h2>
          <button className="text-button" onClick={onLibrary}>
            {"Manage puzzles"}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="progress-list">
          {puzzles.map((p, i) => (
            <div className="progress-item" key={p.id}>
              <span
                className={`progress-marker ${progress[p.id]?.completed ? "complete" : ""}`}
              >
                {progress[p.id]?.completed ? <Check size={16} /> : i + 1}
              </span>
              <div>
                <strong>
                  {p.title}
                </strong>
                <span>{OBJECTIVES[p.objective.type]}</span>
              </div>
              <span className="progress-attempts">
                {progress[p.id]?.attempts || 0} {"Attempts".toLowerCase()}
              </span>
              <span
                className={`progress-pill ${progress[p.id]?.completed ? "complete" : ""}`}
              >
                {progress[p.id]?.completed
                  ? "completed"
                  : "Waiting for you"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
function FlagIcon() {
  return <GraduationCap size={23} />;
}
