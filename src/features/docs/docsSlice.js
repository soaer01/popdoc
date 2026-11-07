import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/index.js';

export const fetchDocs = createAsyncThunk('docs/list', () => api.docs.list());
export const fetchDoc = createAsyncThunk('docs/get', (docId) => api.docs.get(docId));
export const createDoc = createAsyncThunk('docs/create', (body) => api.docs.create(body));
export const addMember = createAsyncThunk('docs/addMember', ({ docId, ...body }) => api.docs.addMember(docId, body));
export const setRole = createAsyncThunk('docs/setRole', ({ docId, ...body }) => api.docs.setRole(docId, body));

function upsert(state, doc) {
  state.byId[doc.id] = doc;
  if (!state.ids.includes(doc.id)) state.ids.push(doc.id);
}

const docsSlice = createSlice({
  name: 'docs',
  initialState: { byId: {}, ids: [], status: 'idle', error: null },
  reducers: {
    docUpdated(state, action) {
      upsert(state, action.payload);
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchDocs.pending, (s) => {
      s.status = 'loading';
    })
      .addCase(fetchDocs.fulfilled, (s, a) => {
        s.status = 'ready';
        s.byId = {};
        s.ids = [];
        a.payload.forEach((d) => upsert(s, d));
      })
      .addCase(fetchDocs.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.error.message;
      })
      .addCase(fetchDoc.rejected, (s, a) => {
        s.error = a.error.message;
      });
    for (const t of [fetchDoc, createDoc, addMember, setRole]) {
      b.addCase(t.fulfilled, (s, a) => upsert(s, a.payload));
    }
  },
});

export const { docUpdated } = docsSlice.actions;
export const selectDoc = (id) => (s) => s.docs.byId[id];
export default docsSlice.reducer;
