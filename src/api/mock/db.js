// In-browser stand-in for MongoDB while the backend is being built.
// State is kept in localStorage so a refresh doesn't wipe the demo.
import { seed } from './seed.js';

const KEY = 'popdoc-mock-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable: fall back to seed */
  }
  return structuredClone(seed);
}

export const db = load();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

export function resetDb() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}
