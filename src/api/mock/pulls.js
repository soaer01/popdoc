// Pull requests: the only way text reaches main.
import { applyResolutions, threeWayMerge } from '../../lib/merge.js';
import { db, persist, delay, uid, fail } from './db.js';
import { canWrite, requireDoc, requireUser, roleIn, touch, userName } from './access.js';
import { findCommit, isVisible, writeCommit, cleanParagraphs } from './branches.js';

export const CONTRIBUTION_TYPES = ['idea', 'evidence', 'structure', 'wording'];

function ancestorIds(id) {
  const seen = new Set();
  const queue = id ? [id] : [];
  while (queue.length) {
    const x = queue.shift();
    if (seen.has(x)) continue;
    seen.add(x);
    queue.push(...(findCommit(x)?.parents || []));
  }
  return seen;
}

// Nearest common ancestor: the newest commit reachable from both heads.
export function mergeBase(a, b) {
  const fromB = ancestorIds(b);
  return (
    [...ancestorIds(a)]
      .map(findCommit)
      .filter((c) => c && fromB.has(c.id))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]?.id || null
  );
}

const paras = (commitId) => findCommit(commitId)?.paragraphs || [];

function requirePr(prId, user) {
  const pr = db.pullRequests.find((p) => p.id === prId);
  if (!pr) fail('That pull request doesn’t exist.', 404);
  const doc = requireDoc(pr.docId, user);
  if (pr.kind === 'ai' && pr.aiRequestedBy !== user.id)
    fail('AI proposals are private to the person who asked for them.', 403);
  return { pr, doc };
}

// Work out how the PR would merge right now.
export function mergePlan(pr) {
  const source = db.branches.find((b) => b.id === pr.sourceBranchId);
  const target = db.branches.find((b) => b.id === pr.targetBranchId);
  if (!target.headId || ancestorIds(source.headId).has(target.headId)) {
    return { mode: 'fast-forward', conflicts: [], base: target.headId };
  }
  const base = mergeBase(source.headId, target.headId);
  const { paragraphs, conflicts } = threeWayMerge(paras(base), paras(target.headId), paras(source.headId));
  return { mode: conflicts.length ? 'conflicts' : 'merge', conflicts, paragraphs, base };
}

function prView(pr, user) {
  const source = db.branches.find((b) => b.id === pr.sourceBranchId);
  return {
    ...pr,
    authorName: pr.aiRequestedBy ? `AI assistant for ${userName(pr.aiRequestedBy)}` : userName(pr.authorId),
    sourceName: source?.name,
    approvalNames: pr.approvals.map(userName),
    comments: pr.comments.map((c) => ({ ...c, authorName: userName(c.authorId) })),
    isAuthor: pr.authorId === user.id,
    isRequester: pr.aiRequestedBy === user.id,
    targetName: db.branches.find((b) => b.id === pr.targetBranchId)?.name,
  };
}

// The requester goes through each AI change: accept it, edit it, or reject it.
// Accepted text keeps the 'ai' origin; edited text becomes 'ai-edited'; rejected keeps the draft's text.
async function mergeAiProposal(pr, doc, user, selections) {
  if (pr.aiRequestedBy !== user.id) fail('Only the person who asked the AI can review its proposal.', 403);
  const target = db.branches.find((b) => b.id === pr.targetBranchId);
  const proposed = new Map(paras(pr.headId).map((p) => [p.id, p]));
  const base = new Map(paras(pr.baseId).map((p) => [p.id, p]));
  let changed = 0;
  const merged = paras(target.headId).map((p) => {
    const ai = proposed.get(p.id);
    if (!ai || ai.text === base.get(p.id)?.text) return p;
    const pick = selections[p.id];
    if (pick === 'accept') {
      changed++;
      return ai;
    }
    if (pick && typeof pick === 'object' && pick.text?.trim()) {
      changed++;
      return {
        ...ai,
        text: pick.text,
        origin: ai.origin === 'translated' ? 'translated' : 'ai-edited',
        authorId: user.id,
      };
    }
    return p;
  });
  let headId = target.headId;
  if (changed) {
    const c = await writeCommit({
      doc,
      branch: target,
      authorId: user.id,
      message: `Apply ${changed} AI change${changed > 1 ? 's' : ''} from pull request #${pr.number}`,
      paragraphs: cleanParagraphs(merged),
      parents: [target.headId, pr.headId],
    });
    headId = c.id;
    target.headId = headId;
  }
  Object.assign(pr, {
    status: changed ? 'merged' : 'closed',
    mergedAt: new Date().toISOString(),
    mergedBy: user.id,
    mergeMode: 'reviewed AI proposal',
    mergeCommitId: changed ? headId : null,
    approvals: [user.id],
    acceptedCount: changed,
  });
  touch(doc, user.id);
  persist();
  return prView(pr, user);
}

