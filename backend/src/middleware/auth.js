import { store } from '../utils/store.js';

export function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers['x-user-id'];
  let user = null;

  if (token) {
    user = store.findUserById(token);
  }

  // Fallback to default user (Afzal) in development so scaffolded endpoints are accessible
  if (!user) {
    user = store.state.users[0];
  }

  req.user = user;
  next();
}
