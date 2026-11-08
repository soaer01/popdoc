import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../../api/index.js';
import { docUpdated } from './docsSlice.js';

const rounds = {
  open: {
    name: 'No round',
    help: 'Any reviewed pull request can be merged.',
  },
  idea: {
    name: 'Idea round',
    help: 'Only content is merged: ideas, evidence and structure. Wording edits from members wait, so people writing in a second language can get their ideas in first.',
  },
  polish: {
    name: 'Polish round',
    help: 'Wording edits are merged too. Use this once the content is settled.',
  },
};

export default function Rounds({ doc }) {
  const dispatch = useDispatch();
  const [error, setError] = useState(null);
  const isOwner = doc.myRole === 'owner';

  async function start(round) {
    try {
      await api.ledger.setRound(doc.id, { round });
      dispatch(docUpdated({ ...doc, round }));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="rounds">
      <h2>Writing round</h2>
      <p>
        <strong>{rounds[doc.round].name}.</strong> {rounds[doc.round].help}
      </p>
      {isOwner && (
        <div className="rounds-actions" role="radiogroup" aria-label="Current round">
          {Object.entries(rounds).map(([key, r]) => (
            <button key={key} role="radio" aria-checked={doc.round === key} className={`btn ${doc.round === key ? 'is-chosen' : ''}`} onClick={() => start(key)}>
              {key === 'open' ? 'End rounds' : `Start ${r.name.toLowerCase()}`}
            </button>
          ))}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
