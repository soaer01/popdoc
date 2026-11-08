// Socket.IO client for branch-scoped presence and paragraph locks.
// With no VITE_SOCKET_URL, a local stand-in keeps the same API so the UI works offline.
import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL;

function localSocket() {
  const handlers = new Map();
  return {
    connected: false,
    on(event, fn) {
      handlers.set(event, [...(handlers.get(event) || []), fn]);
    },
    off(event, fn) {
      handlers.set(event, (handlers.get(event) || []).filter((h) => h !== fn));
    },
    emit(event, payload, ack) {
      // Only you are ever on a private branch offline, and every lock is granted.
      if (event === 'branch:join') {
        (handlers.get('presence') || []).forEach((h) => h({ branchId: payload.branchId, users: [payload.user] }));
      }
      if (event === 'para:lock') ack?.({ ok: true, expiresInMs: 15000 });
      if (event === 'para:unlock') ack?.({ ok: true });
    },
  };
}

let socket;
export function getSocket() {
  if (!socket) socket = URL ? io(URL, { withCredentials: true, autoConnect: true }) : localSocket();
  return socket;
}

export function joinBranch(branchId, user) {
  getSocket().emit('branch:join', { branchId, user: { id: user.id, name: user.name } });
}

export function leaveBranch(branchId) {
  getSocket().emit('branch:leave', { branchId });
}

// Short paragraph locks inside a shared branch. Resolves to true when the lock is granted.
export function lockParagraph(branchId, paragraphId) {
  return new Promise((resolve) => getSocket().emit('para:lock', { branchId, paragraphId }, (res) => resolve(Boolean(res?.ok))));
}

export function unlockParagraph(branchId, paragraphId) {
  getSocket().emit('para:unlock', { branchId, paragraphId });
}
