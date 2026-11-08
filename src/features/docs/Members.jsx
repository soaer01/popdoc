import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useOutletContext } from 'react-router-dom';
import { roleNames, timeAgo } from '../../lib/format.js';
import { addMember, setRole } from './docsSlice.js';
import Rounds from './Rounds.jsx';
import './Members.css';

const roleHelp = {
  owner: 'Runs rounds and manages people.',
  member: 'Drafts on a private branch and opens pull requests.',
  reviewer: 'Reviews and approves pull requests. Usually the instructor or supervisor.',
  viewer: 'Reads the main document only.',
};

export default function Members() {
  const { doc } = useOutletContext();
  const dispatch = useDispatch();
  const isOwner = doc.myRole === 'owner';
  const [email, setEmail] = useState('');
  const [role, setNewRole] = useState('member');
  const [error, setError] = useState(null);

  async function onAdd(e) {
    e.preventDefault();
    const action = await dispatch(addMember({ docId: doc.id, email, role }));
    if (action.error) return setError(action.error.message);
    setEmail('');
    setError(null);
  }

  return (
    <section className="doc-page">
      <Rounds doc={doc} />
      <h2>People and roles</h2>
      <table className="members">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">Last active</th>
          </tr>
        </thead>
        <tbody>
          {doc.members.map((m) => (
            <tr key={m.userId}>
              <td>
                {m.name}
                <div className="small muted">{m.email}</div>
              </td>
              <td>
                {isOwner && m.role !== 'owner' ? (
                  <select
                    aria-label={`Role for ${m.name}`}
                    value={m.role}
                    onChange={(e) => dispatch(setRole({ docId: doc.id, userId: m.userId, role: e.target.value }))}
                  >
                    {['member', 'reviewer', 'viewer'].map((r) => (
                      <option key={r} value={r}>
                        {roleNames[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  roleNames[m.role]
                )}
              </td>
              <td className="muted">{m.lastActiveAt ? timeAgo(m.lastActiveAt) : 'Not yet'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isOwner && (
        <form className="members-add" onSubmit={onAdd}>
          <h3>Add someone</h3>
          <div className="members-add-row">
            <label className="field">
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              Role
              <select value={role} onChange={(e) => setNewRole(e.target.value)}>
                {['member', 'reviewer', 'viewer'].map((r) => (
                  <option key={r} value={r}>
                    {roleNames[r]}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary">Add to document</button>
          </div>
          <p className="small muted">{roleHelp[role]}</p>
          {error && <p className="field-error">{error}</p>}
        </form>
      )}
    </section>
  );
}
