import { Router } from 'express';
import { store } from '../utils/store.js';

const router = Router();

// GET /documents
router.get('/', (req, res) => {
  const user = req.user;
  const docs = store.state.documents.map((d) => store.docView(d, user));
  res.json(docs);
});

// POST /documents
router.post('/', (req, res) => {
  const user = req.user;
  const { title } = req.body || {};
  const docId = `d_${Math.random().toString(36).slice(2, 10)}`;
  const mainBranchId = `b_${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();

  const newDoc = {
    id: docId,
    _id: docId,
    title: (title || 'Untitled Document').trim(),
    ownerId: user.id,
    members: [{ userId: user.id, role: 'owner', lastActiveAt: now }],
    round: 'open',
    ledgerShared: false,
    mainBranchId,
    titleHistory: [],
    createdAt: now,
  };

  const mainBranch = {
    id: mainBranchId,
    _id: mainBranchId,
    docId,
    name: 'main',
    kind: 'main',
    ownerId: null,
    headId: null,
    invited: [],
  };

  store.state.documents.push(newDoc);
  store.state.branches.push(mainBranch);

  res.status(201).json(store.docView(newDoc, user));
});

// GET /documents/:docId
router.get('/:docId', (req, res) => {
  const { docId } = req.params;
  const user = req.user;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  if (!doc) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  res.json(store.docView(doc, user));
});

// PATCH /documents/:docId
router.patch('/:docId', (req, res) => {
  const { docId } = req.params;
  const { title } = req.body || {};
  const user = req.user;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  if (!doc) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  if (title && title.trim()) {
    const nextTitle = title.trim().slice(0, 140);
    doc.titleHistory = [
      ...(doc.titleHistory || []),
      { title: doc.title, by: user.id, at: new Date().toISOString() },
    ];
    doc.title = nextTitle;
  }

  res.json(store.docView(doc, user));
});

// POST /documents/:docId/members
router.post('/:docId/members', (req, res) => {
  const { docId } = req.params;
  const { email, role } = req.body || {};
  const user = req.user;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  if (!doc) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  let invitee = store.findUserByEmail(email);
  if (!invitee) {
    invitee = {
      id: `u_${Math.random().toString(36).slice(2, 10)}`,
      name: email ? email.split('@')[0] : 'Invited Member',
      email: (email || 'member@popdoc.dev').trim().toLowerCase(),
    };
    store.state.users.push(invitee);
  }

  const existing = doc.members?.find((m) => m.userId === invitee.id);
  if (!existing) {
    doc.members = doc.members || [];
    doc.members.push({
      userId: invitee.id,
      role: role || 'member',
      lastActiveAt: null,
    });
  }

  res.json(store.docView(doc, user));
});

// PATCH /documents/:docId/members/:userId
router.patch('/:docId/members/:userId', (req, res) => {
  const { docId, userId } = req.params;
  const { role } = req.body || {};
  const user = req.user;
  const doc = store.state.documents.find((d) => d.id === docId || d._id === docId);

  if (!doc) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  const member = doc.members?.find((m) => m.userId === userId);
  if (member && role) {
    member.role = role;
  }

  res.json(store.docView(doc, user));
});

export default router;
