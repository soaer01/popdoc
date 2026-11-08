// Contribution ledger and process record: computed from merged pull requests, never typed in.
import { db, persist, delay, fail } from './db.js';
import { requireDoc, requireUser, roleIn, userName } from './access.js';
import { findCommit } from './branches.js';

const INACTIVE_DAYS = 3;

function mergedIntoMain(doc) {
  return db.pullRequests
    .filter((p) => p.docId === doc.id && p.status === 'merged' && p.targetBranchId === doc.mainBranchId)
    .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));
}

// AI involvement for a main PR: declared by the author, or any merged paragraph with an AI origin.
function aiInvolvement(pr) {
  const head = findCommit(pr.headId);
  const origins = new Set((head?.paragraphs || []).filter((p) => p.authorId === pr.authorId || p.origin !== 'typed').map((p) => p.origin));
  if (origins.has('ai')) return 'AI text accepted';
  if (origins.has('ai-edited')) return 'AI text, edited by a person';
  if (origins.has('translated')) return 'AI translation of own draft';
  if (pr.aiInvolved) return 'Declared by author';
  return 'None';
}

function canSeeLedger(doc, user) {
  const role = roleIn(doc, user.id);
  return role === 'owner' || role === 'member' || (doc.ledgerShared && role === 'reviewer');
}

export const ledger = {
  async get(docId) {
    await delay(200);
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (!canSeeLedger(doc, user)) {
      fail('The group hasn’t shared its contribution ledger with reviewers yet.', 403);
    }
    const prs = mergedIntoMain(doc);
    const now = Date.now();
    const people = doc.members
      .filter((m) => m.role === 'owner' || m.role === 'member')
      .map((m) => {
        const mine = prs.filter((p) => p.authorId === m.userId);
        const byType = { idea: 0, evidence: 0, structure: 0, wording: 0 };
        mine.forEach((p) => byType[p.confirmedType || p.contributionType]++);
        const reviews = db.pullRequests.filter((p) => p.docId === doc.id && p.approvals.includes(m.userId) && p.kind !== 'ai').length;
        const idleDays = m.lastActiveAt ? Math.floor((now - new Date(m.lastActiveAt)) / 86400000) : null;
        return {
          userId: m.userId,
          name: userName(m.userId),
          byType,
          merged: mine.length,
          reviews,
          lastActiveAt: m.lastActiveAt,
          inactive: idleDays === null || idleDays >= INACTIVE_DAYS,
          idleDays,
        };
      });
    return { people, shared: doc.ledgerShared, inactiveAfterDays: INACTIVE_DAYS };
  },

  async setShared(docId, { shared }) {
    await delay();
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (roleIn(doc, user.id) !== 'owner') fail('Only the owner can change who sees the ledger.', 403);
    doc.ledgerShared = Boolean(shared);
    persist();
    return { shared: doc.ledgerShared };
  },

  async setRound(docId, { round }) {
    await delay();
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (roleIn(doc, user.id) !== 'owner') fail('Only the owner can start a round.', 403);
    if (!['open', 'idea', 'polish'].includes(round)) fail('Unknown round.');
    doc.round = round;
    persist();
    return { round };
  },

  async record(docId) {
    await delay(300);
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (!canSeeLedger(doc, user)) fail('The group hasn’t shared its record with reviewers yet.', 403);
    const main = db.branches.find((b) => b.id === doc.mainBranchId);
    const head = findCommit(main.headId);
    return {
      document: { id: doc.id, title: doc.title },
      generatedAt: new Date().toISOString(),
      finalHash: main.headId,
      paragraphs: head?.paragraphs || [],
      members: doc.members.map((m) => ({ name: userName(m.userId), role: m.role })),
      merges: mergedIntoMain(doc).map((p) => ({
        number: p.number,
        title: p.title,
        author: userName(p.authorId),
        contributionType: p.confirmedType || p.contributionType,
        reviewers: p.approvals.map(userName),
        ai: aiInvolvement(p),
        mergedAt: p.mergedAt,
        mergeCommitId: p.mergeCommitId,
      })),
      // Every commit reachable from main, so the record can be re-verified offline.
      commits: (() => {
        const out = [];
        const seen = new Set();
        const queue = main.headId ? [main.headId] : [];
        while (queue.length) {
          const id = queue.shift();
          if (seen.has(id)) continue;
          seen.add(id);
          const c = findCommit(id);
          if (c) {
            out.push(c);
            queue.push(...c.parents);
          }
        }
        return out;
      })(),
    };
  },
};
