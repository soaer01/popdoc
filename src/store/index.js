import { configureStore } from '@reduxjs/toolkit';
import auth from '../features/auth/authSlice.js';

export const store = configureStore({
  reducer: { auth },
});
