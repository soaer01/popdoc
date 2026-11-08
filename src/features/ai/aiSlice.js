import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/index.js';

export const requestAi = createAsyncThunk('ai/request', ({ docId, ...body }) => api.ai.request(docId, body));
export const fetchJobs = createAsyncThunk('ai/jobs', async (docId) => ({ docId, jobs: await api.ai.jobs(docId) }));

const aiSlice = createSlice({
  name: 'ai',
  initialState: { jobsByDoc: {}, submitting: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(requestAi.pending, (s) => {
      s.submitting = true;
      s.error = null;
    })
      .addCase(requestAi.fulfilled, (s, a) => {
        s.submitting = false;
        const list = (s.jobsByDoc[a.payload.docId] ||= []);
        list.unshift(a.payload);
      })
      .addCase(requestAi.rejected, (s, a) => {
        s.submitting = false;
        s.error = a.error.message;
      })
      .addCase(fetchJobs.fulfilled, (s, a) => {
        s.jobsByDoc[a.payload.docId] = a.payload.jobs;
      });
  },
});

export default aiSlice.reducer;
