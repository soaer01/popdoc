import { Router } from 'express';
import { store } from '../utils/store.js';
import { hashCommit } from '../utils/hash.js';
import { transform } from '../utils/llm.js';

const router = Router();

const ACTIONS = ['rewrite', 'expand', 'summarize', 'translate'];
const actionNames = {
  rewrite: 'Rewrite',
  expand: 'Expand',
  summarize: 'Summarize',
  translate: 'Translate',
};
const AI_USER_ID = 'u_ai';

const runningJobs = new Set();

async function runAiJob(jobId) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);

  const job = store.state.aiJobs.find((j) => j.id === jobId);
  if (!job) {
    runningJobs.delete(jobId);
    return;
  }

  job.status = 'running';

  // Brief delay to simulate AI processing asynchronously
  await new Promise((r) => setTimeout(r, 800));

  const doc = store.state.documents.find((d) => d.id === job.docId || d._id === job.docId);
  const targetBranch = store.state.branches.find((b) => b.id === job.branchId || b._id === job.branchId);

  if (!doc || !targetBranch) {
    job.status = 'failed';
    runningJobs.delete(jobId);
    return;
  }

  const headCommit = store.findCommit(targetBranch.headId);
  const transformedParagraphs = await Promise.all(
    (headCommit?.paragraphs || []).map(async (p) => {
      if (job.paragraphIds.includes(p.id)) {
        const text = await transform(job.action, p.text, job);
        return {
          ...p,
          text,
          origin: job.action === 'translate' ? 'translated' : 'ai',
          authorId: AI_USER_ID,
        };
      }
      return p;
    })
  );

  const aiBranchCount = store.state.branches.filter(
    (b) => b.docId === job.docId && b.kind === 'ai'
  ).length + 1;

  const aiBranchId = `b_${Math.random().toString(36).slice(2, 10)}`;
  const aiBranch = {
    id: aiBranchId,
    _id: aiBranchId,
    docId: job.docId,
    name: `ai/${job.action}-${aiBranchCount}`,
    kind: 'ai',
    ownerId: job.requestedBy,
    headId: targetBranch.headId,
    invited: [],
  };
  store.state.branches.push(aiBranch);

  const commitData = {
    docId: job.docId,
    branchId: aiBranch.id,
    parents: targetBranch.headId ? [targetBranch.headId] : [],
    authorId: AI_USER_ID,
    message: `${actionNames[job.action]} ${job.paragraphIds.length} paragraph${job.paragraphIds.length > 1 ? 's' : ''}`,
    paragraphs: transformedParagraphs,
    createdAt: new Date().toISOString(),
  };

  const hash = hashCommit(commitData);
  commitData.id = hash;
  commitData._id = hash;
  store.state.commits.push(commitData);
  aiBranch.headId = hash;

  const existingPrs = store.state.pullRequests.filter((p) => p.docId === job.docId);
  const nextNumber = Math.max(0, ...existingPrs.map((p) => p.number || 0)) + 1;
  const prId = `pr_${Math.random().toString(36).slice(2, 10)}`;

  const pr = {
    id: prId,
    _id: prId,
    number: nextNumber,
    docId: job.docId,
    kind: 'ai',
    sourceBranchId: aiBranch.id,
    targetBranchId: targetBranch.id,
    authorId: AI_USER_ID,
    aiRequestedBy: job.requestedBy,
    aiAction: job.action,
    title: `AI: ${actionNames[job.action].toLowerCase()} for ${store.userName(job.requestedBy)}`,
    description: job.instructions || '',
    contributionType: 'wording',
    confirmedType: null,
    aiInvolved: true,
    status: 'open',
    baseId: targetBranch.headId,
    headId: commitData.id,
    approvals: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };

  store.state.pullRequests.push(pr);

  job.status = 'done';
  job.prId = pr.id;
  job.finishedAt = new Date().toISOString();

  runningJobs.delete(jobId);
}

// POST /documents/:docId/ai/jobs
router.post('/documents/:docId/ai/jobs', (req, res) => {
  const { docId } = req.params;
  const { branchId, action, paragraphIds, language, instructions } = req.body || {};
  const user = req.user;

  if (!ACTIONS.includes(action)) {
    return res.status(400).json({ message: 'Choose rewrite, expand, summarize or translate.' });
  }

  if (!paragraphIds?.length) {
    return res.status(400).json({ message: 'Pick at least one paragraph.' });
  }

  const jobId = `job_${Math.random().toString(36).slice(2, 10)}`;
  const job = {
    id: jobId,
    _id: jobId,
    docId,
    branchId,
    requestedBy: user.id,
    action,
    paragraphIds,
    language: language || null,
    instructions: String(instructions || '').slice(0, 500),
    status: 'queued',
    createdAt: new Date().toISOString(),
  };

  store.state.aiJobs = store.state.aiJobs || [];
  store.state.aiJobs.push(job);

  // Trigger background job execution
  setTimeout(() => runAiJob(job.id), 200);

  res.status(202).json(job);
});

// GET /documents/:docId/ai/jobs
router.get('/documents/:docId/ai/jobs', (req, res) => {
  const { docId } = req.params;
  const user = req.user;

  // Pick up any queued jobs that haven't started
  (store.state.aiJobs || [])
    .filter((j) => j.docId === docId && j.status === 'queued' && !runningJobs.has(j.id))
    .forEach((j) => runAiJob(j.id));

  const jobs = (store.state.aiJobs || [])
    .filter((j) => j.docId === docId && j.requestedBy === user.id)
    .slice(-8)
    .reverse();

  res.json(jobs);
});

export default router;
