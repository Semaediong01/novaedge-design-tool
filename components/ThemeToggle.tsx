// components/ThemeToggle.tsx — light / dark switch. The theme itself is set on <html data-theme> (see app/layout.tsx).
"use client";

import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ne-theme", next);
    } catch {
      // Private mode or blocked storage: the choice just lasts for this visit.
    }
  };

  return (
    <button type="button" className="icon-btn theme-toggle" onClick={toggle} aria-label="Switch between light and dark mode" title="Light / dark mode">
      <Moon size={20} className="icon-moon" aria-hidden />
      <Sun size={20} className="icon-sun" aria-hidden />
    </button>
  );
}
