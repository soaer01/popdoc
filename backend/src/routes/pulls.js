import { Router } from 'express';
import { store } from '../utils/store.js';
import { hashCommit } from '../utils/hash.js';
import { reachable, mergeBase, threeWayMerge, applyResolutions } from '../utils/merge.js';

const router = Router();

function cleanParagraphs(list, defaultAuthorId) {
  if (!Array.isArray(list)) return [];
  const ORIGINS = ['typed', 'pasted', 'ai', 'ai-edited', 'translated'];
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

function getMergePlan(pr) {
  const source = store.state.branches.find((b) => b.id === pr.sourceBranchId);
  const target = store.state.branches.find((b) => b.id === pr.targetBranchId);
  const commitsMap = new Map(store.state.commits.map((c) => [c.id || c._id, c]));

  if (!target?.headId || reachable(source?.headId, commitsMap).has(target.headId)) {
    return { mode: 'fast-forward', conflicts: [], base: target?.headId || null };
  }

  const baseId = mergeBase(source?.headId, target.headId, store.state.commits);
  const baseParas = store.findCommit(baseId)?.paragraphs || [];
  const targetParas = store.findCommit(target.headId)?.paragraphs || [];
  const sourceParas = store.findCommit(source?.headId)?.paragraphs || [];

  const { paragraphs, conflicts } = threeWayMerge(baseParas, targetParas, sourceParas);
  return {
    mode: conflicts.length ? 'conflicts' : 'merge',
    conflicts,
    paragraphs,
    base: baseId,
  };
}

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
    baseId: mergeBase(source?.headId, main?.headId, store.state.commits),
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

  const doc = store.state.documents.find((d) => d.id === pr.docId || d._id === pr.docId);
  const source = store.state.branches.find((b) => b.id === pr.sourceBranchId);
  const target = store.state.branches.find((b) => b.id === pr.targetBranchId);

  if (pr.status === 'open' && source && target) {
    pr.headId = source.headId;
    pr.baseId = mergeBase(source.headId, target.headId, store.state.commits);
  }

  const plan = pr.status === 'open' ? getMergePlan(pr) : null;
  const baseCommit = store.findCommit(pr.baseId);
  const headCommit = store.findCommit(pr.headId);

  res.json({
    pr: store.prView(pr, user),
    base: baseCommit?.paragraphs || [],
    head: headCommit?.paragraphs || [],
    plan: plan && { mode: plan.mode, conflicts: plan.conflicts },
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

  if (pr.status !== 'open') {
    return res.status(400).json({ message: 'This pull request is already closed.' });
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
        paragraphs: cleanParagraphs(mergedParagraphs, user.id),
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

  if (!target || !source) {
    return res.status(404).json({ message: 'Target or source branch not found.' });
  }

  const plan = getMergePlan(pr);
  let headId;

  if (plan.mode === 'fast-forward') {
    headId = source.headId;
  } else {
    let merged = plan.paragraphs;
    if (plan.mode === 'conflicts') {
      const missing = plan.conflicts.filter((c) => !(resolutions && c.id in resolutions));
      if (missing.length) {
        return res.status(409).json({
          message: `Resolve ${missing.length} conflicting paragraph${missing.length > 1 ? 's' : ''} before merging.`,
        });
      }
      merged = applyResolutions(merged, resolutions);
    }
    const commitData = {
      docId: pr.docId,
      branchId: target.id,
      parents: [target.headId, source.headId],
      authorId: user.id,
      message: `Merge pull request #${pr.number}: ${pr.title}`,
      paragraphs: cleanParagraphs(merged, user.id),
      createdAt: new Date().toISOString(),
    };
    const hash = hashCommit(commitData);
    commitData.id = hash;
    commitData._id = hash;
    store.state.commits.push(commitData);
    headId = hash;
  }

  target.headId = headId;
  pr.status = 'merged';
  pr.mergedAt = new Date().toISOString();
  pr.mergedBy = user.id;
  pr.mergeMode = plan.mode === 'fast-forward' ? 'fast-forward' : 'three-way';
  pr.mergeCommitId = headId;
  pr.headId = source.headId;
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
