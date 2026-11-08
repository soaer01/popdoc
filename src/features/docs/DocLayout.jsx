import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { fetchDoc, renameDoc, selectDoc } from './docsSlice.js';
import './DocLayout.css';

const roleSentence = {
  owner: 'You own this document.',
  member: 'You’re a member of this document.',
  reviewer: 'You’re reviewing this document.',
  viewer: 'You can read this document.',
};

const tabs = [
  { to: '.', label: 'Draft', end: true },
  { to: 'pulls', label: 'Pull requests' },
  { to: 'history', label: 'History' },
  { to: 'ledger', label: 'Ledger' },
  { to: 'record', label: 'Process record' },
  { to: 'members', label: 'People and rounds' },
];

export default function DocLayout() {
  const { docId } = useParams();
  const dispatch = useDispatch();
  const doc = useSelector(selectDoc(docId));
  const error = useSelector((s) => s.docs.error);
  const [title, setTitle] = useState(null); // null while not renaming
  const [renameError, setRenameError] = useState(null);

  useEffect(() => {
    dispatch(fetchDoc(docId));
  }, [docId, dispatch]);

  async function onRename(e) {
    e.preventDefault();
    const action = await dispatch(renameDoc({ docId, title }));
    if (action.error) return setRenameError(action.error.message);
    setTitle(null);
  }

  if (!doc) return <p className="empty">{error || 'Opening document…'}</p>;

  return (
    <div className="doc">
      <header className="doc-head">
        <div>
          {title === null ? (
            <div className="doc-title">
              <h1>{doc.title}</h1>
              {['owner', 'member'].includes(doc.myRole) && (
                <button className="btn btn-quiet small" onClick={() => { setTitle(doc.title); setRenameError(null); }}>
                  Rename
                </button>
              )}
            </div>
          ) : (
            <form className="doc-title" onSubmit={onRename}>
              <input
                aria-label="Document title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setTitle(null)}
                maxLength={140}
                autoFocus
              />
              <button className="btn btn-primary small" disabled={!title.trim()}>Save title</button>
              <button type="button" className="btn btn-quiet small" onClick={() => setTitle(null)}>Cancel</button>
              {renameError && <p className="field-error">{renameError}</p>}
            </form>
          )}
          <p className="small muted">
            {roleSentence[doc.myRole]}
            {doc.round === 'idea' && ' Idea round: wording edits are on hold.'}
            {doc.round === 'polish' && ' Polish round: wording edits can be merged.'}
          </p>
        </div>
        <nav className="doc-tabs" aria-label="Document sections">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet context={{ doc }} />
    </div>
  );
}
