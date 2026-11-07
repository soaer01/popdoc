// Re-derive each commit's hash from its content. A mismatch means the stored history was altered.
import { hashCommit } from './hash.js';

export async function verifyCommits(commits) {
  const results = await Promise.all(commits.map(async (c) => [c.id, (await hashCommit(c)) === c.id]));
  return Object.fromEntries(results);
}
