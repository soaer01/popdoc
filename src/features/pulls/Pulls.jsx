import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useOutletContext } from 'react-router-dom';
import { timeAgo } from '../../lib/format.js';
import { contributionTypes, fetchPulls } from './pullsSlice.js';
import './Pulls.css';

const statusNames = { open: 'Open', merged: 'Merged', closed: 'Closed' };

export default function Pulls() {
  const { doc } = useOutletContext();
  const dispatch = useDispatch();
  const list = useSelector((s) => s.pulls.byDoc[doc.id]);
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    dispatch(fetchPulls(doc.id));
  }, [doc.id, dispatch]);

  const shown = (list || []).filter((p) => filter === 'all' || p.status === filter);
  const canOpen = ['owner', 'member'].includes(doc.myRole);

  return (
    <section className="doc-page">
      <div className="pulls-head">
        <div className="pulls-filter" role="group" aria-label="Filter pull requests">
          {['open', 'merged', 'closed', 'all'].map((f) => (
            <button key={f} className={`btn btn-quiet ${filter === f ? 'is-on' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
              {f === 'all' ? 'All' : statusNames[f]}
            </button>
          ))}
        </div>
        {canOpen && (
          <Link to="new" className="btn btn-primary">
            Open pull request
          </Link>
        )}
      </div>

      {list && shown.length === 0 && (
        <p className="empty">
          {filter === 'open'
            ? 'No open pull requests. Save your draft, then open one to share it with the group.'
            : 'Nothing here yet.'}
        </p>
      )}

      <ul className="pull-list">
        {shown.map((p) => (
          <li key={p.id}>
            <Link to={p.id} className={`pull-row is-${p.status}`}>
              <span className="pull-num">#{p.number}</span>
              <span className="pull-main">
                <span className="pull-title">{p.title}</span>
                <span className="small muted">
                  {p.authorName}, {statusNames[p.status].toLowerCase()} {timeAgo(p.mergedAt || p.createdAt)}
                </span>
              </span>
              <span className="pull-tags">
                <span className="tag">{contributionTypes[p.confirmedType || p.contributionType]}</span>
                {p.aiInvolved && <span className="tag tag-ai">AI involved</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
