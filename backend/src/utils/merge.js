// Three-way merge engine for PopDoc backend.
// Implements commit graph traversal (reachable, mergeBase) and paragraph-level 3-way merge.

export function reachable(headId, commitsMap) {
  const seen = new Set();
  const queue = headId ? [headId] : [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const commit = commitsMap.get(id);
    if (commit?.parents) {
      queue.push(...commit.parents);
    }
  }
  return seen;
}

export function mergeBase(a, b, commits) {
  if (!a || !b) return null;
  const commitsMap = new Map(commits.map((c) => [c.id || c._id, c]));
  const fromB = reachable(b, commitsMap);
  const candidates = [...reachable(a, commitsMap)]
    .map((id) => commitsMap.get(id))
    .filter((c) => c && fromB.has(c.id || c._id))
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
  return candidates[0]?.id || candidates[0]?._id || null;
}

const same = (a, b) => (!a && !b) || (a && b && a.text === b.text && a.origin === b.origin);

export function threeWayMerge(base = [], current = [], incoming = []) {
  const B = new Map((base || []).map((p) => [p.id, p]));
  const C = new Map((current || []).map((p) => [p.id, p]));
  const I = new Map((incoming || []).map((p) => [p.id, p]));

  // Order: current's order, with incoming-only paragraphs placed after their incoming predecessor.
  const order = (current || []).map((p) => p.id);
  (incoming || []).forEach((p, idx) => {
    if (order.includes(p.id)) return;
    const prev = incoming[idx - 1]?.id;
    const at = prev ? order.indexOf(prev) + 1 : 0;
    order.splice(at, 0, p.id);
  });

  // Paragraphs deleted on one side may still need a slot if the other side edited them
  (base || []).forEach((p) => {
    if (!order.includes(p.id) && (C.has(p.id) || I.has(p.id))) {
      order.push(p.id);
    }
  });

  const result = [];
  const conflicts = [];

  for (const id of order) {
    const b = B.get(id);
    const c = C.get(id);
    const i = I.get(id);

    if (same(c, i)) {
      if (c) result.push(c);
    } else if (same(c, b)) {
      if (i) result.push(i); // changed only on incoming
    } else if (same(i, b)) {
      if (c) result.push(c); // changed only on current
    } else {
      conflicts.push({ id, base: b || null, current: c || null, incoming: i || null });
      result.push({ id, conflict: true });
    }
  }

  return { paragraphs: result, conflicts };
}

export function applyResolutions(merged, resolutions = {}) {
  return merged
    .map((p) => (p.conflict ? resolutions[p.id] : p))
    .filter(Boolean);
}
