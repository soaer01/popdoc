import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/index.js';
import { formatDate } from '../../lib/format.js';
import { verifyCommits } from '../../lib/verify.js';
import { contributionTypes } from '../pulls/pullsSlice.js';
import './Record.css';

// Checks that every commit's hash matches its content and that every parent is present,
// so the final document hash really does stand for this history.
async function verifyRecord(record) {
  const byId = new Map(record.commits.map((c) => [c.id, c]));
  const hashes = await verifyCommits(record.commits);
  const bad = record.commits.filter((c) => !hashes[c.id]).length;
  const missing = record.commits.flatMap((c) => c.parents).filter((p) => !byId.has(p)).length;
  const headOk = !record.finalHash || byId.has(record.finalHash);
  return { ok: bad === 0 && missing === 0 && headOk, checked: record.commits.length, bad, missing };
}

export default function Record() {
  const { doc } = useOutletContext();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [check, setCheck] = useState(null);

  useEffect(() => {
    api.ledger.record(doc.id).then(setRecord).catch((e) => setError(e.message));
  }, [doc.id]);

  function downloadJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `${doc.title} - process record.json` }).click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p className="empty">{error}</p>;
  if (!record) return <p className="empty">Building the process record…</p>;

  return (
    <section className="doc-page record">
      <div className="record-actions no-print">
        <button className="btn" onClick={async () => setCheck(await verifyRecord(record))}>
          Verify against stored history
        </button>
        <button className="btn" onClick={downloadJson}>
          Download as JSON
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      {check && (
        <p className={`small verify ${check.ok ? 'is-ok' : 'is-bad'} no-print`} role="status">
          {check.ok
            ? `Verified. All ${check.checked} commits match their SHA-256 hashes and the history is complete.`
            : `Verification failed: ${check.bad} commit(s) don’t match their hash and ${check.missing} parent(s) are missing.`}
        </p>
      )}

      <article className="sheet record-sheet">
        <header>
          <h2>Process record</h2>
          <p className="record-title">{record.document.title}</p>
          <dl className="record-facts">
            <div>
              <dt>Final document hash (SHA-256)</dt>
              <dd>
                <code className="hash">{record.finalHash || 'No merges yet'}</code>
              </dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{formatDate(record.generatedAt)}</dd>
            </div>
            <div>
              <dt>Group</dt>
              <dd>{record.members.map((m) => `${m.name} (${m.role})`).join(', ')}</dd>
            </div>
          </dl>
        </header>

        <h3>Merged pull requests, in order</h3>
        {record.merges.length === 0 ? (
          <p className="muted">Nothing has been merged into the shared document yet.</p>
        ) : (
          <table className="record-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Change</th>
                <th scope="col">Author</th>
                <th scope="col">Type</th>
                <th scope="col">AI involvement</th>
                <th scope="col">Approved by</th>
              </tr>
            </thead>
            <tbody>
              {record.merges.map((m) => (
                <tr key={m.number}>
                  <td>{m.number}</td>
                  <td>
                    {m.title}
                    <div className="small muted">
                      {formatDate(m.mergedAt)}, <code className="hash">{m.mergeCommitId?.slice(0, 12)}</code>
                    </div>
                  </td>
                  <td>{m.author}</td>
                  <td>{contributionTypes[m.contributionType]}</td>
                  <td>{m.ai}</td>
                  <td>{m.reviewers.join(', ') || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted record-foot">
          This record covers work done inside PopDoc. Pasted text is flagged, but text retyped from another window
          can&rsquo;t be detected. Anyone with the JSON export can recompute each hash to check it.
        </p>
      </article>
    </section>
  );
}
