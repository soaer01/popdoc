// SHA-256 helpers for tamper-evident history.
// A commit's id is the hash of its canonical content, including its parents' ids,
// so changing any old commit changes every hash after it.

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Stable JSON: object keys sorted, so the same content always hashes the same way.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function commitPayload({ parents, authorId, message, paragraphs, createdAt }) {
  return {
    parents,
    authorId,
    message,
    createdAt,
    paragraphs: paragraphs.map(({ id, text, origin }) => ({ id, text, origin })),
  };
}

export const hashCommit = (commit) => sha256(canonical(commitPayload(commit)));

export const shortHash = (hash) => (hash ? hash.slice(0, 8) : '');
