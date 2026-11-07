// Thin fetch wrapper for the Express API.
// The server sets the JWT in an httpOnly cookie, so the client never touches the token;
// it only has to send cookies and echo the CSRF token back in a header.

const BASE = import.meta.env.VITE_API_URL || '/api';

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function http(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const csrf = readCookie('csrf-token');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed with status ${res.status}`, res.status, data);
  }
  return data;
}
