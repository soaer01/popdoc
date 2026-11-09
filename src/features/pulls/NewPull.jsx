import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../api/index.js';
import { fetchBranches } from '../branches/branchesSlice.js';
import { contributionTypes, openPull } from './pullsSlice.js';

const typeHelp = {
  idea: 'A new claim, argument or point of view.',
  evidence: 'Sources, data or examples that support a claim.',
  structure: 'Reordering, splitting or organising sections.',
  wording: 'Clearer or more polished phrasing of existing ideas.',
};

export default function NewPull() {
  const { doc } = useOutletContext();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const branches = useSelector((s) => s.branches.byDoc[doc.id]);
  const [params, setParams] = useSearchParams();
  const myBranches = (branches || []).filter((b) => b.isMine && b.kind === 'member');
  const mine = myBranches.find((b) => b.id === params.get('branch')) || myBranches[0];
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', contributionType: 'idea', aiInvolved: false });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!branches) dispatch(fetchBranches(doc.id));
  }, [branches, doc.id, dispatch]);

  useEffect(() => {
    setStatus(null);
    setError(null);
    if (mine) api.pulls.branchStatus(mine.id).then(setStatus).catch((e) => setError(e.message));
  }, [mine]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const action = await dispatch(openPull({ docId: doc.id, sourceBranchId: mine.id, ...form }));
    if (action.error) return setError(action.error.message);
    navigate(`../${action.payload.id}`, { relative: 'path' });
  }

  if (!mine) return <p className="empty">Only owners and members have a draft branch to propose from.</p>;
  const picker = myBranches.length > 1 && (
    <label className="field" style={{ maxWidth: 320 }}>
      Branch to propose
      <select value={mine.id} onChange={(e) => setParams({ branch: e.target.value })}>
        {myBranches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );

  if (status?.openPr) {
    return (
      <section className="doc-page">
        {picker}
        <p>
          <code className="hash">{mine.name}</code> already has an open pull request.{' '}
          <button className="btn" onClick={() => navigate(`../${status.openPr}`, { relative: 'path' })}>
            Go to it
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="doc-page">
      <h2>Propose your draft for the shared document</h2>
      {picker}
      <p className="muted">
        From <code className="hash">{mine.name}</code> into <code className="hash">main</code>.{' '}
        {status && !status.hasChanges && 'Your branch has no saved changes compared with main yet.'}
      </p>
      <form onSubmit={onSubmit} style={{ maxWidth: 560 }}>
        <label className="field">
          Title
          <input value={form.title} onChange={set('title')} required maxLength={140} />
        </label>
        <label className="field">
          What this changes and why
          <textarea rows={4} value={form.description} onChange={set('description')} />
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend>Kind of contribution</legend>
          {Object.entries(contributionTypes).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
              <input type="radio" name="type" value={key} checked={form.contributionType === key} onChange={set('contributionType')} />
              <span>
                {label} <span className="muted">{typeHelp[key]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
          <input type="checkbox" checked={form.aiInvolved} onChange={set('aiInvolved')} />
          AI helped with this change outside PopDoc
        </label>
        <p className="small muted">The reviewer confirms the contribution type when they approve.</p>
        {error && <p className="field-error">{error}</p>}
        <button className="btn btn-primary" disabled={status && !status.hasChanges}>
          Open pull request
        </button>
      </form>
    </section>
  );
}
