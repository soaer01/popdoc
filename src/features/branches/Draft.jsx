import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { shortHash } from '../../lib/hash.js';
import { timeAgo } from '../../lib/format.js';
import Editor from '../editor/Editor.jsx';
import ProvenanceLegend from '../editor/ProvenanceLegend.jsx';
import AiPanel from '../ai/AiPanel.jsx';
import NewBranch from './NewBranch.jsx';
import SyncConflicts from './SyncConflicts.jsx';
import { usePresence } from './usePresence.js';
import { fromDoc, sameContent, wordCount } from '../editor/paragraphs.js';
import { clearBranchError, fetchBranches, openBranch, saveCommit, updateFromMain } from './branchesSlice.js';
import './Draft.css';

export default function Draft() {
  const { doc } = useOutletContext();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const list = useSelector((s) => s.branches.byDoc[doc.id]);
  const { open, status, saving, error, syncConflicts } = useSelector((s) => s.branches);
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState('');
  const [pasteNote, setPasteNote] = useState(false);
  const [branching, setBranching] = useState(false);
  const draftRef = useRef(null);

  useEffect(() => {
    dispatch(fetchBranches(doc.id));
  }, [doc.id, dispatch]);

  // Default to my own branch, else main.
  const branchId = useMemo(() => {
    if (params.get('branch')) return params.get('branch');
    if (!list) return null;
    return (list.find((b) => b.isMine && b.kind === 'member') || list.find((b) => b.kind === 'main'))?.id;
  }, [params, list]);

  const here = usePresence(branchId, user);

  useEffect(() => {
    if (branchId) dispatch(openBranch(branchId));
  }, [branchId, dispatch]);

  const loaded = open?.branch.id === branchId ? open : null;
  const base = loaded?.head?.paragraphs || [];

  useEffect(() => {
    setDraft(null);
    draftRef.current = null;
    setPasteNote(false);
  }, [loaded?.head?.id, branchId]);

  const dirty = draft && !sameContent(draft, base);

  function onChange(json) {
    const next = fromDoc(json, { base, userId: user.id });
    draftRef.current = next;
    setDraft(next);
  }

  async function onSave(e) {
    e.preventDefault();
    if (!dirty) return;
    const action = await dispatch(
      saveCommit({
        branchId,
        message,
        paragraphs: draftRef.current,
        expectedHeadId: loaded.head?.id || null,
      })
    );
    if (!action.error) setMessage('');
  }

  function onUpdate(resolutions) {
    dispatch(updateFromMain({ branchId, expectedHeadId: loaded.head?.id || null, resolutions }));
  }

  return (
    <div className="draft">
      <aside className="rail" aria-label="Branches">
        <h2 className="rail-title">Branches</h2>
        <ul className="branch-list">
          {(list || []).map((b) => (
            <li key={b.id}>
              <button
                className={`branch ${b.id === branchId ? 'is-current' : ''}`}
                onClick={() => setParams({ branch: b.id })}
                aria-current={b.id === branchId ? 'true' : undefined}
              >
                <span className="branch-name">{b.name}</span>
                <span className="small muted">
                  {b.kind === 'main' ? 'Shared document' : b.isMine ? 'Private to you' : `${b.ownerName}, shared for review`}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {['owner', 'member'].includes(doc.myRole) &&
          (branching ? (
            <NewBranch
              docId={doc.id}
              starts={[
                { label: 'main, latest save', commitId: null },
                ...(loaded?.head && loaded.branch.kind !== 'main'
                  ? [{ label: `${loaded.branch.name}, latest save`, commitId: loaded.head.id }]
                  : []),
              ]}
              onCreated={(b) => {
                setBranching(false);
                setParams({ branch: b.id });
              }}
              onCancel={() => setBranching(false)}
            />
          ) : (
            <button className="btn new-branch-btn" onClick={() => setBranching(true)}>
              New branch
            </button>
          ))}
        <p className="small muted rail-note">
          Other members&rsquo; branches stay hidden until they open a pull request. To branch from an older save
          point, pick it in History.
        </p>
      </aside>

      <section className="sheet-wrap">
        {status === 'error' && <p className="field-error">{error}</p>}
        {loaded && (
          <>
            <div className="sheet-bar small muted">
              <span>
                {loaded.branch.canEdit ? 'Editing' : 'Reading'} <strong>{loaded.branch.name}</strong>
              </span>
              <span>
                {loaded.head ? (
                  <>
                    Last save <code className="hash">{shortHash(loaded.head.id)}</code> {timeAgo(loaded.head.createdAt)}
                  </>
                ) : (
                  'No save points yet'
                )}
              </span>
              <span aria-live="polite">
                Here now: {here.map((u) => (u.id === user.id ? 'you' : u.name)).join(', ') || 'you'}
              </span>
            </div>
            {loaded.branch.canEdit && loaded.behindMain && !syncConflicts && (
              <div className="behind-main small" role="status">
                <span>
                  Main has changes this branch doesn&rsquo;t have yet. A branch keeps the version it started from
                  until you bring main&rsquo;s changes in.
                </span>
                <button className="btn" disabled={dirty || saving} onClick={() => onUpdate()}>
                  {saving ? 'Updating…' : 'Update from main'}
                </button>
                {dirty && <span className="muted">Make a save point first, then update.</span>}
              </div>
            )}
            {syncConflicts && (
              <SyncConflicts
                key={loaded.head?.id}
                conflicts={syncConflicts}
                busy={saving}
                onResolve={onUpdate}
                onCancel={() => dispatch(openBranch(branchId))}
              />
            )}
            <article className="sheet doc-sheet">
              <Editor
                key={`${branchId}:${loaded.head?.id}`}
                paragraphs={base}
                editable={loaded.branch.canEdit}
                onChange={onChange}
                onPaste={() => setPasteNote(true)}
              />
            </article>
            {!loaded.branch.canEdit && loaded.branch.kind === 'main' && (
              <p className="small muted">The shared document changes only through merged pull requests.</p>
            )}
          </>
        )}
      </section>

      <aside className="margin" aria-label="Save and provenance">
        {loaded?.branch.canEdit && (
          <form className="save" onSubmit={onSave}>
            <h2 className="rail-title">Save point</h2>
            <p className="small muted">
              {dirty ? 'You have unsaved changes.' : 'Everything is saved.'} {wordCount(draft || base)} words.
            </p>
            <label className="field">
              What changed
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Tighten the opening claim"
                maxLength={200}
              />
            </label>
            <button className="btn btn-primary" disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save point'}
            </button>
            <Link to={`pulls/new?branch=${branchId}`} className="btn open-pr">
              Open pull request
            </Link>
            {pasteNote && (
              <p className="small paste-note">Pasted text is marked in the margin and stays marked in the record.</p>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}{' '}
                <button type="button" className="btn btn-quiet" onClick={() => { dispatch(clearBranchError()); dispatch(openBranch(branchId)); }}>
                  Reload branch
                </button>
              </p>
            )}
          </form>
        )}
        {loaded?.branch.canEdit && loaded.branch.isMine && (
          <AiPanel docId={doc.id} branch={loaded.branch} paragraphs={base.filter((p) => p.text.trim())} dirty={dirty} />
        )}
        <div>
          <h2 className="rail-title">Margin colours</h2>
          <ProvenanceLegend />
        </div>
      </aside>
    </div>
  );
}
