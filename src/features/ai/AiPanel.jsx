import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchJobs, requestAi } from './aiSlice.js';
import './AiPanel.css';

const actions = {
  rewrite: 'Rewrite',
  expand: 'Expand',
  summarize: 'Summarize',
  translate: 'Translate',
};
const statusText = { queued: 'Waiting in the queue', running: 'Writing a proposal', done: 'Proposal ready' };

export default function AiPanel({ docId, branch, paragraphs, dirty }) {
  const dispatch = useDispatch();
  const jobs = useSelector((s) => s.ai.jobsByDoc[docId]) || [];
  const { submitting, error } = useSelector((s) => s.ai);
  const [action, setAction] = useState('rewrite');
  const [language, setLanguage] = useState('English');
  const [picked, setPicked] = useState([]);

  const active = jobs.some((j) => j.status !== 'done');

  useEffect(() => {
    dispatch(fetchJobs(docId));
  }, [docId, dispatch]);

  // Poll while a job is running. The Socket.IO "job:done" event will replace this.
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => dispatch(fetchJobs(docId)), 1000);
    return () => clearInterval(t);
  }, [active, docId, dispatch]);

  function toggle(id) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function onAsk(e) {
    e.preventDefault();
    const action_ = await dispatch(
      requestAi({ docId, branchId: branch.id, action, paragraphIds: picked, language: action === 'translate' ? language : null })
    );
    if (!action_.error) setPicked([]);
  }

  return (
    <form className="ai" onSubmit={onAsk}>
      <h2 className="rail-title">Ask the AI for a proposal</h2>
      <p className="small muted">
        It works on its own branch and opens a pull request into your draft. You decide what to keep.
      </p>
      <div className="ai-actions" role="radiogroup" aria-label="What the AI should do">
        {Object.entries(actions).map(([k, v]) => (
          <button type="button" key={k} role="radio" aria-checked={action === k} className={`btn ${action === k ? 'is-chosen' : ''}`} onClick={() => setAction(k)}>
            {v}
          </button>
        ))}
      </div>
      {action === 'translate' && (
        <label className="field">
          Into
          <input value={language} onChange={(e) => setLanguage(e.target.value)} />
        </label>
      )}
      <fieldset className="ai-paras">
        <legend className="small">Paragraphs</legend>
        {paragraphs.length === 0 && <p className="small muted">Save some text first.</p>}
        {paragraphs.map((p) => (
          <label key={p.id} className="small">
            <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
            <span>{p.text.slice(0, 70)}{p.text.length > 70 ? '…' : ''}</span>
          </label>
        ))}
      </fieldset>
      {dirty && <p className="small muted">The AI works from your last save point.</p>}
      {error && <p className="field-error">{error}</p>}
      <button className="btn" disabled={!picked.length || submitting}>
        {submitting ? 'Sending…' : `${actions[action]} ${picked.length || ''} paragraph${picked.length === 1 ? '' : 's'}`}
      </button>

      {jobs.length > 0 && (
        <ul className="ai-jobs small">
          {jobs.slice(0, 4).map((j) => (
            <li key={j.id} className={`is-${j.status}`}>
              <span>{actions[j.action]}</span>
              {j.status === 'done' && j.prId ? (
                <Link to={`pulls/${j.prId}`}>Review the proposal</Link>
              ) : (
                <span className="muted">{statusText[j.status]}…</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
