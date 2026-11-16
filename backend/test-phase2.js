import http from 'http';
import { app } from './src/app.js';
import { store } from './src/utils/store.js';
import { verifyCommits } from '../src/lib/verify.js';
import { fromDoc } from '../src/features/editor/paragraphs.js';

const server = http.createServer(app);

server.listen(4003, async () => {
  console.log('Testing Phase 2 integration on port 4003...');

  async function request(path, options = {}) {
    const res = await fetch(`http://localhost:4003${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Test fromDoc author attribution and incremental paragraph formatting
    const baseParagraphs = [
      { id: 'p_1', text: 'Original paragraph by Afzal', origin: 'typed', authorId: 'u_afzal' },
    ];
    const tiptapJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { pid: 'p_1', origin: 'typed', authorId: 'u_afzal' },
          content: [{ type: 'text', text: 'Edited paragraph by Safee' }],
        },
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: 'Brand new paragraph by Safee' }],
        },
      ],
    };

    const formattedParas = fromDoc(tiptapJson, { base: baseParagraphs, userId: 'u_safee' });
    assert(formattedParas.length === 2, 'fromDoc formats 2 paragraphs');
    assert(
      formattedParas[0].id === 'p_1' && formattedParas[0].authorId === 'u_safee',
      'Edited paragraph re-attributes authorId to u_safee'
    );
    assert(
      formattedParas[1].id.startsWith('p_') && formattedParas[1].authorId === 'u_safee',
      'New paragraph gets generated pid and authorId u_safee'
    );

    // 2. Test incremental commit via backend route with SHA-256 hash verification
    const branchRes = await request('/api/branches/b_safee');
    assert(branchRes.status === 200, 'GET /branches/b_safee returns branch payload');
    const expectedHeadId = branchRes.data.head?.id;

    const commitRes = await request('/api/branches/b_safee/commits', {
      method: 'POST',
      body: {
        message: 'Incremental test commit',
        paragraphs: formattedParas,
        expectedHeadId,
      },
    });

    assert(commitRes.status === 201, 'POST /branches/b_safee/commits returns 201 Created');
    const newHead = commitRes.data.head;
    assert(newHead && newHead.id.length === 64, 'New commit head has 64-char SHA-256 id');
    assert(newHead.parents[0] === expectedHeadId, 'New commit has previous head as parent');

    // Cryptographic hash verification using frontend verifyCommits
    const verifications = await verifyCommits([newHead]);
    assert(verifications[newHead.id] === true, 'Cryptographic hash of incremental commit is verified');

    // Stale head conflict check
    const staleCommitRes = await request('/api/branches/b_safee/commits', {
      method: 'POST',
      body: {
        message: 'Stale commit attempt',
        paragraphs: formattedParas,
        expectedHeadId: 'old_stale_hash',
      },
    });
    assert(staleCommitRes.status === 409, 'Submitting commit with stale expectedHeadId returns 409 Conflict');

    // 3. Test AI Panel job triggering and lifecycle
    const aiJobRes = await request('/api/documents/d_1/ai/jobs', {
      method: 'POST',
      body: {
        branchId: 'b_safee',
        action: 'rewrite',
        paragraphIds: ['p_1'],
      },
    });

    assert(aiJobRes.status === 202, 'POST /documents/d_1/ai/jobs returns 202 Accepted');
    assert(aiJobRes.data.status === 'queued', 'AI job starts in queued status');
    const jobId = aiJobRes.data.id;

    // Wait for the background worker to finish the job
    console.log('Waiting for AI background job to complete...');
    let doneJob = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const jobsList = await request('/api/documents/d_1/ai/jobs');
      const found = jobsList.data.find((j) => j.id === jobId);
      if (found && found.status === 'done') {
        doneJob = found;
        break;
      }
    }

    assert(doneJob !== null, 'AI job transitioned to done status');
    assert(Boolean(doneJob?.prId), 'AI job created pull request id');

    // Verify AI pull request
    const prRes = await request(`/api/pulls/${doneJob.prId}`);
    assert(prRes.status === 200, 'GET /pulls/:prId retrieves AI proposal PR');
    assert(prRes.data.pr.kind === 'ai', 'PR kind is ai');
    assert(prRes.data.pr.authorId === 'u_ai', 'PR author is u_ai');

    // Verify AI commit hash
    const aiCommit = store.findCommit(prRes.data.pr.headId);
    const aiCommitVerify = await verifyCommits([aiCommit]);
    assert(aiCommitVerify[aiCommit.id] === true, 'AI commit hash is cryptographically valid');

    // 4. Test merging AI proposal
    const mergeAiRes = await request(`/api/pulls/${doneJob.prId}/merge`, {
      method: 'POST',
      body: {
        selections: { p_1: 'accept' },
      },
    });
    assert(mergeAiRes.status === 200, 'POST /pulls/:prId/merge merges AI proposal');
    assert(mergeAiRes.data.status === 'merged', 'AI PR marked merged');
  } catch (err) {
    console.error('Test threw exception:', err);
    failed++;
  }

  console.log(`\nPhase 2 Tests Result: ${passed} passed, ${failed} failed.`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
});
