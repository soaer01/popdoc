// Three-way paragraph merge against the common ancestor.
// A paragraph changed on only one side takes that side's version; changed differently on
// both sides it becomes a conflict for a person to resolve.

const same = (a, b) => (!a && !b) || (a && b && a.text === b.text && a.origin === b.origin);

export function threeWayMerge(base = [], current = [], incoming = []) {
  const B = new Map(base.map((p) => [p.id, p]));
  const C = new Map(current.map((p) => [p.id, p]));
  const I = new Map(incoming.map((p) => [p.id, p]));

  // Order: current's order, with incoming-only paragraphs placed after their incoming predecessor.
  const order = current.map((p) => p.id);
  incoming.forEach((p, idx) => {
    if (order.includes(p.id)) return;
    const prev = incoming[idx - 1]?.id;
    const at = prev ? order.indexOf(prev) + 1 : 0;
    order.splice(at, 0, p.id);
  });
  // Paragraphs deleted on one side may still need a slot if the other side edited them.
  base.forEach((p) => {
    if (!order.includes(p.id) && (C.has(p.id) || I.has(p.id))) order.push(p.id);
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
      if (i) result.push(i); // changed (or added/deleted) only on incoming
    } else if (same(i, b)) {
      if (c) result.push(c); // changed only on current
    } else {
      conflicts.push({ id, base: b || null, current: c || null, incoming: i || null });
      result.push({ id, conflict: true });
    }
  }
  return { paragraphs: result, conflicts };
}

// resolutions: { [paragraphId]: paragraph | null } where null means drop the paragraph.
export function applyResolutions(merged, resolutions) {
  return merged
    .map((p) => (p.conflict ? resolutions[p.id] : p))
    .filter(Boolean);
}
