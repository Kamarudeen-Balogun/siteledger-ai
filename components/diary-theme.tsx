"use client";

import { useSyncExternalStore } from "react";
import { DiaryIcon } from "./diary-icon";

const themes = ["light", "dark", "system"] as const;
type Theme = typeof themes[number];
const key = "siteledger-theme";
const eventName = "siteledger-theme-change";

function getTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "dark" || value === "system" ? value : "light";
}
function subscribe(notify: () => void) {
  function sync(event: StorageEvent) {
    if (event.key === key || event.key === null) {
      document.documentElement.dataset.theme = event.newValue ?? "light";
      notify();
    }
  }
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(eventName, notify);
    window.removeEventListener("storage", sync);
  };
}
function select(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(key, theme); } catch { /* The choice still applies to this page. */ }
  window.dispatchEvent(new Event(eventName));
}
const label = (theme: Theme) => theme.charAt(0).toUpperCase() + theme.slice(1);

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as const);
  const next = themes[(themes.indexOf(theme) + 1) % themes.length];
  return <button type="button" className="diary-icon-button" title={`Theme: ${label(theme)}. Switch to ${label(next)}`} aria-label={`Theme: ${label(theme)}. Switch to ${label(next)}`} onClick={() => select(next)} data-tour="theme"><DiaryIcon name={theme === "dark" ? "moon" : theme === "system" ? "theme" : "sun"}/></button>;
}

export function ThemeSettings() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as const);
  return <fieldset className="diary-theme-options"><legend>Theme</legend>{themes.map(value => <label key={value}><input type="radio" name="siteledger-theme" checked={theme === value} onChange={() => select(value)}/>{label(value)}</label>)}</fieldset>;
}
