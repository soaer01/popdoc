import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { mergePull } from '../pulls/pullsSlice.js';
import './AiReview.css';

// Go through an AI proposal change by change: accept, edit, or reject each one.
export default function AiReview({ pr, rows, onDone }) {
  const dispatch = useDispatch();
  const { busy, error } = useSelector((s) => s.pulls);
  const changes = rows.filter((r) => r.status === 'changed');
  const [picks, setPicks] = useState({});
  const [texts, setTexts] = useState({});

  if (pr.status !== 'open') {
    return (
      <p className="small muted">
        {pr.acceptedCount ? `${pr.acceptedCount} change${pr.acceptedCount > 1 ? 's' : ''} applied to your draft.` : 'Every change was rejected. Your draft is unchanged.'}
      </p>
    );
  }
  if (!pr.isRequester) return <p className="small muted">Only the person who asked can review this proposal.</p>;

  const decided = changes.filter((r) => picks[r.id]).length;

  async function apply() {
    const selections = {};
    for (const r of changes) {
      if (picks[r.id] === 'accept') selections[r.id] = 'accept';
      if (picks[r.id] === 'edit') selections[r.id] = { text: texts[r.id] ?? r.after.text };
    }
    const action = await dispatch(mergePull({ prId: pr.id, selections }));
    if (!action.error) onDone?.();
  }

  return (
    <section className="air">
      <h3>Review each change</h3>
      <p className="small muted">
        The AI can&rsquo;t write to your draft or to main. Only what you accept here goes into{' '}
        <code className="hash">{pr.targetName}</code>.
      </p>
      {changes.map((r, i) => (
        <div key={r.id} className="air-item">
          <span className="small">Change {i + 1}</span>
          <div className="air-buttons" role="radiogroup" aria-label={`Decision for change ${i + 1}`}>
            {[
              ['accept', 'Accept'],
              ['edit', 'Edit'],
              ['reject', 'Reject'],
            ].map(([v, label]) => (
              <button key={v} role="radio" aria-checked={picks[r.id] === v} className={`btn ${picks[r.id] === v ? 'is-chosen' : ''}`} onClick={() => setPicks((p) => ({ ...p, [r.id]: v }))}>
                {label}
              </button>
            ))}
          </div>
          {picks[r.id] === 'edit' && (
            <textarea
              rows={4}
              aria-label={`Edited text for change ${i + 1}`}
              value={texts[r.id] ?? r.after.text}
              onChange={(e) => setTexts((t) => ({ ...t, [r.id]: e.target.value }))}
            />
          )}
        </div>
      ))}
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary" disabled={decided < changes.length || busy} onClick={apply}>
        {busy ? 'Applying…' : 'Apply my decisions'}
      </button>
      <p className="small muted">
        {decided} of {changes.length} decided
      </p>
    </section>
  );
}
