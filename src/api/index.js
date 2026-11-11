// Pick the transport once. With no VITE_API_URL set, the app runs entirely on the mock.
import { rest } from './rest.js';
import { mock } from './mock/index.js';

export const usingMock = !import.meta.env.VITE_API_URL;

// Responses from the mock are cloned, the way JSON over the network would be, so the mock's
// in-memory data never shares objects with the (frozen) Redux state.
// In real mode, rest.js already returns fresh objects from JSON.parse inside fetch.
function overNetwork(group) {
  return Object.fromEntries(
    Object.entries(group).map(([name, fn]) => [name, async (...args) => structuredClone(await fn(...structuredClone(args)))])
  );
}

export const api = usingMock
  ? new Proxy(mock, { get: (target, key) => target[key] && overNetwork(target[key]) })
  : rest;
