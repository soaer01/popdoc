# PopDoc

Proof-of-process collaborative writing. Every member drafts on a private branch, changes reach the
shared document only through reviewed pull requests, and the version history becomes the record of
how the document was written.

Web Programming project, BDS-7A. Mian Afzal Saeed (23L-2505), Safee Akmal (23L-2556).

## Stack

- **Frontend:** React, Redux Toolkit, Tiptap (this repo)
- **Backend (later):** Node.js, Express, Socket.IO, MongoDB with Mongoose

## Running the client

```bash
npm install
npm run dev
```

The client runs at http://localhost:5173. Until the API exists, it uses an in-browser mock API.
