import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createBranch } from './branchesSlice.js';

// starts: [{ label, commitId }] — where the new branch can begin. commitId null means main's latest save.
export default function NewBranch({ docId, starts, onCreated, onCancel }) {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [name, setName] = useState('');
  const [start, setStart] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const prefix = `${user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    const action = await dispatch(createBranch({ docId, name, fromCommitId: starts[start].commitId }));
    setBusy(false);
    if (action.error) return setError(action.error.message);
    onCreated(action.payload);
  }

  return (
    <form className="new-branch" onSubmit={onSubmit}>
      <label className="field">
        Branch name
        <span className="new-branch-name">
          <span className="muted">{prefix}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="shorter-intro" maxLength={40} autoFocus required />
        </span>
      </label>
      {starts.length > 1 ? (
        <label className="field">
          Start from
          <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {starts.map((s, i) => (
              <option key={i} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="small muted">Starts from {starts[0].label}.</p>
      )}
      {error && <p className="field-error">{error}</p>}
      <div className="new-branch-actions">
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create branch'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
