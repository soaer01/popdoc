import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/index.js';

export const fetchBranches = createAsyncThunk('branches/list', async (docId) => {
  await api.branches.ensureMine(docId);
  return { docId, list: await api.branches.list(docId) };
});

export const createBranch = createAsyncThunk('branches/create', ({ docId, ...body }) => api.branches.create(docId, body));

export const openBranch = createAsyncThunk('branches/open', (branchId) => api.branches.open(branchId));

export const saveCommit = createAsyncThunk('branches/commit', ({ branchId, ...body }) =>
  api.branches.commit(branchId, body)
);

export const updateFromMain = createAsyncThunk('branches/updateFromMain', ({ branchId, ...body }) =>
  api.branches.updateFromMain(branchId, body)
);

export const restoreCommit = createAsyncThunk('branches/restore', ({ branchId, ...body }) =>
  api.history.restore(branchId, body)
);

const branchesSlice = createSlice({
  name: 'branches',
  initialState: {
    byDoc: {},
    open: null, // { branch, head, behindMain }
    syncConflicts: null, // paragraphs changed both on this branch and on main, waiting for a choice
    status: 'idle',
    saving: false,
    error: null,
  },
  reducers: {
    clearBranchError(s) {
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchBranches.fulfilled, (s, a) => {
      s.byDoc[a.payload.docId] = a.payload.list;
    })
      .addCase(createBranch.fulfilled, (s, a) => {
        (s.byDoc[a.payload.docId] ||= []).push(a.payload);
      })
      .addCase(openBranch.pending, (s) => {
        s.status = 'loading';
        s.error = null;
      })
      .addCase(openBranch.fulfilled, (s, a) => {
        s.status = 'ready';
        s.open = a.payload;
        s.syncConflicts = null;
      })
      .addCase(updateFromMain.pending, (s) => {
        s.saving = true;
        s.error = null;
      })
      .addCase(updateFromMain.fulfilled, (s, a) => {
        s.saving = false;
        const { conflicts, ...payload } = a.payload;
        s.open = payload;
        s.syncConflicts = conflicts || null;
      })
      .addCase(updateFromMain.rejected, (s, a) => {
        s.saving = false;
        s.error = a.error.message;
      })
      .addCase(openBranch.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.error.message;
      })
      .addCase(saveCommit.pending, (s) => {
        s.saving = true;
        s.error = null;
      })
      .addCase(restoreCommit.fulfilled, (s, a) => {
        s.open = a.payload;
      })
      .addCase(saveCommit.fulfilled, (s, a) => {
        s.saving = false;
        s.open = a.payload;
        const list = s.byDoc[a.payload.branch.docId];
        const i = list?.findIndex((x) => x.id === a.payload.branch.id);
        if (i >= 0) list[i] = a.payload.branch;
      })
      .addCase(saveCommit.rejected, (s, a) => {
        s.saving = false;
        s.error = a.error.message;
      });
  },
});

export const { clearBranchError } = branchesSlice.actions;
export default branchesSlice.reducer;
