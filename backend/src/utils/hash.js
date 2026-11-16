import crypto from 'crypto';

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
    parents: parents || [],
    authorId,
    message,
    createdAt,
    paragraphs: (paragraphs || []).map(({ id, text, origin }) => ({ id, text, origin })),
  };
}

export function hashCommit(commit) {
  const json = canonical(commitPayload(commit));
  return crypto.createHash('sha256').update(json).digest('hex');
}

export const shortHash = (hash) => (hash ? hash.slice(0, 8) : '');
