import http from 'http';
import { app } from './src/app.js';
import { store } from './src/utils/store.js';
import { verifyCommits } from '../src/lib/verify.js';
import { paragraphDiff, diffStats } from '../src/lib/diff.js';

const server = http.createServer(app);

server.listen(4004, async () => {
  console.log('Testing Phase 3 merge and conflict resolution on port 4004...');

  async function request(path, options = {}) {
    const res = await fetch(`http://localhost:4004${path}`, {
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
    // 1. Verify PR #3 (Tighter opening sentence) vs Main
    const pr3Res = await request('/api/pulls/pr_3');
    assert(pr3Res.status === 200, 'GET /pulls/pr_3 returns PR #3');
    assert(Boolean(pr3Res.data.plan), 'PR #3 includes merge plan');

    // 2. Test paragraph diff calculation compatible with DiffView.jsx
    const diffRows = paragraphDiff(pr3Res.data.base, pr3Res.data.head, 'words');
    assert(Array.isArray(diffRows) && diffRows.length > 0, 'paragraphDiff returns rows for DiffView');
    const changedRow = diffRows.find((r) => r.status === 'changed');
    assert(Boolean(changedRow && changedRow.parts), 'Changed row has parts array for DiffView word diff');
    const stats = diffStats(diffRows);
    assert(typeof stats.added === 'number' && typeof stats.removed === 'number', 'diffStats returns word counts');

    // 3. Merge PR #3 into main (already approved by Dr. Hina Qureshi in seed)
    const mergePr3Res = await request('/api/pulls/pr_3/merge', { method: 'POST' });
    assert(mergePr3Res.status === 200, 'POST /pulls/pr_3/merge fast-forwards main');
    assert(mergePr3Res.data.status === 'merged', 'PR #3 status is merged');

    // Main has moved forward to PR #3's head!
    const docRes = await request('/api/documents/d_1');
    const mainBranch = store.findMainBranch('d_1');

    // 4. Now test PR #2 (Afzal's branch) which now CONFLICTS with Main on paragraph p_1
    const pr2Res = await request('/api/pulls/pr_2');
    assert(pr2Res.status === 200, 'GET /pulls/pr_2 returns PR #2');
    assert(pr2Res.data.plan.mode === 'conflicts', 'PR #2 merge plan mode is "conflicts"');
    assert(
      pr2Res.data.plan.conflicts.length > 0 && pr2Res.data.plan.conflicts[0].id === 'p_1',
      'PR #2 plan detects conflict on paragraph p_1'
    );
    assert(
      Boolean(pr2Res.data.plan.conflicts[0].current && pr2Res.data.plan.conflicts[0].incoming),
      'Conflict contains both current (main) and incoming versions for Conflicts.jsx'
    );

    // 5. Attempting merge on conflicting PR without resolutions returns 409 Conflict
    const unresolvMerge = await request('/api/pulls/pr_2/merge', { method: 'POST' });
    assert(unresolvMerge.status === 409, 'Attempting merge on conflicting PR without resolutions returns 409');

    // 6. Merge PR #2 with resolutions (as Conflicts.jsx formats them)
    const conflict = pr2Res.data.plan.conflicts[0];
    const resolutions = {
      [conflict.id]: {
        ...conflict.current,
        text: 'Most students now write with AI. This merged opening combines both contributions.',
        origin: 'typed',
      },
    };

    const resolveMerge = await request('/api/pulls/pr_2/merge', {
      method: 'POST',
      body: { resolutions },
    });
    assert(resolveMerge.status === 200, 'POST /pulls/pr_2/merge with resolutions returns 200');
    assert(resolveMerge.data.status === 'merged', 'PR #2 status is merged');
    assert(resolveMerge.data.mergeMode === 'three-way', 'PR #2 mergeMode is three-way');

    // Verify the merge commit hash
    const mergeCommitId = resolveMerge.data.mergeCommitId;
    const mergeCommit = store.findCommit(mergeCommitId);
    assert(Boolean(mergeCommit), 'Three-way merge commit exists in store');
    assert(mergeCommit.parents.length === 2, 'Merge commit has 2 parents');
    const verifyMergeCommit = await verifyCommits([mergeCommit]);
    assert(verifyMergeCommit[mergeCommit.id] === true, 'Three-way merge commit hash is cryptographically valid');

    // 7. Test "Update from main" workflow with conflicts on a branch
    // Find the initial commit (c1) where the branch diverged
    const initialCommit = store.state.commits.find((c) => c.parents.length === 0);
    const newBranchRes = await request('/api/documents/d_1/branches', {
      method: 'POST',
      body: { name: 'sync-test-branch', fromCommitId: initialCommit.id },
    });
    assert(newBranchRes.status === 201, 'Created new branch from initial commit for update-from-main test');
    const testBranchId = newBranchRes.data.id;

    // Commit a divergent change on this test branch to p_1
    const branchCommitRes = await request(`/api/branches/${testBranchId}/commits`, {
      method: 'POST',
      body: {
        message: 'Divergent edit on test branch',
        paragraphs: [
          {
            id: 'p_1',
            text: 'Divergent local paragraph text that will conflict with main.',
            origin: 'typed',
            authorId: 'u_afzal',
          },
        ],
        expectedHeadId: newBranchRes.data.headId,
      },
    });
    assert(branchCommitRes.status === 201, 'Committed divergent edit to test branch');

    // Call update-from-main without resolutions -> should detect conflict
    const updateConflictRes = await request(`/api/branches/${testBranchId}/update-from-main`, {
      method: 'POST',
      body: { expectedHeadId: branchCommitRes.data.head.id },
    });
    assert(Boolean(updateConflictRes.data.conflicts?.length), 'update-from-main returns conflicts to SyncConflicts.jsx');

    // Now resolve using SyncConflicts choice ('mine' or 'main')
    const updateResolvedRes = await request(`/api/branches/${testBranchId}/update-from-main`, {
      method: 'POST',
      body: {
        expectedHeadId: branchCommitRes.data.head.id,
        resolutions: { p_1: 'mine' },
      },
    });
    assert(!updateResolvedRes.data.conflicts, 'update-from-main successfully resolved and merged conflicts');
    assert(updateResolvedRes.data.behindMain === false, 'Branch is no longer behind main after sync');

    // Verify commit hash of update-from-main commit
    const syncCommit = updateResolvedRes.data.head;
    assert(syncCommit.parents.length === 2, 'Sync commit has both parents [branch, main]');
    const verifySync = await verifyCommits([syncCommit]);
    assert(verifySync[syncCommit.id] === true, 'Sync commit hash is cryptographically valid');
  } catch (err) {
    console.error('Test error:', err);
    failed++;
  }

  console.log(`\nPhase 3 Tests Result: ${passed} passed, ${failed} failed.`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
});
