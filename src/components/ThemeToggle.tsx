"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <button
      onClick={toggle}
      className="btn-ghost h-10 w-10 min-h-0 rounded-full p-0"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Icon.Sun className="h-5 w-5" /> : <Icon.Moon className="h-5 w-5" />}
    </button>
  );
}
