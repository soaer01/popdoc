// REST implementation. Each method maps to an Express route that the backend will provide.
import { http } from './http.js';

export const rest = {
  auth: {
    me: () => http('/auth/me'),
    login: (body) => http('/auth/login', { method: 'POST', body }),
    signup: (body) => http('/auth/signup', { method: 'POST', body }),
    logout: () => http('/auth/logout', { method: 'POST' }),
  },
  docs: {
    list: () => http('/documents'),
    get: (docId) => http(`/documents/${docId}`),
    create: (body) => http('/documents', { method: 'POST', body }),
    addMember: (docId, body) => http(`/documents/${docId}/members`, { method: 'POST', body }),
    setRole: (docId, body) => http(`/documents/${docId}/members/${body.userId}`, { method: 'PATCH', body }),
  },
  branches: {
    list: (docId) => http(`/documents/${docId}/branches`),
    ensureMine: (docId) => http(`/documents/${docId}/branches/mine`, { method: 'PUT' }),
    open: (branchId) => http(`/branches/${branchId}`),
    commit: (branchId, body) => http(`/branches/${branchId}/commits`, { method: 'POST', body }),
  },
  history: {
    list: (branchId, { cursor = 0, limit = 15 } = {}) =>
      http(`/branches/${branchId}/commits?cursor=${cursor}&limit=${limit}`),
    get: (commitId) => http(`/commits/${commitId}`),
    restore: (branchId, body) => http(`/branches/${branchId}/restore`, { method: 'POST', body }),
  },
  pulls: {
    list: (docId) => http(`/documents/${docId}/pulls`),
    get: (prId) => http(`/pulls/${prId}`),
    open: (docId, body) => http(`/documents/${docId}/pulls`, { method: 'POST', body }),
    comment: (prId, body) => http(`/pulls/${prId}/comments`, { method: 'POST', body }),
    approve: (prId, body) => http(`/pulls/${prId}/approve`, { method: 'POST', body }),
    merge: (prId, body) => http(`/pulls/${prId}/merge`, { method: 'POST', body }),
    close: (prId) => http(`/pulls/${prId}/close`, { method: 'POST' }),
    branchStatus: (branchId) => http(`/branches/${branchId}/status`),
  },
};
