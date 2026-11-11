// Thin fetch wrapper for the Express API.
// The server sets the JWT in an httpOnly cookie; the client only needs to send credentials.
// No CSRF token is used by the local backend.

const BASE = import.meta.env.VITE_API_URL || '/api';

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

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw new ApiError(
      err.name === 'AbortError'
        ? 'Request cancelled.'
        : 'Could not reach the server. Check your connection.',
      0,
      null,
    );
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed with status ${res.status}`, res.status, data);
  }
  return data;
}
