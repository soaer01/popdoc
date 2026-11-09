import { useState } from 'react';

// Paragraphs edited both on your branch and on main since they split. Pick one version of each;
// you can still edit the result in the editor afterwards.
export default function SyncConflicts({ conflicts, busy, onResolve, onCancel }) {
  const [choice, setChoice] = useState({});
  const done = conflicts.every((c) => choice[c.id]);

  const text = (p) => (p ? p.text : <em className="muted">Deleted on this side</em>);

  return (
    <section className="sync-conflicts" aria-label="Choose versions">
      <h3>
        {conflicts.length} paragraph{conflicts.length > 1 ? 's were' : ' was'} changed both here and on main
      </h3>
      <p className="small muted">Everything else from main comes in automatically. Pick a version for each paragraph below.</p>
      {conflicts.map((c, i) => (
        <div key={c.id} className="sync-item" role="radiogroup" aria-label={`Paragraph ${i + 1}`}>
          {[
            ['mine', 'Keep yours', c.current],
            ['main', 'Take main’s', c.incoming],
          ].map(([value, label, para]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={choice[c.id] === value}
              className={`sync-option ${choice[c.id] === value ? 'is-chosen' : ''}`}
              onClick={() => setChoice((x) => ({ ...x, [c.id]: value }))}
            >
              <span className="small sync-label">{label}</span>
              <span className="sync-text">{text(para)}</span>
            </button>
          ))}
        </div>
      ))}
      <div className="sync-actions">
        <button className="btn btn-primary" disabled={!done || busy} onClick={() => onResolve(choice)}>
          {busy ? 'Updating…' : 'Update with these choices'}
        </button>
        <button className="btn btn-quiet" onClick={onCancel}>
          Not now
        </button>
      </div>
    </section>
  );
}
