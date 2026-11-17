import { Router } from 'express';
import { store } from '../utils/store.js';
import { hashCommit } from '../utils/hash.js';
import { reachable, mergeBase, threeWayMerge, applyResolutions } from '../utils/merge.js';

const router = Router();

const ORIGINS = ['typed', 'pasted', 'ai', 'ai-edited', 'translated'];

function cleanParagraphs(list, defaultAuthorId) {
  if (!Array.isArray(list)) return [];
  return list.map((p) => ({
    id: String(p.id || `p_${Math.random().toString(36).slice(2, 10)}`),
    text: String(p.text ?? '')
      .replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
      .slice(0, 10000),
    origin: ORIGINS.includes(p.origin) ? p.origin : 'typed',
    authorId: p.authorId || defaultAuthorId || null,
    ...(p.prNumber ? { prNumber: p.prNumber } : {}),
  }));
}

// GET /documents/:docId/branches
router.get('/documents/:docId/branches', (req, res) => {
  const { docId } = req.params;
  const user = req.user;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);
  const branches = store.state.branches
    .filter((b) => b.docId === docId)
    .map((b) => store.branchView(b, doc, user));
  res.json(branches);
});

// POST /documents/:docId/branches
router.post('/documents/:docId/branches', (req, res) => {
  const { docId } = req.params;
  const { name, fromCommitId } = req.body || {};
  const user = req.user;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  const main = store.findMainBranch(docId);
  const userPrefix = user?.email ? user.email.split('@')[0] : 'draft';
  const branchName = name ? `${userPrefix}/${name}` : `${userPrefix}/draft-${Date.now().toString(36)}`;
  const branchId = `b_${Math.random().toString(36).slice(2, 10)}`;

  const newBranch = {
    id: branchId,
    _id: branchId,
    docId,
    name: branchName,
    kind: 'member',
    ownerId: user.id,
    headId: fromCommitId || main?.headId || null,
    forkedFrom: fromCommitId || main?.headId || null,
    invited: [],
  };

  store.state.branches.push(newBranch);
  res.status(201).json(store.branchView(newBranch, doc, user));
});

// PUT /documents/:docId/branches/mine
router.put('/documents/:docId/branches/mine', (req, res) => {
  const { docId } = req.params;
  const user = req.user;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  let mine = store.state.branches.find(
    (b) => b.docId === docId && b.kind === 'member' && b.ownerId === user.id
  );

  if (!mine) {
    const main = store.findMainBranch(docId);
    const userPrefix = user?.email ? user.email.split('@')[0] : 'user';
    mine = {
      id: `b_${Math.random().toString(36).slice(2, 10)}`,
      _id: `b_${Math.random().toString(36).slice(2, 10)}`,
      docId,
      name: `${userPrefix}/draft`,
      kind: 'member',
      ownerId: user.id,
      headId: main?.headId || null,
      invited: [],
    };
    store.state.branches.push(mine);
  }

  res.json(store.branchView(mine, doc, user));
});

// GET /branches/:branchId
router.get('/branches/:branchId', (req, res) => {
  const { branchId } = req.params;
  const user = req.user;
  const branch = store.state.branches.find((b) => b.id === branchId || b._id === branchId);

  if (!branch) {
    return res.status(404).json({ message: 'Branch not found.' });
  }

  const doc = store.state.documents.find((d) => d.id === branch.docId || d._id === branch.docId);
  res.json(store.branchPayload(branch, doc, user));
});

// POST /branches/:branchId/commits
router.post('/branches/:branchId/commits', (req, res) => {
  const { branchId } = req.params;
  const { message, paragraphs, expectedHeadId } = req.body || {};
  const user = req.user;
  const branch = store.state.branches.find((b) => b.id === branchId || b._id === branchId);

  if (!branch) {
    return res.status(404).json({ message: 'Branch not found.' });
  }

  // Compare-and-set: verify branch head hasn't moved unexpectedly
  if (expectedHeadId !== undefined && branch.headId !== expectedHeadId) {
    return res.status(409).json({
      message: 'This branch changed since you opened it. Reload it to see the latest save point.',
    });
  }

  const doc = store.state.documents.find((d) => d.id === branch.docId || d._id === branch.docId);
  const cleanedParagraphs = cleanParagraphs(paragraphs, user.id);

  const newCommit = {
    docId: branch.docId,
    branchId: branch.id,
    parents: branch.headId ? [branch.headId] : [],
    authorId: user.id,
    message: String(message || '').trim().slice(0, 200) || 'Save point',
    paragraphs: cleanedParagraphs,
    createdAt: new Date().toISOString(),
  };

  const hash = hashCommit(newCommit);
  newCommit.id = hash;
  newCommit._id = hash;

  store.state.commits.push(newCommit);
  branch.headId = hash;

  res.status(201).json(store.branchPayload(branch, doc, user));
});

