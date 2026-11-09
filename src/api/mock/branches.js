// Branches and commits. Branches are private by default: you see main, your own branches,
// branches you were invited to, and any branch with an open pull request.
import { hashCommit } from '../../lib/hash.js';
import { applyResolutions, threeWayMerge } from '../../lib/merge.js';
import { db, persist, delay, uid, fail } from './db.js';
import { canWrite, requireDoc, requireUser, touch, userName } from './access.js';

const ORIGINS = ['typed', 'pasted', 'ai', 'ai-edited', 'translated'];

export function isVisible(branch, user) {
  return (
    branch.kind === 'main' ||
    branch.ownerId === user.id ||
    branch.invited.includes(user.id) ||
    db.pullRequests.some((pr) => pr.sourceBranchId === branch.id && pr.status === 'open' && pr.kind !== 'ai')
  );
}

export function branchView(branch, doc, user) {
  return {
    ...branch,
    ownerName: branch.ownerId ? userName(branch.ownerId) : null,
    isMine: branch.ownerId === user.id,
    canEdit:
      branch.kind === 'member' &&
      canWrite(doc, user) &&
      (branch.ownerId === user.id || branch.invited.includes(user.id)),
  };
}

export const findCommit = (id) => db.commits.find((c) => c.id === id) || null;

// Every commit reachable from a head, following all parents.
export function reachable(headId) {
  const seen = new Set();
  const queue = headId ? [headId] : [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(findCommit(id)?.parents || []));
  }
  return seen;
}

// Nearest common ancestor: the newest commit reachable from both heads.
export function mergeBase(a, b) {
  const fromB = reachable(b);
  return (
    [...reachable(a)]
      .map(findCommit)
      .filter((c) => c && fromB.has(c.id))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]?.id || null
  );
}

// What the draft screen gets for a branch: the branch, its head, and whether main has moved on.
export function branchPayload(branch, doc, user) {
  const main = db.branches.find((b) => b.id === doc.mainBranchId);
  return {
    branch: branchView(branch, doc, user),
    head: findCommit(branch.headId),
    behindMain: branch.kind === 'member' && Boolean(main.headId) && !reachable(branch.headId).has(main.headId),
  };
}

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

// Server-side validation of submitted paragraphs (the backend will also sanitize rich text).
export function cleanParagraphs(list) {
  if (!Array.isArray(list)) fail('Paragraphs must be a list.');
  return list.map((p) => ({
    id: String(p.id || uid('p')),
    text: String(p.text ?? '')
      .replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
      .slice(0, 10000),
    origin: ORIGINS.includes(p.origin) ? p.origin : 'typed',
    authorId: p.authorId || null,
    ...(p.prNumber ? { prNumber: p.prNumber } : {}),
  }));
}

export async function writeCommit({ doc, branch, authorId, message, paragraphs, parents }) {
  const c = {
    docId: doc.id,
    branchId: branch.id,
    parents,
    authorId,
    message,
    paragraphs,
    createdAt: new Date().toISOString(),
  };
  c.id = await hashCommit(c);
  db.commits.push(c);
  return c;
}

