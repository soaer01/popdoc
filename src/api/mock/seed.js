// Demo data. Any password of 8+ characters works in the mock.
// Commits are hashed at build time so the demo history verifies like real data.
import { hashCommit } from '../../lib/hash.js';

const day = 86400000;
const ago = (days, hours = 0) => new Date(Date.now() - days * day - hours * 3600000).toISOString();

async function commit(fields) {
  const c = { ...fields };
  c.id = await hashCommit(c);
  return c;
}

export async function buildSeed() {
  const users = [
    { id: 'u_afzal', name: 'Mian Afzal Saeed', email: 'afzal@popdoc.dev' },
    { id: 'u_safee', name: 'Safee Akmal', email: 'safee@popdoc.dev' },
    { id: 'u_reviewer', name: 'Dr. Hina Qureshi', email: 'hina@popdoc.dev' },
  ];

  const p1 = {
    id: 'p_1',
    text: 'Most students now write with an AI tool open in another tab. What no tool records is how a piece of group work was actually produced.',
    origin: 'typed',
    authorId: 'u_afzal',
  };
  const p2 = {
    id: 'p_2',
    text: 'Detectors cannot settle the question. In one study they flagged 61% of essays by non-native English writers as AI-generated, even though people wrote all of them.',
    origin: 'typed',
    authorId: 'u_safee',
    prNumber: 1,
  };
  const p3 = {
    id: 'p_3',
    text: 'If the version history is the evidence, a group can show who wrote each paragraph and where AI helped, instead of arguing about a detector score.',
    origin: 'typed',
    authorId: 'u_afzal',
  };

  const c1 = await commit({
    docId: 'd_1',
    branchId: 'b_main',
    parents: [],
    authorId: 'u_afzal',
    message: 'Start the introduction',
    paragraphs: [p1],
    createdAt: ago(6),
  });
  const cSafee = await commit({
    docId: 'd_1',
    branchId: 'b_safee',
    parents: [c1.id],
    authorId: 'u_safee',
    message: 'Add the detector bias evidence',
    paragraphs: [p1, { ...p2, prNumber: undefined }],
    createdAt: ago(5, 3),
  });
  const c2 = await commit({
    docId: 'd_1',
    branchId: 'b_main',
    parents: [c1.id, cSafee.id],
    authorId: 'u_afzal',
    message: 'Merge pull request #1: Detector bias evidence',
    paragraphs: [p1, p2],
    createdAt: ago(5),
  });
  const cAfzal = await commit({
    docId: 'd_1',
    branchId: 'b_afzal',
    parents: [c2.id],
    authorId: 'u_afzal',
    message: 'Propose the core argument',
    paragraphs: [
      { ...p1, text: 'Most students now write with an AI tool open in another tab, yet no tool records how a piece of group work was actually produced.' },
      p2,
      p3,
    ],
    createdAt: ago(0, 5),
  });
  // Safee rewords the same opening paragraph on her branch, so PR #3 conflicts once PR #2 merges.
  const cSafee2 = await commit({
    docId: 'd_1',
    branchId: 'b_safee',
    parents: [c2.id],
    authorId: 'u_safee',
    message: 'Sharpen the opening sentence',
    paragraphs: [
      { ...p1, text: 'Most students now draft with an AI tool open beside them. No common tool records how group work was actually produced.', authorId: 'u_safee' },
      p2,
    ],
    createdAt: ago(4),
  });

  // JSON-safe: drop undefined fields
  const clean = (x) => JSON.parse(JSON.stringify(x));

  return clean({
    session: null,
    users,
    documents: [
      {
        id: 'd_1',
        title: 'Why detectors can’t prove authorship',
        ownerId: 'u_afzal',
        members: [
          { userId: 'u_afzal', role: 'owner', lastActiveAt: ago(0, 5) },
          { userId: 'u_safee', role: 'member', lastActiveAt: ago(4) },
          { userId: 'u_reviewer', role: 'reviewer', lastActiveAt: ago(5) },
        ],
        round: 'open',
        ledgerShared: false,
        mainBranchId: 'b_main',
        createdAt: ago(6),
      },
      {
        id: 'd_2',
        title: 'Lab 4 report: database indexing',
        ownerId: 'u_safee',
        members: [
          { userId: 'u_safee', role: 'owner', lastActiveAt: ago(1) },
          { userId: 'u_afzal', role: 'member', lastActiveAt: ago(2) },
        ],
        round: 'open',
        ledgerShared: false,
        mainBranchId: 'b_d2_main',
        createdAt: ago(2),
      },
    ],
    branches: [
      { id: 'b_main', docId: 'd_1', name: 'main', kind: 'main', ownerId: null, headId: c2.id, invited: [] },
      { id: 'b_afzal', docId: 'd_1', name: 'afzal/draft', kind: 'member', ownerId: 'u_afzal', headId: cAfzal.id, invited: [] },
      { id: 'b_safee', docId: 'd_1', name: 'safee/draft', kind: 'member', ownerId: 'u_safee', headId: cSafee2.id, invited: [] },
      { id: 'b_d2_main', docId: 'd_2', name: 'main', kind: 'main', ownerId: null, headId: null, invited: [] },
    ],
    commits: [c1, cSafee, c2, cAfzal, cSafee2],
    pullRequests: [
      {
        id: 'pr_1',
        number: 1,
        docId: 'd_1',
        sourceBranchId: 'b_safee',
        targetBranchId: 'b_main',
        authorId: 'u_safee',
        title: 'Detector bias evidence',
        description: 'Adds the Liang et al. finding to support the opening claim.',
        contributionType: 'evidence',
        confirmedType: 'evidence',
        aiInvolved: false,
        status: 'merged',
        baseId: c1.id,
        headId: cSafee.id,
        approvals: ['u_afzal'],
        comments: [],
        createdAt: ago(5, 2),
        mergedAt: ago(5),
        mergeCommitId: c2.id,
      },
      {
        id: 'pr_2',
        number: 2,
        docId: 'd_1',
        sourceBranchId: 'b_afzal',
        targetBranchId: 'b_main',
        authorId: 'u_afzal',
        title: 'Core argument: history as evidence',
        description: 'States the thesis that the rest of the paper defends.',
        contributionType: 'idea',
        confirmedType: null,
        aiInvolved: false,
        status: 'open',
        baseId: c2.id,
        headId: cAfzal.id,
        approvals: [],
        comments: [
          {
            id: 'cm_1',
            authorId: 'u_reviewer',
            paragraphId: 'p_3',
            body: 'Good thesis. Say what kind of evidence a reviewer would actually check.',
            createdAt: ago(0, 2),
          },
        ],
        createdAt: ago(0, 4),
      },
      {
        id: 'pr_3',
        number: 3,
        docId: 'd_1',
        sourceBranchId: 'b_safee',
        targetBranchId: 'b_main',
        authorId: 'u_safee',
        title: 'Tighter opening sentence',
        description: 'Two short sentences read better than one long one.',
        contributionType: 'wording',
        confirmedType: 'wording',
        aiInvolved: false,
        status: 'open',
        baseId: c2.id,
        headId: cSafee2.id,
        approvals: ['u_reviewer'],
        comments: [],
        createdAt: ago(4),
      },
    ],
    aiJobs: [],
  });
}
