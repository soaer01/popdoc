import { Router } from 'express';
import { store } from '../utils/store.js';

const router = Router();

// GET /documents/:docId/ledger
router.get('/documents/:docId/ledger', (req, res) => {
  const { docId } = req.params;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  if (!doc) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  const mergedPrs = store.state.pullRequests.filter(
    (p) => p.docId === docId && p.status === 'merged'
  );

  const people = (doc.members || [])
    .filter((m) => m.role === 'owner' || m.role === 'member')
    .map((m) => {
      const mine = mergedPrs.filter((p) => p.authorId === m.userId);
      const byType = { idea: 0, evidence: 0, structure: 0, wording: 0 };
      mine.forEach((p) => {
        const type = p.confirmedType || p.contributionType;
        if (byType[type] !== undefined) byType[type]++;
      });
      const reviews = store.state.pullRequests.filter(
        (p) => p.docId === docId && p.approvals?.includes(m.userId) && p.kind !== 'ai'
      ).length;

      return {
        userId: m.userId,
        name: store.userName(m.userId),
        byType,
        merged: mine.length,
        reviews,
        lastActiveAt: m.lastActiveAt,
        inactive: false,
        idleDays: 0,
      };
    });

  res.json({
    people,
    shared: doc.ledgerShared || false,
    inactiveAfterDays: 3,
  });
});

// PUT /documents/:docId/ledger/sharing
router.put('/documents/:docId/ledger/sharing', (req, res) => {
  const { docId } = req.params;
  const { shared } = req.body || {};
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  if (!doc) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  doc.ledgerShared = Boolean(shared);
  res.json({ shared: doc.ledgerShared });
});

// PUT /documents/:docId/round
router.put('/documents/:docId/round', (req, res) => {
  const { docId } = req.params;
  const { round } = req.body || {};
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  if (!doc) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  if (['open', 'idea', 'polish'].includes(round)) {
    doc.round = round;
  }

  res.json({ round: doc.round });
});

// GET /documents/:docId/record
router.get('/documents/:docId/record', (req, res) => {
  const { docId } = req.params;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  if (!doc) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  const main = store.findMainBranch(docId);
  const headCommit = store.findCommit(main?.headId);

  const merges = store.state.pullRequests
    .filter((p) => p.docId === docId && p.status === 'merged')
    .map((p) => ({
      number: p.number,
      title: p.title,
      author: store.userName(p.authorId),
      contributionType: p.confirmedType || p.contributionType,
      reviewers: (p.approvals || []).map(store.userName),
      ai: p.aiInvolved ? 'Declared by author' : 'None',
      mergedAt: p.mergedAt,
      mergeCommitId: p.mergeCommitId,
    }));

  const commits = store.state.commits.filter((c) => c.docId === docId);

  res.json({
    document: { id: doc.id, title: doc.title },
    generatedAt: new Date().toISOString(),
    finalHash: main?.headId || '',
    paragraphs: headCommit?.paragraphs || [],
    members: (doc.members || []).map((m) => ({
      name: store.userName(m.userId),
      role: m.role,
    })),
    merges,
    commits,
  });
});

export default router;
