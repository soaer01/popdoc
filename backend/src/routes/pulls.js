import { Router } from 'express';
import { store } from '../utils/store.js';
import { hashCommit } from '../utils/hash.js';

const router = Router();

// GET /documents/:docId/pulls
router.get('/documents/:docId/pulls', (req, res) => {
  const { docId } = req.params;
  const user = req.user;
  const prs = store.state.pullRequests
    .filter((p) => p.docId === docId && (p.kind !== 'ai' || p.aiRequestedBy === user.id))
    .sort((a, b) => (b.number || 0) - (a.number || 0))
    .map((p) => store.prView(p, user));
  res.json(prs);
});

// POST /documents/:docId/pulls
router.post('/documents/:docId/pulls', (req, res) => {
  const { docId } = req.params;
  const { sourceBranchId, title, description, contributionType, aiInvolved } = req.body || {};
  const user = req.user;
  const main = store.findMainBranch(docId);
  const source = store.state.branches.find((b) => b.id === sourceBranchId);

  const existingPrs = store.state.pullRequests.filter((p) => p.docId === docId);
  const nextNumber = Math.max(0, ...existingPrs.map((p) => p.number || 0)) + 1;
  const prId = `pr_${Math.random().toString(36).slice(2, 10)}`;

  const newPr = {
    id: prId,
    _id: prId,
    number: nextNumber,
    docId,
    kind: 'member',
    sourceBranchId,
    targetBranchId: main?.id || 'b_main',
    authorId: user.id,
    title: (title || 'Pull Request').trim().slice(0, 140),
    description: String(description || '').slice(0, 4000),
    contributionType: contributionType || 'evidence',
    confirmedType: null,
    aiInvolved: Boolean(aiInvolved),
    status: 'open',
    baseId: main?.headId || null,
    headId: source?.headId || null,
    approvals: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };

  store.state.pullRequests.push(newPr);
  res.status(201).json(store.prView(newPr, user));
});

// GET /pulls/:prId
router.get('/pulls/:prId', (req, res) => {
  const { prId } = req.params;
  const user = req.user;
  const pr = store.state.pullRequests.find((p) => p.id === prId || p._id === prId);

  if (!pr) {
    return res.status(404).json({ message: 'Pull request not found.' });
  }

  const doc = store.state.documents.find((d) => d.id === pr.docId || d._id === docId);
  const baseCommit = store.findCommit(pr.baseId);
  const headCommit = store.findCommit(pr.headId);

  res.json({
    pr: store.prView(pr, user),
    base: baseCommit?.paragraphs || [],
    head: headCommit?.paragraphs || [],
    plan: { mode: 'fast-forward', conflicts: [] },
    round: doc?.round || 'open',
    myRole: doc ? store.roleIn(doc, user.id) || 'owner' : 'owner',
  });
});

// POST /pulls/:prId/comments
router.post('/pulls/:prId/comments', (req, res) => {
  const { prId } = req.params;
  const { body, paragraphId } = req.body || {};
  const user = req.user;
  const pr = store.state.pullRequests.find((p) => p.id === prId || p._id === prId);

  if (!pr) {
    return res.status(404).json({ message: 'Pull request not found.' });
  }

  const commentId = `cm_${Math.random().toString(36).slice(2, 10)}`;
  const comment = {
    id: commentId,
    authorId: user.id,
    paragraphId: paragraphId || null,
    body: (body || '').trim().slice(0, 2000),
    createdAt: new Date().toISOString(),
  };

  pr.comments = pr.comments || [];
  pr.comments.push(comment);

  res.json(store.prView(pr, user));
});

// POST /pulls/:prId/approve
router.post('/pulls/:prId/approve', (req, res) => {
  const { prId } = req.params;
  const { confirmedType } = req.body || {};
  const user = req.user;
  const pr = store.state.pullRequests.find((p) => p.id === prId || p._id === prId);

  if (!pr) {
    return res.status(404).json({ message: 'Pull request not found.' });
  }

  pr.approvals = pr.approvals || [];
  if (!pr.approvals.includes(user.id)) {
    pr.approvals.push(user.id);
  }
  if (confirmedType) {
    pr.confirmedType = confirmedType;
  }

  res.json(store.prView(pr, user));
});

// POST /pulls/:prId/merge
router.post('/pulls/:prId/merge', (req, res) => {
  const { prId } = req.params;
  const { resolutions, selections } = req.body || {};
  const user = req.user;
  const pr = store.state.pullRequests.find((p) => p.id === prId || p._id === prId);

  if (!pr) {
    return res.status(404).json({ message: 'Pull request not found.' });
  }

  if (pr.kind === 'ai') {
    // Merge AI proposal into user's draft branch
    const targetBranch = store.state.branches.find((b) => b.id === pr.targetBranchId);
    const targetHead = store.findCommit(targetBranch?.headId);
    const proposedHead = store.findCommit(pr.headId);
    const proposedMap = new Map((proposedHead?.paragraphs || []).map((p) => [p.id, p]));

    let changed = 0;
    const mergedParagraphs = (targetHead?.paragraphs || []).map((p) => {
      const aiPara = proposedMap.get(p.id);
      if (!aiPara) return p;

      const pick = selections?.[p.id];
      if (pick === 'accept') {
        changed++;
        return aiPara;
      }
      if (pick && typeof pick === 'object' && pick.text?.trim()) {
        changed++;
        return {
          ...aiPara,
          text: pick.text.trim(),
          origin: aiPara.origin === 'translated' ? 'translated' : 'ai-edited',
          authorId: user.id,
        };
      }
      return p;
    });

    let headId = targetBranch?.headId;
    if (changed && targetBranch) {
      const commitData = {
        docId: pr.docId,
        branchId: targetBranch.id,
        parents: [targetBranch.headId, pr.headId],
        authorId: user.id,
        message: `Apply ${changed} AI change${changed > 1 ? 's' : ''} from pull request #${pr.number}`,
        paragraphs: mergedParagraphs,
        createdAt: new Date().toISOString(),
      };
      const hash = hashCommit(commitData);
      commitData.id = hash;
      commitData._id = hash;
      store.state.commits.push(commitData);
      headId = hash;
      targetBranch.headId = headId;
    }

    pr.status = changed ? 'merged' : 'closed';
    pr.mergedAt = new Date().toISOString();
    pr.mergedBy = user.id;
    pr.mergeMode = 'reviewed AI proposal';
    pr.mergeCommitId = changed ? headId : null;
    pr.acceptedCount = changed;

    return res.json(store.prView(pr, user));
  }

  // Standard PR merge into target branch
  const target = store.state.branches.find((b) => b.id === pr.targetBranchId);
  const source = store.state.branches.find((b) => b.id === pr.sourceBranchId);

  if (target && source) {
    target.headId = source.headId;
  }

  pr.status = 'merged';
  pr.mergedAt = new Date().toISOString();
  pr.mergedBy = user.id;
  pr.mergeMode = 'fast-forward';
  pr.mergeCommitId = source?.headId || pr.headId;
  pr.confirmedType = pr.confirmedType || pr.contributionType;

  res.json(store.prView(pr, user));
});

// POST /pulls/:prId/close
router.post('/pulls/:prId/close', (req, res) => {
  const { prId } = req.params;
  const user = req.user;
  const pr = store.state.pullRequests.find((p) => p.id === prId || p._id === prId);

  if (!pr) {
    return res.status(404).json({ message: 'Pull request not found.' });
  }

  pr.status = 'closed';
  res.json(store.prView(pr, user));
});

export default router;
