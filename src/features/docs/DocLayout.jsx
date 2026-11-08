import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { fetchDoc, selectDoc } from './docsSlice.js';
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

  useEffect(() => {
    dispatch(fetchDoc(docId));
  }, [docId, dispatch]);

  if (!doc) return <p className="empty">{error || 'Opening document…'}</p>;

  return (
    <div className="doc">
      <header className="doc-head">
        <div>
          <h1>{doc.title}</h1>
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
