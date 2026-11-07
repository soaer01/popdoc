import { originNames } from '../editor/ProvenanceLegend.jsx';
import './DiffView.css';

const statusLabel = {
  added: 'New paragraph',
  removed: 'Removed',
  changed: 'Edited',
  moved: 'Moved',
};

export default function DiffView({ rows, showUnchanged, commentsByPara = {}, onComment }) {
  return (
    <div className="diff">
      {rows.map((r) => {
        if (r.status === 'same' && !showUnchanged) return null;
        const para = r.after || r.before;
        const comments = commentsByPara[r.id] || [];
        return (
          <div key={r.id} className={`diff-row is-${r.status}`}>
            <div className={`diff-para origin-${para.origin}`}>
              {r.status !== 'same' && (
                <span className="diff-status small">
                  {statusLabel[r.status]}
                  {r.moved && r.status === 'changed' ? ' and moved' : ''}
                  <span className="muted"> {originNames[para.origin]}</span>
                </span>
              )}
              <p>
                {r.status === 'changed'
                  ? r.parts.map((part, i) =>
                      part.added ? (
                        <ins key={i}>{part.value}</ins>
                      ) : part.removed ? (
                        <del key={i}>{part.value}</del>
                      ) : (
                        <span key={i}>{part.value}</span>
                      )
                    )
                  : para.text}
              </p>
            </div>
            {(comments.length > 0 || onComment) && (
              <div className="diff-notes">
                {comments.map((c) => (
                  <div key={c.id} className="note small">
                    <strong>{c.authorName}</strong> {c.body}
                  </div>
                ))}
                {onComment && r.status !== 'removed' && (
                  <button className="btn btn-quiet small" onClick={() => onComment(r.id)}>
                    Comment on this paragraph
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
