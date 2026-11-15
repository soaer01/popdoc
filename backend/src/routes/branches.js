import { Router } from 'express';
import { store } from '../utils/store.js';

const router = Router();

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
  const { message, paragraphs } = req.body || {};
  const user = req.user;
  const branch = store.state.branches.find((b) => b.id === branchId || b._id === branchId);

  if (!branch) {
    return res.status(404).json({ message: 'Branch not found.' });
  }

  const doc = store.state.documents.find((d) => d.id === branch.docId || d._id === branch.docId);
  const commitId = `c_${Math.random().toString(36).slice(2, 12)}`;

  const newCommit = {
    id: commitId,
    _id: commitId,
    docId: branch.docId,
    branchId: branch.id,
    parents: branch.headId ? [branch.headId] : [],
    authorId: user.id,
    message: (message || 'Save point').trim(),
    paragraphs: paragraphs || [],
    createdAt: new Date().toISOString(),
  };

  store.state.commits.push(newCommit);
  branch.headId = commitId;

  res.status(201).json(store.branchPayload(branch, doc, user));
});

// POST /branches/:branchId/update-from-main
router.post('/branches/:branchId/update-from-main', (req, res) => {
  const { branchId } = req.params;
  const user = req.user;
  const branch = store.state.branches.find((b) => b.id === branchId || b._id === branchId);

  if (!branch) {
    return res.status(404).json({ message: 'Branch not found.' });
  }

  const doc = store.state.documents.find((d) => d.id === branch.docId || d._id === branch.docId);
  const main = store.findMainBranch(branch.docId);

  if (main?.headId) {
    branch.headId = main.headId;
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
  const openPr = store.state.pullRequests.find(
    (p) => p.sourceBranchId === branch.id && p.status === 'open'
  );

  res.json({
    hasChanges: Boolean(main) && branch.headId !== main.headId,
    openPr: openPr ? openPr.id : null,
  });
});

export default router;
