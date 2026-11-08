// Access helpers shared by the mock route handlers (the backend will do this in middleware).
import { db, fail } from './db.js';

export function currentUser() {
  return db.users.find((u) => u.id === db.session) || null;
}

export function requireUser() {
  const user = currentUser();
  if (!user) fail('Log in to continue.', 401);
  return user;
}

export function roleIn(doc, userId) {
  return doc.members.find((m) => m.userId === userId)?.role || null;
}

export function requireDoc(docId, user) {
  const doc = db.documents.find((d) => d.id === docId);
  if (!doc || !roleIn(doc, user.id)) fail('This document doesn’t exist or you aren’t a member.', 404);
  return doc;
}

export const canWrite = (doc, user) => ['owner', 'member'].includes(roleIn(doc, user.id));

export function touch(doc, userId) {
  const m = doc.members.find((x) => x.userId === userId);
  if (m) m.lastActiveAt = new Date().toISOString();
}

export const userName = (id) =>
  id === 'u_ai' ? 'AI assistant' : db.users.find((u) => u.id === id)?.name || 'Unknown';

// What the client sees: members joined with names, plus the caller's role.
export function docView(doc, user) {
  return {
    ...doc,
    myRole: roleIn(doc, user.id),
    members: doc.members.map((m) => {
      const u = db.users.find((x) => x.id === m.userId);
      return { ...m, name: u?.name, email: u?.email };
    }),
  };
}
