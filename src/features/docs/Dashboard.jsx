import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { roleNames, timeAgo } from '../../lib/format.js';
import { createDoc, fetchDocs } from './docsSlice.js';
import './Dashboard.css';

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { ids, byId, status, error } = useSelector((s) => s.docs);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    dispatch(fetchDocs());
  }, [dispatch]);

  async function onCreate(e) {
    e.preventDefault();
    if (!title.trim()) return setFormError('Give the document a title.');
    setCreating(true);
    const action = await dispatch(createDoc({ title }));
    setCreating(false);
    if (action.error) return setFormError(action.error.message);
    navigate(`/docs/${action.payload.id}`);
  }

  const docs = ids.map((id) => byId[id]);

  return (
    <main className="dash">
      <div className="dash-head">
        <h1>Documents</h1>
        <form className="dash-new" onSubmit={onCreate}>
          <label className="visually-hidden" htmlFor="new-title">
            New document title
          </label>
          <input
            id="new-title"
            placeholder="Title of a new document"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setFormError(null);
            }}
          />
          <button className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create document'}
          </button>
        </form>
      </div>
      {formError && <p className="field-error">{formError}</p>}

      {status === 'loading' && <p className="empty">Loading your documents…</p>}
      {status === 'error' && <p className="field-error">{error}</p>}
      {status === 'ready' && docs.length === 0 && (
        <p className="empty">You aren&rsquo;t in any documents yet. Create one above, or ask a group owner to add you.</p>
      )}

      <ul className="doc-list">
        {docs.map((d) => (
          <li key={d.id}>
            <Link to={`/docs/${d.id}`} className="doc-row">
              <span className="doc-title">{d.title}</span>
              <span className="doc-meta">
                <span>{roleNames[d.myRole]}</span>
                <span>{d.members.length} {d.members.length === 1 ? 'person' : 'people'}</span>
                <span>Created {timeAgo(d.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
