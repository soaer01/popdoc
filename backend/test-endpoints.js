import http from 'http';
import { app } from './src/app.js';

const server = http.createServer(app);

server.listen(4001, async () => {
  console.log('Test server running on port 4001');

  async function request(path, options = {}) {
    const res = await fetch(`http://localhost:4001${path}`, {
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

  const tests = [
    { name: 'GET /api/auth/me', call: () => request('/api/auth/me') },
    { name: 'POST /api/auth/login', call: () => request('/api/auth/login', { method: 'POST', body: { email: 'afzal@popdoc.dev', password: 'password123' } }) },
    { name: 'POST /api/auth/signup', call: () => request('/api/auth/signup', { method: 'POST', body: { name: 'Test', email: 'test@popdoc.dev', password: 'password123' } }) },
    { name: 'POST /api/auth/logout', call: () => request('/api/auth/logout', { method: 'POST' }) },
    { name: 'GET /api/documents', call: () => request('/api/documents') },
    { name: 'POST /api/documents', call: () => request('/api/documents', { method: 'POST', body: { title: 'Test Doc' } }) },
    { name: 'GET /api/documents/d_1', call: () => request('/api/documents/d_1') },
    { name: 'PATCH /api/documents/d_1', call: () => request('/api/documents/d_1', { method: 'PATCH', body: { title: 'Updated Title' } }) },
    { name: 'POST /api/documents/d_1/members', call: () => request('/api/documents/d_1/members', { method: 'POST', body: { email: 'hina@popdoc.dev', role: 'reviewer' } }) },
    { name: 'PATCH /api/documents/d_1/members/u_reviewer', call: () => request('/api/documents/d_1/members/u_reviewer', { method: 'PATCH', body: { role: 'reviewer' } }) },
    { name: 'GET /api/documents/d_1/branches', call: () => request('/api/documents/d_1/branches') },
    { name: 'POST /api/documents/d_1/branches', call: () => request('/api/documents/d_1/branches', { method: 'POST', body: { name: 'feature-test' } }) },
    { name: 'PUT /api/documents/d_1/branches/mine', call: () => request('/api/documents/d_1/branches/mine', { method: 'PUT' }) },
    { name: 'GET /api/branches/b_main', call: () => request('/api/branches/b_main') },
    { name: 'POST /api/branches/b_main/commits', call: () => request('/api/branches/b_main/commits', { method: 'POST', body: { message: 'Test commit', paragraphs: [] } }) },
    { name: 'POST /api/branches/b_main/update-from-main', call: () => request('/api/branches/b_main/update-from-main', { method: 'POST', body: {} }) },
    { name: 'GET /api/branches/b_main/commits', call: () => request('/api/branches/b_main/commits') },
    { name: 'GET /api/commits/:commitId', call: async () => {
      const list = await request('/api/branches/b_main/commits');
      const cid = list.data?.items?.[0]?.id || 'c_1';
      return request(`/api/commits/${cid}`);
    } },
    { name: 'POST /api/branches/b_main/restore', call: async () => {
      const list = await request('/api/branches/b_main/commits');
      const cid = list.data?.items?.[0]?.id || 'c_1';
      return request('/api/branches/b_main/restore', { method: 'POST', body: { commitId: cid } });
    } },
    { name: 'GET /api/branches/b_main/status', call: () => request('/api/branches/b_main/status') },
    { name: 'GET /api/documents/d_1/pulls', call: () => request('/api/documents/d_1/pulls') },
    { name: 'POST /api/documents/d_1/pulls', call: () => request('/api/documents/d_1/pulls', { method: 'POST', body: { sourceBranchId: 'b_afzal', title: 'New PR', contributionType: 'idea' } }) },
    { name: 'GET /api/pulls/pr_1', call: () => request('/api/pulls/pr_1') },
    { name: 'POST /api/pulls/pr_1/comments', call: () => request('/api/pulls/pr_1/comments', { method: 'POST', body: { body: 'Nice work' } }) },
    { name: 'POST /api/pulls/pr_1/approve', call: () => request('/api/pulls/pr_1/approve', { method: 'POST', body: { confirmedType: 'evidence' } }) },
    { name: 'POST /api/pulls/pr_1/merge', call: () => request('/api/pulls/pr_1/merge', { method: 'POST', body: {} }) },
    { name: 'POST /api/pulls/pr_1/close', call: () => request('/api/pulls/pr_1/close', { method: 'POST' }) },
    { name: 'POST /api/documents/d_1/ai/jobs', call: () => request('/api/documents/d_1/ai/jobs', { method: 'POST', body: { branchId: 'b_afzal', action: 'rewrite', paragraphIds: ['p_1'] } }) },
    { name: 'GET /api/documents/d_1/ai/jobs', call: () => request('/api/documents/d_1/ai/jobs') },
    { name: 'GET /api/documents/d_1/ledger', call: () => request('/api/documents/d_1/ledger') },
    { name: 'PUT /api/documents/d_1/ledger/sharing', call: () => request('/api/documents/d_1/ledger/sharing', { method: 'PUT', body: { shared: true } }) },
    { name: 'PUT /api/documents/d_1/round', call: () => request('/api/documents/d_1/round', { method: 'PUT', body: { round: 'idea' } }) },
    { name: 'GET /api/documents/d_1/record', call: () => request('/api/documents/d_1/record') },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      const res = await t.call();
      if (res.status >= 200 && res.status < 300) {
        console.log(`✓ ${t.name} -> status ${res.status}`);
        passed++;
      } else {
        console.error(`✗ ${t.name} -> status ${res.status}`, res.data);
        failed++;
      }
    } catch (err) {
      console.error(`✗ ${t.name} -> exception ${err.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
});
