# PopDoc

Proof-of-process collaborative writing. Every member drafts on a private branch, changes reach the
shared document only through reviewed pull requests, and the version history becomes the record of
how the document was written.

Web Programming project, BDS-7A. Mian Afzal Saeed (23L-2505), Safee Akmal (23L-2556).

## Stack

- **Frontend (this repo):** React 18, Redux Toolkit, React Router, Tiptap, jsdiff, Socket.IO client
- **Backend (next):** Node.js, Express, Socket.IO, MongoDB with Mongoose, server-side LLM calls

## Running the client

```bash
npm install
npm run dev
```

Open http://localhost:5173. With `VITE_API_URL` unset, the client runs on an in-browser mock API
(`src/api/mock`) that stores its data in localStorage. To reset the demo, clear the site's storage.

Demo accounts (any password of 8+ characters):

| Email              | Name             | Role in the demo document |
| ------------------ | ---------------- | ------------------------- |
| `afzal@popdoc.dev` | Mian Afzal Saeed | Owner                     |
| `safee@popdoc.dev` | Safee Akmal      | Member                    |
| `hina@popdoc.dev`  | Dr. Hina Qureshi | Reviewer                  |

### Demo walkthrough

1. Log in as Afzal, open the document, edit your draft and make a save point.
2. Merge PR #3 (already approved by the reviewer). It fast-forwards main.
3. Log in as Safee and approve PR #2. Both branches changed the opening paragraph, so it opens the
   conflict screen.
4. As Afzal, open your draft again. Main has moved, so use **Update from main**. Both of you changed
   the opening paragraph, so pick which version to keep.
5. Make a new branch from the Draft page, or pick an old save point in History and start a branch
   there. Open a pull request from whichever branch you like.
6. On a pull request or in History, compare by words, sentences or whole paragraphs.
7. As Afzal, ask the AI to rewrite a paragraph, then accept, edit or reject each change.
8. Check the ledger and the process record, and verify the record against the history.

Owners and members can rename a document from its header.

## Structure

```
src/
  api/            http.js (fetch + CSRF header), rest.js (Express routes), mock/ (offline backend)
  lib/            hash (SHA-256 commits), diff (paragraph + word diff), merge (three-way), socket
  features/
    auth/         login and sign-up
    docs/         dashboard, document layout, people and rounds
    branches/     private draft branch with the Tiptap editor and save points
    editor/       Tiptap setup, provenance paragraph node, paste flagging
    history/      paginated commit history, hash verification, restore
    pulls/        pull requests, diff view, comments, approvals, merge, conflicts
    ai/           AI requests (background jobs) and per-change review
    ledger/       contribution ledger and statement export
    record/       process record export and re-verification
  store/          Redux store
  styles/         tokens, base, shared UI and provenance colours
```

## API contract for the backend

`src/api/rest.js` is the contract. The mock in `src/api/mock` implements the same calls and
enforces the same rules, so it doubles as a reference for the Express handlers.

| Method | Route                              | Notes                                              |
| ------ | ---------------------------------- | -------------------------------------------------- |
| GET    | `/auth/me`                         | JWT read from an httpOnly cookie                   |
| POST   | `/auth/login`, `/auth/signup`      | Sets the cookie and a readable `csrf-token` cookie |
| POST   | `/auth/logout`                     |                                                    |
| GET    | `/documents`                       | Documents the caller is a member of                |
| POST   | `/documents`                       |                                                    |
| GET    | `/documents/:id`                   | Includes `myRole`                                  |
| PATCH  | `/documents/:id`                   | Rename; owners and members, old titles kept        |
| POST   | `/documents/:id/members`           | Owner only                                         |
| PATCH  | `/documents/:id/members/:userId`   | Owner only                                         |
| GET    | `/documents/:id/branches`          | Private branches filtered out                      |
| POST   | `/documents/:id/branches`          | New private branch from any visible save point     |
| PUT    | `/documents/:id/branches/mine`     | Creates the caller's draft branch if needed        |
| GET    | `/branches/:id`                    | Branch, head commit and `behindMain`               |
| POST   | `/branches/:id/update-from-main`   | Merges main in; returns conflicts until resolved   |
| POST   | `/branches/:id/commits`            | Compare-and-set on `expectedHeadId`, 409 if stale  |
| GET    | `/branches/:id/commits?cursor&limit` | Paginated history                                |
| POST   | `/branches/:id/restore`            | Writes a new commit, never rewrites history        |
| GET    | `/branches/:id/status`             | Has changes vs main, open PR id                    |
| GET    | `/documents/:id/pulls`             |                                                    |
| POST   | `/documents/:id/pulls`             |                                                    |
| GET    | `/pulls/:id`                       | Base, head and merge plan                          |
| POST   | `/pulls/:id/comments`              |                                                    |
| POST   | `/pulls/:id/approve`               | Not by the author                                  |
| POST   | `/pulls/:id/merge`                 | Fast-forward, three-way, or with resolutions       |
| POST   | `/pulls/:id/close`                 |                                                    |
| GET    | `/documents/:id/ai/jobs`           |                                                    |
| POST   | `/documents/:id/ai/jobs`           | Queues a background job                            |
| GET    | `/documents/:id/ledger`            | Reviewers only if the group shared it              |
| PUT    | `/documents/:id/ledger/sharing`    | Owner only                                         |
| PUT    | `/documents/:id/round`             | `open`, `idea` or `polish`                         |
| GET    | `/documents/:id/record`            | Final hash, merges and all reachable commits       |

Socket.IO events (`src/lib/socket.js`): `branch:join`, `branch:leave`, `presence`, `para:lock`,
`para:unlock`, and `job:done` (to replace AI job polling).

## Branches

A new branch is a copy of one save point and doesn't follow main on its own. When main moves on,
the draft screen offers **Update from main**. If the branch has no save points of its own, it
fast-forwards. Otherwise it writes a merge save point with both parents, so the history shows when
main's work came in.

## Commit hashes

A commit id is the SHA-256 of its canonical JSON: parents, author, message, time and paragraphs
(`src/lib/hash.js`). Since parents are part of the hash, changing any old commit changes every hash
after it. The process record includes every commit reachable from main, so anyone can recompute it.

## Known limit

The record covers work done inside PopDoc. Pasted text is flagged, but text retyped from another
window can't be detected.
