import { Router } from 'express';
import { store } from '../utils/store.js';

const router = Router();

// POST /documents/:docId/ai/jobs
router.post('/documents/:docId/ai/jobs', (req, res) => {
  const { docId } = req.params;
  const { branchId, action, paragraphIds, language, instructions } = req.body || {};
  const user = req.user;

  const jobId = `job_${Math.random().toString(36).slice(2, 10)}`;
  const job = {
    id: jobId,
    _id: jobId,
    docId,
    branchId,
    requestedBy: user.id,
    action: action || 'rewrite',
    paragraphIds: paragraphIds || [],
    language: language || null,
    instructions: String(instructions || '').slice(0, 500),
    status: 'queued',
    createdAt: new Date().toISOString(),
  };

  store.state.aiJobs = store.state.aiJobs || [];
  store.state.aiJobs.push(job);

  res.status(202).json(job);
});

// GET /documents/:docId/ai/jobs
router.get('/documents/:docId/ai/jobs', (req, res) => {
  const { docId } = req.params;
  const user = req.user;

  const jobs = (store.state.aiJobs || [])
    .filter((j) => j.docId === docId && j.requestedBy === user.id)
    .slice(-8)
    .reverse();

  res.json(jobs);
});

export default router;
