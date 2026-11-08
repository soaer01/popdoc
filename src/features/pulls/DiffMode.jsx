import { useState } from 'react';
import { DIFF_MODES } from '../../lib/diff.js';

const KEY = 'popdoc-diff-mode';

// The chosen diff granularity, remembered in this browser.
export function useDiffMode() {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return saved in DIFF_MODES ? saved : 'words';
    } catch {
      return 'words';
    }
  });
  function choose(next) {
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage can be unavailable; the choice still applies for this visit.
    }
  }
  return [mode, choose];
}

export function DiffModePicker({ mode, onChange }) {
  return (
    <span className="diff-modes" role="radiogroup" aria-label="Compare by">
      <span className="muted">Compare by</span>
      {Object.entries(DIFF_MODES).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={mode === key}
          className={mode === key ? 'is-chosen' : ''}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </span>
  );
}
