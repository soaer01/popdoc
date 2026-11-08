// AI requests run as background jobs. When a job finishes it writes to its own AI branch and
// opens an AI-labelled pull request into the requester's draft branch. It never touches main.
import { db, persist, delay, uid, fail } from './db.js';
import { canWrite, requireDoc, requireUser, userName } from './access.js';
import { findCommit, writeCommit } from './branches.js';
import { mergeBase } from './pulls.js';
import { transform } from './llm.js';

export const AI_USER = { id: 'u_ai', name: 'AI assistant' };
const ACTIONS = ['rewrite', 'expand', 'summarize', 'translate'];
const actionNames = { rewrite: 'Rewrite', expand: 'Expand', summarize: 'Summarize', translate: 'Translate' };

const running = new Set();

async function runJob(jobId) {
  if (running.has(jobId)) return;
  running.add(jobId);
  const job = db.aiJobs.find((j) => j.id === jobId);
  job.status = 'running';
  persist();
  await new Promise((r) => setTimeout(r, 1800)); // the LLM call

  const doc = db.documents.find((d) => d.id === job.docId);
  const target = db.branches.find((b) => b.id === job.branchId);
  const head = findCommit(target.headId);
  const paragraphs = (head?.paragraphs || []).map((p) =>
    job.paragraphIds.includes(p.id)
      ? {
          ...p,
          text: transform(job.action, p.text, job),
          origin: job.action === 'translate' ? 'translated' : 'ai',
          authorId: AI_USER.id,
        }
      : p,
  );

  const n = db.branches.filter((b) => b.docId === doc.id && b.kind === 'ai').length + 1;
  const aiBranch = {
    id: uid('b'),
    docId: doc.id,
    name: `ai/${job.action}-${n}`,
    kind: 'ai',
    ownerId: job.requestedBy,
    headId: target.headId,
    invited: [],
  };
  db.branches.push(aiBranch);
  const c = await writeCommit({
    doc,
    branch: aiBranch,
    authorId: AI_USER.id,
    message: `${actionNames[job.action]} ${job.paragraphIds.length} paragraph${job.paragraphIds.length > 1 ? 's' : ''}`,
    paragraphs,
    parents: target.headId ? [target.headId] : [],
  });
  aiBranch.headId = c.id;

  const number = Math.max(0, ...db.pullRequests.filter((p) => p.docId === doc.id).map((p) => p.number)) + 1;
  const pr = {
    id: uid('pr'),
    number,
    docId: doc.id,
    kind: 'ai',
    sourceBranchId: aiBranch.id,
    targetBranchId: target.id,
    authorId: AI_USER.id,
    aiRequestedBy: job.requestedBy,
    aiAction: job.action,
    title: `AI: ${actionNames[job.action].toLowerCase()} for ${userName(job.requestedBy)}`,
    description: job.instructions || '',
    contributionType: 'wording',
    confirmedType: null,
    aiInvolved: true,
    status: 'open',
    baseId: mergeBase(c.id, target.headId),
    headId: c.id,
    approvals: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
  db.pullRequests.push(pr);
  Object.assign(job, { status: 'done', prId: pr.id, finishedAt: new Date().toISOString() });
  persist();
}

export const ai = {
  async request(docId, { branchId, action, paragraphIds, language, instructions }) {
    await delay(150);
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (!canWrite(doc, user)) fail('Only owners and members can ask the AI for proposals.', 403);
    const branch = db.branches.find((b) => b.id === branchId);
    if (!branch || branch.ownerId !== user.id || branch.kind !== 'member')
      fail('The AI can only propose changes to your own draft.', 403);
    if (!ACTIONS.includes(action)) fail('Choose rewrite, expand, summarize or translate.');
    if (!paragraphIds?.length) fail('Pick at least one paragraph.');
    const job = {
      id: uid('job'),
      docId: doc.id,
      branchId: branch.id,
      requestedBy: user.id,
      action,
      paragraphIds,
      language: language || null,
      instructions: String(instructions || '').slice(0, 500),
      status: 'queued',
      createdAt: new Date().toISOString(),
    };
    db.aiJobs.push(job);
    persist();
    setTimeout(() => runJob(job.id), 600); // a queue worker picks it up
    return job;
  },

  async jobs(docId) {
    await delay(80);
    const user = requireUser();
    requireDoc(docId, user);
    // Jobs left unfinished by a page reload are picked up again, like a restarted worker would.
    db.aiJobs
      .filter((j) => j.docId === docId && j.status !== 'done' && !running.has(j.id))
      .forEach((j) => runJob(j.id));
    return db.aiJobs
      .filter((j) => j.docId === docId && j.requestedBy === user.id)
      .slice(-8)
      .reverse();
  },
};