export const pulls = {
  async list(docId) {
    await delay(200);
    const user = requireUser();
    const doc = requireDoc(docId, user);
    return db.pullRequests
      .filter((p) => p.docId === doc.id && (p.kind !== 'ai' || p.aiRequestedBy === user.id))
      .sort((a, b) => b.number - a.number)
      .map((p) => prView(p, user));
  },

  async get(prId) {
    await delay(200);
    const user = requireUser();
    const { pr, doc } = requirePr(prId, user);
    const source = db.branches.find((b) => b.id === pr.sourceBranchId);
    if (pr.status === 'open') {
      pr.headId = source.headId; // open PRs follow their branch
      pr.baseId = mergeBase(source.headId, db.branches.find((b) => b.id === pr.targetBranchId).headId);
    }
    const plan = pr.status === 'open' ? mergePlan(pr) : null;
    return {
      pr: prView(pr, user),
      base: paras(pr.baseId),
      head: paras(pr.headId),
      plan: plan && { mode: plan.mode, conflicts: plan.conflicts },
      round: doc.round,
      myRole: roleIn(doc, user.id),
    };
  },

  async open(docId, { sourceBranchId, title, description, contributionType, aiInvolved }) {
    await delay();
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (!canWrite(doc, user)) fail('Only owners and members can open pull requests.', 403);
    const source = db.branches.find((b) => b.id === sourceBranchId && b.docId === doc.id);
    if (!source || source.ownerId !== user.id) fail('You can only open pull requests from your own branch.', 403);
    if (!title?.trim()) fail('Give the pull request a title.');
    if (!CONTRIBUTION_TYPES.includes(contributionType)) fail('Choose what kind of contribution this is.');
    if (db.pullRequests.some((p) => p.sourceBranchId === source.id && p.status === 'open')) {
      fail('This branch already has an open pull request.', 409);
    }
    const target = db.branches.find((b) => b.id === doc.mainBranchId);
    if (source.headId === target.headId) fail('Your branch has no changes compared with main.');
    const number = Math.max(0, ...db.pullRequests.filter((p) => p.docId === doc.id).map((p) => p.number)) + 1;
    const pr = {
      id: uid('pr'),
      number,
      docId: doc.id,
      sourceBranchId: source.id,
      targetBranchId: target.id,
      authorId: user.id,
      title: title.trim().slice(0, 140),
      description: String(description || '').slice(0, 4000),
      contributionType,
      confirmedType: null,
      aiInvolved: Boolean(aiInvolved),
      status: 'open',
      baseId: mergeBase(source.headId, target.headId),
      headId: source.headId,
      approvals: [],
      comments: [],
      createdAt: new Date().toISOString(),
    };
    db.pullRequests.push(pr);
    touch(doc, user.id);
    persist();
    return prView(pr, user);
  },

  async comment(prId, { body, paragraphId }) {
    await delay(150);
    const user = requireUser();
    const { pr, doc } = requirePr(prId, user);
    if (roleIn(doc, user.id) === 'viewer') fail('Viewers can’t comment.', 403);
    if (!body?.trim()) fail('Write a comment first.');
    pr.comments.push({
      id: uid('cm'),
      authorId: user.id,
      paragraphId: paragraphId || null,
      body: body.trim().slice(0, 2000),
      createdAt: new Date().toISOString(),
    });
    touch(doc, user.id);
    persist();
    return prView(pr, user);
  },

  async approve(prId, { confirmedType }) {
    await delay();
    const user = requireUser();
    const { pr, doc } = requirePr(prId, user);
    const role = roleIn(doc, user.id);
    if (!['owner', 'member', 'reviewer'].includes(role)) fail('Your role can’t approve pull requests.', 403);
    if (pr.authorId === user.id) fail('Someone other than the author has to approve this.', 403);
    if (pr.status !== 'open') fail('This pull request is already closed.');
    if (!pr.approvals.includes(user.id)) pr.approvals.push(user.id);
    if (CONTRIBUTION_TYPES.includes(confirmedType)) pr.confirmedType = confirmedType;
    touch(doc, user.id);
    persist();
    return prView(pr, user);
  },

  async merge(prId, { resolutions, selections } = {}) {
    await delay(400);
    const user = requireUser();
    const { pr, doc } = requirePr(prId, user);
    if (pr.status !== 'open') fail('This pull request is already closed.');
    if (pr.kind === 'ai') return mergeAiProposal(pr, doc, user, selections || {});
    if (!['owner', 'member', 'reviewer'].includes(roleIn(doc, user.id))) fail('Your role can’t merge.', 403);
    if (!pr.approvals.some((id) => id !== pr.authorId && id !== pr.aiRequestedBy)) {
      fail('Merging needs an approval from someone other than the author.', 403);
    }
    if (doc.round === 'idea' && pr.contributionType === 'wording' && pr.authorId !== doc.ownerId) {
      fail('This is an idea round. Wording changes are held until the owner starts the polish round.', 409);
    }

    const source = db.branches.find((b) => b.id === pr.sourceBranchId);
    const target = db.branches.find((b) => b.id === pr.targetBranchId);
    const plan = mergePlan(pr);

    let headId;
    if (plan.mode === 'fast-forward') {
      headId = source.headId;
    } else {
      let merged = plan.paragraphs;
      if (plan.mode === 'conflicts') {
        const missing = plan.conflicts.filter((c) => !(resolutions && c.id in resolutions));
        if (missing.length)
          fail(`Resolve ${missing.length} conflicting paragraph${missing.length > 1 ? 's' : ''} before merging.`, 409);
        merged = applyResolutions(merged, resolutions);
      }
      const c = await writeCommit({
        doc,
        branch: target,
        authorId: user.id,
        message: `Merge pull request #${pr.number}: ${pr.title}`,
        paragraphs: cleanParagraphs(merged),
        parents: [target.headId, source.headId],
      });
      headId = c.id;
    }

    target.headId = headId;
    Object.assign(pr, {
      status: 'merged',
      mergedAt: new Date().toISOString(),
      mergedBy: user.id,
      mergeMode: plan.mode === 'fast-forward' ? 'fast-forward' : 'three-way',
      mergeCommitId: headId,
      headId: source.headId,
      confirmedType: pr.confirmedType || pr.contributionType,
    });
    touch(doc, user.id);
    persist();
    return prView(pr, user);
  },

  async close(prId) {
    await delay();
    const user = requireUser();
    const { pr, doc } = requirePr(prId, user);
    if (pr.authorId !== user.id && pr.aiRequestedBy !== user.id && roleIn(doc, user.id) !== 'owner') {
      fail('Only the author or the owner can close this.', 403);
    }
    pr.status = 'closed';
    persist();
    return prView(pr, user);
  },

  // Used by the draft screen to decide whether "Open pull request" makes sense.
  async branchStatus(branchId) {
    await delay(100);
    const user = requireUser();
    const branch = db.branches.find((b) => b.id === branchId);
    if (!branch || !isVisible(branch, user)) fail('That branch isn’t available.', 404);
    const doc = requireDoc(branch.docId, user);
    const main = db.branches.find((b) => b.id === doc.mainBranchId);
    return {
      hasChanges: branch.headId !== main.headId && !ancestorIds(main.headId).has(branch.headId),
      openPr: db.pullRequests.find((p) => p.sourceBranchId === branch.id && p.status === 'open')?.id || null,
    };
  },
};
