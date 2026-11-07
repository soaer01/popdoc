import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../api/index.js';
import { formatDate } from '../../lib/format.js';
import { shortHash } from '../../lib/hash.js';
import { verifyCommits } from '../../lib/verify.js';
import { fetchBranches, restoreCommit } from '../branches/branchesSlice.js';
import { originNames } from '../editor/ProvenanceLegend.jsx';
import './History.css';

export default function History() {
  const { doc } = useOutletContext();
  const dispatch = useDispatch();
  const branches = useSelector((s) => s.branches.byDoc[doc.id]);
  const [params, setParams] = useSearchParams();
  const branchId = params.get('branch') || doc.mainBranchId;
  const branch = branches?.find((b) => b.id === branchId);

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState({});
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!branches) dispatch(fetchBranches(doc.id));
  }, [branches, doc.id, dispatch]);

  async function loadPage(cursor, reset) {
    setLoading(true);
    try {
      const page = await api.history.list(branchId, { cursor });
      setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
      setNextCursor(page.nextCursor);
      const checks = await verifyCommits(page.items);
      setVerified((v) => ({ ...v, ...checks }));
      if (reset) setSelected(page.items[0] || null);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setSelected(null);
    setMessage(null);
    loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function onRestore() {
    const action = await dispatch(
      restoreCommit({ branchId, commitId: selected.id, expectedHeadId: items[0]?.id || null })
    );
    if (action.error) return setMessage(action.error.message);
    setMessage(`Restored ${shortHash(selected.id)} as a new save point. Nothing was deleted.`);
    loadPage(0, true);
  }

  const allVerified = items.length > 0 && items.every((c) => verified[c.id]);

  return (
    <div className="history">
      <section className="history-list">
        <div className="history-head">
          <label className="field">
            Branch
            <select value={branchId} onChange={(e) => setParams({ branch: e.target.value })}>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          {items.length > 0 && (
            <p className={`small verify ${allVerified ? 'is-ok' : 'is-bad'}`}>
              {allVerified
                ? `All ${items.length} loaded save points match their hashes.`
                : 'A save point doesn’t match its hash. The history may have been altered.'}
            </p>
          )}
        </div>

        {!loading && items.length === 0 && <p className="empty">No save points on this branch yet.</p>}

        <ol className="dag">
          {items.map((c) => (
            <li key={c.id}>
              <button
                className={`dag-row ${selected?.id === c.id ? 'is-selected' : ''} ${c.parents.length > 1 ? 'is-merge' : ''}`}
                onClick={() => setSelected(c)}
              >
                <span className="dag-dot" aria-hidden="true" />
                <span className="dag-msg">{c.message}</span>
                <span className="dag-meta small muted">
                  <code className="hash">{shortHash(c.id)}</code>
                  <span>{c.authorName}</span>
                  <span>{formatDate(c.createdAt)}</span>
                  {c.parents.length > 1 && <span>Merge</span>}
                  {verified[c.id] === false && <span className="field-error">Hash mismatch</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {nextCursor !== null && items.length > 0 && (
          <button className="btn" onClick={() => loadPage(nextCursor)} disabled={loading}>
            {loading ? 'Loading…' : 'Load older save points'}
          </button>
        )}
      </section>

      <section className="history-view">
        {message && <p className="small history-msg">{message}</p>}
        {selected && (
          <>
            <div className="history-view-head">
              <div>
                <h2>{selected.message}</h2>
                <p className="small muted">
                  {selected.authorName} on <code className="hash">{selected.branchName}</code>, {formatDate(selected.createdAt)}
                </p>
                <p className="small muted">
                  SHA-256 <code className="hash full-hash">{selected.id}</code>
                </p>
              </div>
              {branch?.canEdit && selected.id !== items[0]?.id && (
                <button className="btn" onClick={onRestore}>
                  Restore this version
                </button>
              )}
            </div>
            <article className="sheet doc-sheet">
              {selected.paragraphs.map((p) => (
                <p key={p.id} className={`read-para origin-${p.origin}`} title={originNames[p.origin]}>
                  {p.text}
                </p>
              ))}
              {selected.paragraphs.length === 0 && <p className="muted">This version is empty.</p>}
            </article>
          </>
        )}
      </section>
    </div>
  );
}
