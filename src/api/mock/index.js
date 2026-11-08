// Mock implementation with the same shape as ./rest.js.
import { db, persist, delay, uid, fail } from './db.js';
import { currentUser, docView, requireDoc, requireUser, roleIn } from './access.js';
import { branches } from './branches.js';
import { history } from './history.js';
import { pulls } from './pulls.js';
import { ai } from './ai.js';
import { ledger } from './ledger.js';

const auth = {
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
};

const docs = {
  async list() {
    await delay();
    const user = requireUser();
    return db.documents.filter((d) => roleIn(d, user.id)).map((d) => docView(d, user));
  },
  async get(docId) {
    await delay(150);
    const user = requireUser();
    return docView(requireDoc(docId, user), user);
  },
  async create({ title }) {
    await delay();
    const user = requireUser();
    if (!title?.trim()) fail('Give the document a title.');
    const now = new Date().toISOString();
    const doc = {
      id: uid('d'),
      title: title.trim(),
      ownerId: user.id,
      members: [{ userId: user.id, role: 'owner', lastActiveAt: now }],
      round: 'open',
      ledgerShared: false,
      mainBranchId: uid('b'),
      createdAt: now,
    };
    db.documents.push(doc);
    db.branches.push({ id: doc.mainBranchId, docId: doc.id, name: 'main', kind: 'main', ownerId: null, headId: null, invited: [] });
    persist();
    return docView(doc, user);
  },
  // Owners and members can rename; reviewers and viewers can't.
  async rename(docId, { title }) {
    await delay(150);
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (!['owner', 'member'].includes(roleIn(doc, user.id))) fail('Only owners and members can rename the document.', 403);
    const next = String(title || '').trim().slice(0, 140);
    if (!next) fail('The title can’t be empty.');
    if (next !== doc.title) {
      doc.titleHistory = [...(doc.titleHistory || []), { title: doc.title, by: user.id, at: new Date().toISOString() }];
      doc.title = next;
      persist();
    }
    return docView(doc, user);
  },
  async addMember(docId, { email, role }) {
    await delay();
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (roleIn(doc, user.id) !== 'owner') fail('Only the owner can add people.', 403);
    const invitee = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!invitee) fail('No PopDoc account uses that email. Ask them to sign up first.', 404);
    if (roleIn(doc, invitee.id)) fail(`${invitee.name} is already in this document.`, 409);
    doc.members.push({ userId: invitee.id, role, lastActiveAt: null });
    persist();
    return docView(doc, user);
  },
  async setRole(docId, { userId, role }) {
    await delay();
    const user = requireUser();
    const doc = requireDoc(docId, user);
    if (roleIn(doc, user.id) !== 'owner') fail('Only the owner can change roles.', 403);
    if (userId === doc.ownerId) fail('The owner’s role can’t be changed.');
    doc.members.find((m) => m.userId === userId).role = role;
    persist();
    return docView(doc, user);
  },
};

export const mock = { auth, docs, branches, history, pulls, ai, ledger };
