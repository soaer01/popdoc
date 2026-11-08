import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { diffWords } from 'diff';
import { fetchPull, mergePull } from './pullsSlice.js';
import './Conflicts.css';

function Version({ label, para, against }) {
  if (!para) {
    return (
      <div className="cf-version">
        <h4>{label}</h4>
        <p className="muted">Deleted on this side.</p>
      </div>
    );
  }
  const parts = against ? diffWords(against.text, para.text) : [{ value: para.text }];
  return (
    <div className={`cf-version origin-${para.origin}`}>
      <h4>{label}</h4>
      <p>
        {parts.map((part, i) =>
          part.added ? <ins key={i}>{part.value}</ins> : part.removed ? null : <span key={i}>{part.value}</span>
        )}
      </p>
    </div>
  );
}

export default function Conflicts() {
  const { prId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { detail, busy, error } = useSelector((s) => s.pulls);
  const [choice, setChoice] = useState({}); // id -> 'current' | 'incoming' | 'edit'
  const [edits, setEdits] = useState({});

  useEffect(() => {
    if (detail?.pr.id !== prId) dispatch(fetchPull(prId));
  }, [prId, detail, dispatch]);

  const loaded = detail?.pr.id === prId ? detail : null;
  if (!loaded) return <p className="empty">Loading conflicts…</p>;
  const conflicts = loaded.plan?.conflicts || [];
  if (loaded.pr.status !== 'open' || conflicts.length === 0) {
    return (
      <p className="empty">
        Nothing to resolve. <Link to=".." relative="path">Back to the pull request</Link>
      </p>
    );
  }

  const resolvedCount = conflicts.filter((c) => choice[c.id]).length;

  function pick(c, value) {
    setChoice((x) => ({ ...x, [c.id]: value }));
    if (value === 'edit' && edits[c.id] === undefined) {
      setEdits((x) => ({ ...x, [c.id]: (c.incoming || c.current)?.text || '' }));
    }
  }

  async function onMerge() {
    const resolutions = {};
    for (const c of conflicts) {
      const how = choice[c.id];
      if (how === 'current') resolutions[c.id] = c.current;
      else if (how === 'incoming') resolutions[c.id] = c.incoming;
      else {
        const source = c.incoming || c.current;
        const text = edits[c.id] ?? '';
        resolutions[c.id] = text.trim()
          ? { ...source, id: c.id, text, origin: source.origin === 'ai' ? 'ai-edited' : source.origin }
          : null;
      }
    }
    const action = await dispatch(mergePull({ prId, resolutions }));
    if (!action.error) navigate('..', { relative: 'path' });
  }

  return (
    <div className="cf">
      <header>
        <p className="small muted">
          <Link to=".." relative="path">#{loaded.pr.number} {loaded.pr.title}</Link> / Conflicts
        </p>
        <h2>
          {conflicts.length} paragraph{conflicts.length > 1 ? 's were' : ' was'} changed on both sides
        </h2>
        <p className="muted">
          Everything else merges automatically. For each paragraph, keep what&rsquo;s on main, take this pull
          request&rsquo;s version, or write a combined version. Highlighted words differ from the common ancestor.
        </p>
      </header>

      {conflicts.map((c, i) => (
        <section key={c.id} className="cf-item">
          <h3>Conflict {i + 1}</h3>
          {c.base && <p className="cf-base small muted">Before either change: {c.base.text}</p>}
          <div className="cf-grid">
            <Version label="Current, on main" para={c.current} against={c.base} />
            <Version label="Incoming, from this pull request" para={c.incoming} against={c.base} />
          </div>
          <div className="cf-actions" role="radiogroup" aria-label={`Resolution for conflict ${i + 1}`}>
            {[
              ['current', 'Accept current'],
              ['incoming', 'Accept incoming'],
              ['edit', 'Edit'],
            ].map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={choice[c.id] === value}
                className={`btn ${choice[c.id] === value ? 'is-chosen' : ''}`}
                onClick={() => pick(c, value)}
              >
                {label}
              </button>
            ))}
          </div>
          {choice[c.id] === 'edit' && (
            <label className="field cf-edit">
              Combined paragraph (leave empty to remove it)
              <textarea rows={4} value={edits[c.id]} onChange={(e) => setEdits((x) => ({ ...x, [c.id]: e.target.value }))} />
            </label>
          )}
        </section>
      ))}

      <footer className="cf-foot">
        <span className="small muted">
          {resolvedCount} of {conflicts.length} resolved
        </span>
        {error && <span className="field-error">{error}</span>}
        <button className="btn btn-primary" disabled={resolvedCount < conflicts.length || busy} onClick={onMerge}>
          {busy ? 'Merging…' : 'Merge with these resolutions'}
        </button>
      </footer>
    </div>
  );
}
