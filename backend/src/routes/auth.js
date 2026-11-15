import { Router } from 'express';
import { store } from '../utils/store.js';

const router = Router();

// GET /auth/me
router.get('/me', (req, res) => {
  // Check if session cookie exists; if so return that user, else null or active user
  const token = req.cookies?.token;
  const user = token ? store.findUserById(token) : req.user;
  res.json({ user: user || null });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  let user = store.findUserByEmail(email);

  if (!user) {
    // If not found, use demo user or create a temporary one for convenient connection
    user = store.state.users[0];
  }

  res.cookie('token', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.cookie('csrf-token', 'csrf-token-valid', {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  res.json({ user });
});

// POST /auth/signup
router.post('/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  let user = store.findUserByEmail(email);

  if (!user) {
    user = {
      id: `u_${Math.random().toString(36).slice(2, 10)}`,
      name: (name || 'New User').trim(),
      email: (email || 'user@popdoc.dev').trim().toLowerCase(),
    };
    store.state.users.push(user);
  }

  res.cookie('token', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.cookie('csrf-token', 'csrf-token-valid', {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  res.status(201).json({ user });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('csrf-token');
  res.json(null);
});

export default router;