export const branches = {
  async list(docId) {
    await delay(150);
    const user = requireUser();
    const doc = requireDoc(docId, user);
    return db.branches.filter((b) => b.docId === doc.id && isVisible(b, user)).map((b) => branchView(b, doc, user));
  },

  // Every writer gets one private draft branch, forked from main the first time they open the doc.
  async ensureMine(docId) {
    await delay(150);
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (!canWrite(doc, user)) return null;
    let mine = db.branches.find((b) => b.docId === doc.id && b.kind === 'member' && b.ownerId === user.id);
    if (!mine) {
      const main = db.branches.find((b) => b.id === doc.mainBranchId);
      mine = {
        id: uid('b'),
        docId: doc.id,
        name: `${slug(user.email.split('@')[0])}/draft`,
        kind: 'member',
        ownerId: user.id,
        headId: main.headId,
        invited: [],
      };
      db.branches.push(mine);
      persist();
    }
    return branchView(mine, doc, user);
  },

  // A new private branch starting at any save point the caller can see.
  // Starting from an old save point is how you try a different direction without losing the current one.
  async create(docId, { name, fromCommitId }) {
    await delay(200);
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (!canWrite(doc, user)) fail('Only owners and members can make branches.', 403);
    const short = slug(name);
    if (!short) fail('Give the branch a name, using letters, numbers or dashes.');
    const fullName = `${slug(user.email.split('@')[0])}/${short}`;
    if (db.branches.some((b) => b.docId === doc.id && b.name === fullName)) fail(`You already have a branch called ${fullName}.`, 409);
    const main = db.branches.find((b) => b.id === doc.mainBranchId);
    const from = fromCommitId || main.headId;
    if (from) {
      const commit = findCommit(from);
      const visible = db.branches.filter((b) => b.docId === doc.id && isVisible(b, user));
      if (!commit || commit.docId !== doc.id || !visible.some((b) => reachable(b.headId).has(from))) {
        fail('No save point you can see has that hash.', 404);
      }
    }
    const branch = { id: uid('b'), docId: doc.id, name: fullName, kind: 'member', ownerId: user.id, headId: from, forkedFrom: from, invited: [] };
    db.branches.push(branch);
    touch(doc, user.id);
    persist();
    return branchView(branch, doc, user);
  },

  async open(branchId) {
    await delay(150);
    const user = requireUser();
    const branch = db.branches.find((b) => b.id === branchId);
    if (!branch) fail('That branch no longer exists.', 404);
    const doc = requireDoc(branch.docId, user);
    if (!isVisible(branch, user)) fail('This branch is private to its owner.', 403);
    return branchPayload(branch, doc, user);
  },

  // Bring main's newer changes into a branch. Fast-forwards if the branch has no saves of its own,
  // otherwise writes a merge save point. Paragraphs changed on both sides come back as conflicts
  // until the caller sends a resolution for each: { [paragraphId]: 'mine' | 'main' }.
  async updateFromMain(branchId, { expectedHeadId, resolutions } = {}) {
    await delay(300);
    const user = requireUser();
    const branch = db.branches.find((b) => b.id === branchId);
    if (!branch) fail('That branch no longer exists.', 404);
    const doc = requireDoc(branch.docId, user);
    if (!branchView(branch, doc, user).canEdit) fail('You can’t update this branch.', 403);
    if (branch.headId !== expectedHeadId) fail('This branch changed since you opened it. Reload it first.', 409);
    const main = db.branches.find((b) => b.id === doc.mainBranchId);
    if (!main.headId || reachable(branch.headId).has(main.headId)) return branchPayload(branch, doc, user);

    if (!branch.headId || reachable(main.headId).has(branch.headId)) {
      branch.headId = main.headId;
    } else {
      const base = findCommit(mergeBase(branch.headId, main.headId))?.paragraphs || [];
      const mine = findCommit(branch.headId).paragraphs;
      const theirs = findCommit(main.headId).paragraphs;
      let { paragraphs, conflicts } = threeWayMerge(base, mine, theirs);
      if (conflicts.length) {
        const missing = conflicts.filter((c) => !['mine', 'main'].includes(resolutions?.[c.id]));
        if (missing.length) return { ...branchPayload(branch, doc, user), conflicts };
        const chosen = Object.fromEntries(conflicts.map((c) => [c.id, resolutions[c.id] === 'mine' ? c.current : c.incoming]));
        paragraphs = applyResolutions(paragraphs, chosen);
      }
      const c = await writeCommit({
        doc,
        branch,
        authorId: user.id,
        message: 'Update from main',
        paragraphs: cleanParagraphs(paragraphs),
        parents: [branch.headId, main.headId],
      });
      branch.headId = c.id;
    }
    touch(doc, user.id);
    persist();
    return branchPayload(branch, doc, user);
  },

  // Compare-and-set on the branch head: if someone else saved first, the client must reload.
  async commit(branchId, { message, paragraphs, expectedHeadId }) {
    await delay();
    const user = requireUser();
    const branch = db.branches.find((b) => b.id === branchId);
    if (!branch) fail('That branch no longer exists.', 404);
    const doc = requireDoc(branch.docId, user);
    if (!branchView(branch, doc, user).canEdit) fail('You can’t save to this branch.', 403);
    if (branch.headId !== expectedHeadId) {
      fail('This branch changed since you opened it. Reload it to see the latest save point.', 409);
    }
    const c = await writeCommit({
      doc,
      branch,
      authorId: user.id,
      message: String(message || '').trim().slice(0, 200) || 'Save point',
      paragraphs: cleanParagraphs(paragraphs),
      parents: branch.headId ? [branch.headId] : [],
    });
    branch.headId = c.id;
    touch(doc, user.id);
    persist();
    return branchPayload(branch, doc, user);
  },
};
