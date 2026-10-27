import { useState } from 'react';

const KEY = 'aicte_display';

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function applyPrefs(prefs) {
  const root = document.documentElement;
  root.classList.toggle('text-large', Boolean(prefs.largeText));
  root.classList.toggle('high-contrast', Boolean(prefs.highContrast));
}

// Called once at startup so the saved settings apply before the first screen appears.
export function applySavedPreferences() {
  applyPrefs(readPrefs());
}

export default function AccessibilityControls() {
  const [prefs, setPrefs] = useState(readPrefs);

  function toggle(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage may be blocked; the setting still applies for this visit.
    }
    applyPrefs(next);
  }

  const buttonClass =
    'rounded-md border-2 border-slate-600 bg-white px-4 py-2 text-base font-medium hover:bg-slate-100';

  return (
    <section aria-label="Display settings" className="flex flex-wrap items-center gap-3 px-6 py-4">
      <span className="text-base font-semibold">Display settings:</span>
      <button type="button" aria-pressed={Boolean(prefs.largeText)} onClick={() => toggle('largeText')} className={buttonClass}>
        Larger text {prefs.largeText ? '(on)' : '(off)'}
      </button>
      <button type="button" aria-pressed={Boolean(prefs.highContrast)} onClick={() => toggle('highContrast')} className={buttonClass}>
        High contrast {prefs.highContrast ? '(on)' : '(off)'}
      </button>
    </section>
  );
}
