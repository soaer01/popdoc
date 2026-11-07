// Mock implementation with the same shape as ./rest.js.
import { db, persist, delay, uid, fail } from './db.js';

function currentUser() {
  return db.users.find((u) => u.id === db.session) || null;
}

export function requireUser() {
  const user = currentUser();
  if (!user) fail('Log in to continue.', 401);
  return user;
}

export const mock = {
  auth: {
    async me() {
      await delay(100);
      return { user: currentUser() };
    },
    async login({ email, password }) {
      await delay();
      const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || password.length < 8) fail('That email and password don’t match an account.', 401);
      db.session = user.id;
      persist();
      return { user };
    },
    async signup({ name, email, password }) {
      await delay();
      if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
        fail('An account with this email already exists. Log in instead.', 409);
      }
      if (password.length < 8) fail('Use at least 8 characters for your password.');
      const user = { id: uid('u'), name: name.trim(), email: email.trim() };
      db.users.push(user);
      db.session = user.id;
      persist();
      return { user };
    },
    async logout() {
      await delay(100);
      db.session = null;
      persist();
      return null;
    },
  },
};
