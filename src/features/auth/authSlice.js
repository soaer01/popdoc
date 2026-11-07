import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/index.js';

export const fetchMe = createAsyncThunk('auth/me', async () => (await api.auth.me()).user);

export const login = createAsyncThunk('auth/login', async (body) => (await api.auth.login(body)).user);

export const signup = createAsyncThunk('auth/signup', async (body) => (await api.auth.signup(body)).user);

export const logout = createAsyncThunk('auth/logout', async () => {
  await api.auth.logout();
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'idle', error: null },
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMe.pending, (s) => {
      s.status = 'checking';
    })
      .addCase(fetchMe.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'ready';
      })
      .addCase(fetchMe.rejected, (s) => {
        s.user = null;
        s.status = 'ready';
      })
      .addCase(logout.fulfilled, (s) => {
        s.user = null;
      });

    for (const thunk of [login, signup]) {
      b.addCase(thunk.pending, (s) => {
        s.status = 'submitting';
        s.error = null;
      })
        .addCase(thunk.fulfilled, (s, a) => {
          s.user = a.payload;
          s.status = 'ready';
        })
        .addCase(thunk.rejected, (s, a) => {
          s.status = 'ready';
          s.error = a.error.message;
        });
    }
  },
});

export const { clearAuthError } = authSlice.actions;
export const selectUser = (state) => state.auth.user;
export default authSlice.reducer;
