import {
  Home,
  BookOpen,
  Library,
  Plus,
  GraduationCap,
  Volume2,
  VolumeX,
  Star,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Piece } from "./Piece.jsx";

export function Header({
  route,
  navigate,
  settings,
  updateSettings,
  completed,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { id: "home", icon: Home, label: "Home" },
    { id: "play", icon: BookOpen, label: "Play & learn" },
    { id: "library", icon: Library, label: "Puzzle library" },
  ];
  const go = (id) => {
    setMobileOpen(false);
    navigate(id);
  };
  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="Chesscraft Home"
        >
          <span className="brand-icon">
            <Piece type="n" size={38} />
            <span className="brand-sparkle">✦</span>
          </span>
          <span>
            chess<span className="brand-light">craft</span>
            <span className="brand-dot">.</span>
          </span>
        </button>
        <nav
          className={`main-nav ${mobileOpen ? "mobile-open" : ""}`}
          aria-label={"Main navigation"}
        >
          {links.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={`nav-link ${route === id ? "active" : ""}`}
              aria-current={route === id ? "page" : undefined}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          <button
            className={`nav-link add-nav ${route === "add" ? "active" : ""}`}
            onClick={() => go("add")}
          >
            <Plus size={17} />
            {"Add puzzle"}
          </button>
          <button
            className="nav-link mobile-teacher-nav"
            onClick={() => go("teacher")}
          >
            <GraduationCap size={18} />
            {"Teacher room"}
          </button>
        </nav>
        <div className="header-actions">
          <button
            className={`teacher-link ${route === "teacher" ? "active" : ""}`}
            onClick={() => go("teacher")}
          >
            <GraduationCap size={18} />
            <span>{"Teacher room"}</span>
          </button>
          <span className="header-divider" />
          
          <button
            className="icon-button sound-toggle"
            onClick={() => updateSettings({ sound: !settings.sound })}
            aria-label={`${"Sound"} ${settings.sound ? "on" : "off"}`}
            aria-pressed={settings.sound}
          >
            {settings.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <span
            className="header-stars"
            title={`${completed} ${"completed"}`}
          >
            <Star size={17} fill="currentColor" />
            <b>{completed}</b>
          </span>
          <button
            className="mobile-menu-button icon-button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
