import { Router } from 'express';
import { store } from '../utils/store.js';

const router = Router();

// GET /branches/:branchId/commits
router.get('/branches/:branchId/commits', (req, res) => {
  const { branchId } = req.params;
  const cursor = parseInt(req.query.cursor, 10) || 0;
  const limit = parseInt(req.query.limit, 10) || 15;

  const branch = store.state.branches.find((b) => b.id === branchId || b._id === branchId);
  const commits = store.state.commits.filter(
    (c) => c.branchId === branchId || (branch && c.docId === branch.docId)
  );

  const page = commits.slice(cursor, cursor + limit);
  const items = page.map((c) => ({
    ...c,
    id: c.id || c._id,
    authorName: store.userName(c.authorId),
    branchName: branch?.name || 'main',
  }));

  res.json({
    items,
    nextCursor: cursor + limit < commits.length ? cursor + limit : null,
    total: commits.length,
  });
});

// GET /commits/:commitId
router.get('/commits/:commitId', (req, res) => {
  const { commitId } = req.params;
  const commit = store.findCommit(commitId);

  if (!commit) {
    return res.status(404).json({ message: 'Commit not found.' });
  }

  const branch = store.state.branches.find((b) => b.id === commit.branchId);

  res.json({
    ...commit,
    id: commit.id || commit._id,
    authorName: store.userName(commit.authorId),
    branchName: branch?.name || 'main',
  });
});

// POST /branches/:branchId/restore
router.post('/branches/:branchId/restore', (req, res) => {
  const { branchId } = req.params;
  const { commitId } = req.body || {};
  const user = req.user;
  const branch = store.state.branches.find((b) => b.id === branchId || b._id === branchId);

  if (!branch) {
    return res.status(404).json({ message: 'Branch not found.' });
  }

  const doc = store.state.documents.find((d) => d.id === branch.docId || d._id === branch.docId);
  const source = store.findCommit(commitId);

  if (!source) {
    return res.status(404).json({ message: 'Commit not found.' });
  }

  const newCommitId = `c_${Math.random().toString(36).slice(2, 12)}`;
  const restoredCommit = {
    id: newCommitId,
    _id: newCommitId,
    docId: branch.docId,
    branchId: branch.id,
    parents: branch.headId ? [branch.headId] : [],
    authorId: user.id,
    message: `Restore version ${commitId.slice(0, 8)}`,
    paragraphs: source.paragraphs || [],
    createdAt: new Date().toISOString(),
  };

  store.state.commits.push(restoredCommit);
  branch.headId = newCommitId;

  res.json(store.branchPayload(branch, doc, user));
});

export default router;
