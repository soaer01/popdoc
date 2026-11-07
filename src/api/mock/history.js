// Commit history. History is append-only: restoring an old version writes a new commit.
import { db, persist, delay, fail } from './db.js';
import { requireDoc, requireUser, touch, userName } from './access.js';
import { branchView, findCommit, isVisible, writeCommit } from './branches.js';

function ancestors(headId) {
  const out = [];
  const seen = new Set();
  const queue = headId ? [headId] : [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const c = findCommit(id);
    if (!c) continue;
    out.push(c);
    queue.push(...c.parents);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const branchName = (id) => db.branches.find((b) => b.id === id)?.name || 'deleted branch';

function openVisibleBranch(branchId, user) {
  const branch = db.branches.find((b) => b.id === branchId);
  if (!branch) fail('That branch no longer exists.', 404);
  const doc = requireDoc(branch.docId, user);
  if (!isVisible(branch, user)) fail('This branch is private to its owner.', 403);
  return { branch, doc };
}

export const history = {
  // Cursor pagination: the cursor is the index to continue from.
  async list(branchId, { cursor = 0, limit = 15 } = {}) {
    await delay(200);
    const user = requireUser();
    const { branch } = openVisibleBranch(branchId, user);
    const all = ancestors(branch.headId);
    const page = all.slice(cursor, cursor + limit);
    return {
      items: page.map((c) => ({ ...c, authorName: userName(c.authorId), branchName: branchName(c.branchId) })),
      nextCursor: cursor + limit < all.length ? cursor + limit : null,
      total: all.length,
    };
  },

  async get(commitId) {
    await delay(120);
    const user = requireUser();
    const c = findCommit(commitId);
    if (!c) fail('No save point has that hash.', 404);
    requireDoc(c.docId, user);
    return { ...c, authorName: userName(c.authorId), branchName: branchName(c.branchId) };
  },

  async restore(branchId, { commitId, expectedHeadId }) {
    await delay();
    const user = requireUser();
    const { branch, doc } = openVisibleBranch(branchId, user);
    if (!branchView(branch, doc, user).canEdit) fail('You can only restore into a branch you can edit.', 403);
    if (branch.headId !== expectedHeadId) fail('This branch changed since you opened it. Reload and try again.', 409);
    const source = findCommit(commitId);
    if (!source || source.docId !== doc.id) fail('No save point has that hash.', 404);
    const c = await writeCommit({
      doc,
      branch,
      authorId: user.id,
      message: `Restore version ${commitId.slice(0, 8)}`,
      paragraphs: source.paragraphs,
      parents: branch.headId ? [branch.headId] : [],
    });
    branch.headId = c.id;
    touch(doc, user.id);
    persist();
    return { branch: branchView(branch, doc, user), head: c };
  },
};
