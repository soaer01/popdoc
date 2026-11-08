import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { diffStats, paragraphDiff } from '../../lib/diff.js';
import { formatDate } from '../../lib/format.js';
import DiffView from './DiffView.jsx';
import AiReview from '../ai/AiReview.jsx';
import {
  approvePull,
  clearPullError,
  closePull,
  commentPull,
  contributionTypes,
  fetchPull,
  mergePull,
} from './pullsSlice.js';
import './PullRequest.css';

const modeText = {
  'fast-forward': 'Main hasn’t moved since this branch started, so it can fast-forward.',
  merge: 'Main has new changes, but none overlap. The paragraphs will be combined automatically.',
  conflicts: 'Some paragraphs were changed on both sides. Resolve them before merging.',
};

export default function PullRequest() {
  const { doc } = useOutletContext();
  const { prId } = useParams();
  const dispatch = useDispatch();
  const { detail, status, busy, error } = useSelector((s) => s.pulls);
  const me = useSelector((s) => s.auth.user);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [commentOn, setCommentOn] = useState(null);
  const [body, setBody] = useState('');
  const [confirmType, setConfirmType] = useState(null);

  useEffect(() => {
    dispatch(clearPullError());
    dispatch(fetchPull(prId));
  }, [prId, dispatch]);

  const loaded = detail?.pr.id === prId ? detail : null;
  const rows = useMemo(() => (loaded ? paragraphDiff(loaded.base, loaded.head) : []), [loaded]);

  if (!loaded) return <p className="empty">{status === 'error' ? error : 'Loading pull request…'}</p>;

  const { pr, plan, myRole } = loaded;
  const stats = diffStats(rows);
  const commentsByPara = pr.comments.reduce((acc, c) => {
    (acc[c.paragraphId || '_'] ||= []).push(c);
    return acc;
  }, {});
  const canReview = ['owner', 'member', 'reviewer'].includes(myRole);
  const canApprove = canReview && !pr.isAuthor && pr.status === 'open' && !pr.approvals.includes(me.id);
  const approved = pr.approvals.length > 0;
  const type = confirmType || pr.confirmedType || pr.contributionType;

  async function submitComment(e) {
    e.preventDefault();
    const action = await dispatch(commentPull({ prId, body, paragraphId: commentOn === '_' ? null : commentOn }));
    if (!action.error) {
      setBody('');
      setCommentOn(null);
    }
  }

  async function merge() {
    const action = await dispatch(mergePull({ prId }));
    if (!action.error) dispatch(fetchPull(prId));
  }

  return (
    <div className="pr">
      <header className="pr-head">
        <p className="small muted">
          <Link to=".." relative="path">
            Pull requests
          </Link>{' '}
          / #{pr.number}
        </p>
        <h2>{pr.title}</h2>
        <p className="pr-meta small">
          <span className={`pr-state is-${pr.status}`}>
            {pr.status === 'open' ? 'Open' : pr.status === 'merged' ? 'Merged' : 'Closed'}
          </span>
          <span>
            {pr.authorName} proposes <code className="hash">{pr.sourceName}</code> into{' '}
            <code className="hash">{pr.targetName}</code>
          </span>
          <span className="tag">{contributionTypes[pr.confirmedType || pr.contributionType]}</span>
          {pr.aiInvolved && <span className="tag tag-ai">AI involved</span>}
        </p>
        {pr.description && <p className="pr-desc">{pr.description}</p>}
      </header>

      <div className="pr-body">
        <section className="pr-diff">
          <div className="pr-diff-bar small">
            <span>
              <span className="ins-count">+{stats.added} words</span>{' '}
              <span className="del-count">−{stats.removed} words</span>
              {stats.moved > 0 && <span> {stats.moved} moved</span>}
            </span>
            <label>
              <input type="checkbox" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} />{' '}
              Show unchanged paragraphs
            </label>
          </div>
          <div className="sheet pr-sheet">
            {rows.every((r) => r.status === 'same') ? (
              <p className="muted">No differences from the common ancestor.</p>
            ) : (
              <DiffView
                rows={rows}
                showUnchanged={showUnchanged}
                commentsByPara={commentsByPara}
                onComment={canReview && pr.status === 'open' ? setCommentOn : null}
              />
            )}
          </div>

          <section className="pr-thread">
            <h3>Discussion</h3>
            {(commentsByPara._ || []).map((c) => (
              <div key={c.id} className="note">
                <strong>{c.authorName}</strong> <span className="muted small">{formatDate(c.createdAt)}</span>
                <p>{c.body}</p>
              </div>
            ))}
            {canReview && pr.status === 'open' && (
              <form onSubmit={submitComment}>
                <label className="field">
                  {commentOn && commentOn !== '_'
                    ? 'Comment on the selected paragraph'
                    : 'Comment on the whole pull request'}
                  <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn" disabled={!body.trim() || busy}>
                    Add comment
                  </button>
                  {commentOn && commentOn !== '_' && (
                    <button type="button" className="btn btn-quiet" onClick={() => setCommentOn(null)}>
                      Comment on the whole thing instead
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>
        </section>

        <aside className="pr-side">
          {pr.kind === 'ai' && <AiReview pr={pr} rows={rows} onDone={() => dispatch(fetchPull(prId))} />}

          {pr.kind !== 'ai' && (
            <section>
              <h3>Review</h3>
              {approved ? (
                <p className="small">Approved by {pr.approvalNames.join(', ')}.</p>
              ) : (
                <p className="small muted">Needs approval from someone other than the author.</p>
              )}
              {canApprove && (
                <>
                  <label className="field">
                    Confirm the contribution type
                    <select value={type} onChange={(e) => setConfirmType(e.target.value)}>
                      {Object.entries(contributionTypes).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => dispatch(approvePull({ prId, confirmedType: type }))}
                  >
                    Approve
                  </button>
                </>
              )}
              {pr.isAuthor && pr.status === 'open' && !approved && (
                <p className="small muted">You opened this, so you can&rsquo;t approve it yourself.</p>
              )}
            </section>
          )}

          {pr.kind !== 'ai' && pr.status === 'open' && plan && (
            <section>
              <h3>Merge</h3>
              <p className="small">{modeText[plan.mode]}</p>
              {plan.mode === 'conflicts' ? (
                <Link
                  to="conflicts"
                  className={`btn btn-primary ${approved ? '' : 'is-disabled'}`}
                  aria-disabled={!approved}
                >
                  Resolve {plan.conflicts.length} conflict{plan.conflicts.length > 1 ? 's' : ''}
                </Link>
              ) : (
                <button className="btn btn-primary" disabled={!approved || busy || !canReview} onClick={merge}>
                  Merge into main
                </button>
              )}
              {doc.round === 'idea' && pr.contributionType === 'wording' && (
                <p className="small muted">Idea round: wording changes wait for the polish round.</p>
              )}
            </section>
          )}

          {pr.kind !== 'ai' && pr.status === 'merged' && (
            <section>
              <h3>Merged</h3>
              <p className="small">
                {formatDate(pr.mergedAt)} as a {pr.mergeMode} merge.
              </p>
              <p className="small muted">
                Commit <code className="hash">{pr.mergeCommitId?.slice(0, 12)}</code>
              </p>
            </section>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          {pr.status === 'open' && (pr.isAuthor || pr.isRequester || myRole === 'owner') && (
            <button className="btn btn-quiet btn-danger" disabled={busy} onClick={() => dispatch(closePull(prId))}>
              Close without merging
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
