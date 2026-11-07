import { configureStore } from '@reduxjs/toolkit';
import auth from '../features/auth/authSlice.js';
import docs from '../features/docs/docsSlice.js';
import branches from '../features/branches/branchesSlice.js';
import pulls from '../features/pulls/pullsSlice.js';

export const store = configureStore({
  reducer: { auth, docs, branches, pulls },
});
