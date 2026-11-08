// Paragraph-aware diff.
// Paragraphs are matched by id; changed paragraphs are compared word by word (Myers, jsdiff's
// diffWords), sentence by sentence, or as whole paragraphs, depending on the chosen mode.
// Paragraphs present in both versions but out of order relative to the longest common
// subsequence are reported as moved.
import { diffSentences, diffWords } from 'diff';

export const DIFF_MODES = { words: 'Words', sentences: 'Sentences', paragraphs: 'Paragraphs' };

function textParts(before, after, mode) {
  if (mode === 'sentences') return diffSentences(before, after);
  if (mode === 'paragraphs') return [{ removed: true, value: before }, { added: true, value: after }];
  return diffWords(before, after);
}

function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const keep = new Set();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      keep.add(a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return keep;
}

export function paragraphDiff(base = [], head = [], mode = 'words') {
  const baseById = new Map(base.map((p) => [p.id, p]));
  const headById = new Map(head.map((p) => [p.id, p]));
  const common = base.map((p) => p.id).filter((id) => headById.has(id));
  const inOrder = lcs(
    common,
    head.map((p) => p.id).filter((id) => baseById.has(id))
  );

  const rows = head.map((after) => {
    const before = baseById.get(after.id);
    if (!before) return { id: after.id, status: 'added', after };
    const moved = !inOrder.has(after.id);
    if (before.text === after.text) {
      return { id: after.id, status: moved ? 'moved' : 'same', before, after };
    }
    return { id: after.id, status: 'changed', moved, before, after, parts: textParts(before.text, after.text, mode) };
  });

  // Put each removed paragraph back after its nearest surviving predecessor from the base.
  base.forEach((before, index) => {
    if (headById.has(before.id)) return;
    let at = 0;
    for (let k = index - 1; k >= 0; k--) {
      const pos = rows.findIndex((r) => r.id === base[k].id);
      if (pos >= 0) {
        at = pos + 1;
        break;
      }
    }
    rows.splice(at, 0, { id: before.id, status: 'removed', before });
  });

  return rows;
}

export function diffStats(rows) {
  let added = 0;
  let removed = 0;
  const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  for (const r of rows) {
    if (r.status === 'added') added += words(r.after.text);
    if (r.status === 'removed') removed += words(r.before.text);
    if (r.status === 'changed') {
      // Counts are always in words, whichever mode the diff is shown in.
      for (const part of diffWords(r.before.text, r.after.text)) {
        if (part.added) added += words(part.value);
        if (part.removed) removed += words(part.value);
      }
    }
  }
  return { added, removed, moved: rows.filter((r) => r.status === 'moved' || r.moved).length };
}
