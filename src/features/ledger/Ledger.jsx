import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/index.js';
import { timeAgo } from '../../lib/format.js';
import { contributionTypes } from '../pulls/pullsSlice.js';
import './Ledger.css';

function statement(doc, data) {
  const lines = [`Contribution statement: ${doc.title}`, `Generated ${new Date().toLocaleString('en-GB')} from merged pull requests in PopDoc.`, ''];
  for (const p of data.people) {
    const parts = Object.entries(p.byType)
      .filter(([, n]) => n)
      .map(([k, n]) => `${n} ${contributionTypes[k].toLowerCase()}`);
    lines.push(`${p.name}: ${parts.length ? parts.join(', ') : 'no merged contributions'}; reviewed ${p.reviews} pull request${p.reviews === 1 ? '' : 's'}.`);
  }
  lines.push('', 'Contribution types were confirmed by the reviewer who approved each pull request.');
  return lines.join('\n');
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function Ledger() {
  const { doc } = useOutletContext();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.ledger.get(doc.id).then(setData).catch((e) => setError(e.message));
  }, [doc.id]);

  async function toggleShare() {
    const res = await api.ledger.setShared(doc.id, { shared: !data.shared });
    setData((d) => ({ ...d, shared: res.shared }));
  }

  if (error) return <p className="empty">{error}</p>;
  if (!data) return <p className="empty">Adding up contributions…</p>;

  const types = Object.keys(contributionTypes);

  return (
    <section className="doc-page ledger">
      <div className="ledger-head">
        <p className="muted">
          Counted by kind of contribution, not by words. Each number is a merged pull request whose type a reviewer confirmed.
        </p>
        <button className="btn" onClick={() => download(`${doc.title} - contribution statement.txt`, statement(doc, data))}>
          Export contribution statement
        </button>
      </div>

      <div className="ledger-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <th scope="col">Member</th>
              {types.map((t) => (
                <th scope="col" key={t} className="num">
                  {contributionTypes[t]}
                </th>
              ))}
              <th scope="col" className="num">
                Reviews
              </th>
              <th scope="col">Last active</th>
            </tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.userId} className={p.inactive ? 'is-inactive' : ''}>
                <th scope="row">{p.name}</th>
                {types.map((t) => (
                  <td key={t} className="num">
                    {p.byType[t] ? (
                      <span className="ticks" aria-label={`${p.byType[t]}`}>
                        {'|'.repeat(Math.min(p.byType[t], 10))}
                        <span className="tick-n">{p.byType[t]}</span>
                      </span>
                    ) : (
                      <span className="faint">0</span>
                    )}
                  </td>
                ))}
                <td className="num">{p.reviews}</td>
                <td>
                  {p.lastActiveAt ? timeAgo(p.lastActiveAt) : 'Never'}
                  {p.inactive && <span className="inactive-flag small">Inactive {data.inactiveAfterDays}+ days</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="ledger-share">
        <h2>Who can see this</h2>
        <p>
          {data.shared
            ? 'The group and the reviewers on this document can see the ledger and the process record.'
            : 'Only the group can see the ledger. Reviewers, such as your instructor, see it only if the group agrees to share it.'}
        </p>
        {doc.myRole === 'owner' && (
          <button className="btn" onClick={toggleShare}>
            {data.shared ? 'Stop sharing with reviewers' : 'Share with reviewers'}
          </button>
        )}
      </section>
    </section>
  );
}