// POST /branches/:branchId/update-from-main
router.post('/branches/:branchId/update-from-main', (req, res) => {
  const { branchId } = req.params;
  const { expectedHeadId, resolutions } = req.body || {};
  const user = req.user;
  const branch = store.state.branches.find((b) => b.id === branchId || b._id === branchId);

  if (!branch) {
    return res.status(404).json({ message: 'Branch not found.' });
  }

  const doc = store.state.documents.find((d) => d.id === branch.docId || d._id === branch.docId);
  const main = store.findMainBranch(branch.docId);

  if (expectedHeadId !== undefined && branch.headId !== expectedHeadId) {
    return res.status(409).json({ message: 'This branch changed since you opened it. Reload it first.' });
  }

  const commitsMap = new Map(store.state.commits.map((c) => [c.id || c._id, c]));
  if (!main?.headId || reachable(branch.headId, commitsMap).has(main.headId)) {
    return res.json(store.branchPayload(branch, doc, user));
  }

  if (!branch.headId || reachable(main.headId, commitsMap).has(branch.headId)) {
    branch.headId = main.headId;
  } else {
    const baseId = mergeBase(branch.headId, main.headId, store.state.commits);
    const base = store.findCommit(baseId)?.paragraphs || [];
    const mine = store.findCommit(branch.headId)?.paragraphs || [];
    const theirs = store.findCommit(main.headId)?.paragraphs || [];
    let { paragraphs, conflicts } = threeWayMerge(base, mine, theirs);

    if (conflicts.length) {
      const missing = conflicts.filter(
        (c) => !resolutions || (!['mine', 'main'].includes(resolutions[c.id]) && !resolutions[c.id])
      );
      if (missing.length) {
        return res.json({ ...store.branchPayload(branch, doc, user), conflicts });
      }
      const chosen = Object.fromEntries(
        conflicts.map((c) => [
          c.id,
          resolutions[c.id] === 'mine'
            ? c.current
            : resolutions[c.id] === 'main'
            ? c.incoming
            : resolutions[c.id],
        ])
      );
      paragraphs = applyResolutions(paragraphs, chosen);
    }

    const commitData = {
      docId: branch.docId,
      branchId: branch.id,
      parents: [branch.headId, main.headId],
      authorId: user.id,
      message: 'Update from main',
      paragraphs: cleanParagraphs(paragraphs, user.id),
      createdAt: new Date().toISOString(),
    };
    const hash = hashCommit(commitData);
    commitData.id = hash;
    commitData._id = hash;
    store.state.commits.push(commitData);
    branch.headId = hash;
  }

  res.json(store.branchPayload(branch, doc, user));
});

// GET /branches/:branchId/status
router.get('/branches/:branchId/status', (req, res) => {
  const { branchId } = req.params;
  const branch = store.state.branches.find((b) => b.id === branchId || b._id === branchId);

  if (!branch) {
    return res.status(404).json({ message: 'Branch not found.' });
  }

  const main = store.findMainBranch(branch.docId);
  const commitsMap = new Map(store.state.commits.map((c) => [c.id || c._id, c]));
  const hasChanges =
    Boolean(main) &&
    branch.headId !== main.headId &&
    !reachable(main.headId, commitsMap).has(branch.headId);

  const openPr = store.state.pullRequests.find(
    (p) => p.sourceBranchId === branch.id && p.status === 'open'
  );

  res.json({
    hasChanges,
    openPr: openPr ? openPr.id : null,
  });
});

export default router;
