// Convert between the stored paragraph list and Tiptap's JSON document.

const newPid = () => `p_${Math.random().toString(36).slice(2, 10)}`;

export function toDoc(paragraphs = []) {
  const content = paragraphs.map((p) => ({
    type: 'paragraph',
    attrs: { pid: p.id, origin: p.origin, authorId: p.authorId },
    content: p.text ? [{ type: 'text', text: p.text }] : [],
  }));
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

// base: the paragraphs as of the last save point, used to tell edited AI text from accepted AI text.
export function fromDoc(json, { base = [], userId }) {
  const baseById = new Map(base.map((p) => [p.id, p]));
  const seen = new Set();
  const out = [];

  for (const node of json.content || []) {
    if (node.type !== 'paragraph') continue;
    const text = (node.content || []).map((t) => t.text || '').join('');
    let { pid, origin, authorId } = node.attrs || {};

    if (!pid || seen.has(pid)) {
      pid = newPid();
      origin = origin === 'pasted' ? 'pasted' : 'typed';
      authorId = userId;
    }
    seen.add(pid);

    const before = baseById.get(pid);
    if (before && before.text !== text) {
      if (before.origin === 'ai') origin = 'ai-edited';
      authorId = authorId || userId;
    }
    if (!text.trim() && !before) continue; // drop empty new paragraphs
    out.push({ id: pid, text, origin: origin || 'typed', authorId: authorId || userId, ...(before?.prNumber && before.text === text ? { prNumber: before.prNumber } : {}) });
  }
  return out;
}

export const sameContent = (a = [], b = []) =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id && p.text === b[i].text && p.origin === b[i].origin);

export const wordCount = (paragraphs = []) =>
  paragraphs.reduce((n, p) => n + (p.text.trim() ? p.text.trim().split(/\s+/).length : 0), 0);
