import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/index.js';

export const fetchPulls = createAsyncThunk('pulls/list', async (docId) => ({ docId, list: await api.pulls.list(docId) }));
export const fetchPull = createAsyncThunk('pulls/get', (prId) => api.pulls.get(prId));
export const openPull = createAsyncThunk('pulls/open', ({ docId, ...body }) => api.pulls.open(docId, body));
export const commentPull = createAsyncThunk('pulls/comment', ({ prId, ...body }) => api.pulls.comment(prId, body));
export const approvePull = createAsyncThunk('pulls/approve', ({ prId, ...body }) => api.pulls.approve(prId, body));
export const mergePull = createAsyncThunk('pulls/merge', ({ prId, ...body }) => api.pulls.merge(prId, body));
export const closePull = createAsyncThunk('pulls/close', (prId) => api.pulls.close(prId));

const pullsSlice = createSlice({
  name: 'pulls',
  initialState: { byDoc: {}, detail: null, status: 'idle', busy: false, error: null },
  reducers: {
    clearPullError(s) {
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchPulls.fulfilled, (s, a) => {
      s.byDoc[a.payload.docId] = a.payload.list;
    })
      .addCase(fetchPull.pending, (s) => {
        s.status = 'loading';
      })
      .addCase(fetchPull.fulfilled, (s, a) => {
        s.status = 'ready';
        s.detail = a.payload;
      })
      .addCase(fetchPull.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.error.message;
      });

    // Actions that return an updated PR: patch it into the open detail view.
    for (const t of [commentPull, approvePull, mergePull, closePull]) {
      b.addCase(t.pending, (s) => {
        s.busy = true;
        s.error = null;
      })
        .addCase(t.fulfilled, (s, a) => {
          s.busy = false;
          if (s.detail?.pr.id === a.payload.id) s.detail.pr = a.payload;
        })
        .addCase(t.rejected, (s, a) => {
          s.busy = false;
          s.error = a.error.message;
        });
    }
  },
});

export const { clearPullError } = pullsSlice.actions;
export const contributionTypes = {
  idea: 'Idea',
  evidence: 'Evidence',
  structure: 'Structure',
  wording: 'Wording',
};
export default pullsSlice.reducer;
