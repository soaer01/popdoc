import mongoose from 'mongoose';
import { Document, Branch, PullRequest, Commit, User, AiJob } from '../models/index.js';
import {
  initialUsers,
  initialDocs,
  initialBranches,
  initialCommits,
  initialPulls,
} from './seedData.js';

// In-memory runtime state that syncs with Mongoose when DB is available
let state = {
  users: [...initialUsers],
  documents: [...initialDocs],
  branches: [...initialBranches],
  commits: [...initialCommits],
  pullRequests: [...initialPulls],
  aiJobs: [],
};

// Seed Mongoose collections on connect if empty
export async function seedDatabaseIfEmpty() {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const docCount = await Document.countDocuments();
    if (docCount === 0) {
      console.log('[Database] Seeding initial database records...');
      await User.insertMany(initialUsers);
      await Document.insertMany(initialDocs);
      await Branch.insertMany(initialBranches);
      await Commit.insertMany(initialCommits);
      await PullRequest.insertMany(initialPulls);
      console.log('[Database] Seeding completed.');
    }
  } catch (err) {
    console.warn('[Database] Seeding check error:', err.message);
  }
}

export function findUserById(id) {
  return state.users.find((u) => u.id === id || u._id === id) || null;
}

export function findUserByEmail(email) {
  if (!email) return null;
  return state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

export function userName(id) {
  if (id === 'u_ai') return 'AI assistant';
  const u = findUserById(id);
  return u?.name || 'Unknown';
}

export function roleIn(doc, userId) {
  return doc.members?.find((m) => m.userId === userId)?.role || null;
}

export function docView(doc, user) {
  return {
    ...doc,
    id: doc.id || doc._id,
    myRole: roleIn(doc, user.id) || 'owner',
    members: (doc.members || []).map((m) => {
      const u = findUserById(m.userId);
      return { ...m, name: u?.name || 'Unknown', email: u?.email || '' };
    }),
  };
}

export function branchView(branch, doc, user) {
  const isMine = branch.ownerId === user.id;
  const userRole = doc ? roleIn(doc, user.id) : 'owner';
  const canWrite = ['owner', 'member'].includes(userRole);
  return {
    ...branch,
    id: branch.id || branch._id,
    ownerName: branch.ownerId ? userName(branch.ownerId) : null,
    isMine,
    canEdit:
      branch.kind === 'member' &&
      canWrite &&
      (branch.ownerId === user.id || (branch.invited || []).includes(user.id)),
  };
}

export function findMainBranch(docId) {
  return state.branches.find((b) => b.docId === docId && b.kind === 'main') || null;
}

export function findCommit(id) {
  return state.commits.find((c) => c.id === id || c._id === id) || null;
}

export function branchPayload(branch, doc, user) {
  const main = doc ? findMainBranch(doc.id || doc._id) : null;
  const head = findCommit(branch.headId);
  return {
    branch: branchView(branch, doc, user),
    head: head || null,
    behindMain:
      branch.kind === 'member' &&
      Boolean(main?.headId) &&
      branch.headId !== main?.headId,
  };
}

export function prView(pr, user) {
  const source = state.branches.find((b) => b.id === pr.sourceBranchId);
  const target = state.branches.find((b) => b.id === pr.targetBranchId);
  return {
    ...pr,
    id: pr.id || pr._id,
    authorName: pr.aiRequestedBy
      ? `AI assistant for ${userName(pr.aiRequestedBy)}`
      : userName(pr.authorId),
    sourceName: source?.name,
    targetName: target?.name,
    approvalNames: (pr.approvals || []).map(userName),
    comments: (pr.comments || []).map((c) => ({
      ...c,
      authorName: userName(c.authorId),
    })),
    isAuthor: pr.authorId === user.id,
    isRequester: pr.aiRequestedBy === user.id,
  };
}

export const store = {
  state,
  findUserById,
  findUserByEmail,
  userName,
  roleIn,
  docView,
  branchView,
  branchPayload,
  prView,
  findCommit,
  findMainBranch,
};
