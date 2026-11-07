import { Link } from 'react-router-dom';
import './Landing.css';

const sample = [
  {
    origin: 'typed',
    text: 'Detectors cannot settle whether a student wrote their essay. A record of how it was written can.',
    who: 'Afzal',
    pr: 3,
    kind: 'Idea',
  },
  {
    origin: 'ai-edited',
    text: 'In one study, detectors flagged 61% of essays by non-native English writers as AI-generated, even though people wrote all of them.',
    who: 'Safee, from an AI proposal',
    pr: 5,
    kind: 'Evidence',
  },
  {
    origin: 'pasted',
    text: 'HEC’s draft policy makes AI disclosure mandatory, but gives no way to check one.',
    who: 'Afzal',
    pr: 6,
    kind: 'Evidence',
  },
];

const originNames = {
  typed: 'Typed',
  pasted: 'Pasted',
  ai: 'AI, accepted',
  'ai-edited': 'AI, then edited',
  translated: 'Translated',
};

export default function Landing() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <h1>Group writing where the history is the evidence.</h1>
          <p className="lede">
            Each member drafts on a private branch. Changes reach the shared document only through
            reviewed pull requests, and every merged paragraph keeps a record of who wrote it and
            whether AI was involved.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="btn btn-primary">
              Start a group document
            </Link>
            <Link to="/docs" className="btn">
              Open the demo
            </Link>
          </div>
        </div>

        <figure className="hero-sheet sheet" aria-label="Example of a merged document with provenance">
          {sample.map((p) => (
            <div key={p.pr} className={`hero-para origin-${p.origin}`}>
              <p>{p.text}</p>
              <figcaption className="receipt">
                <span>{originNames[p.origin]}</span>
                <span>{p.who}</span>
                <span>PR #{p.pr}</span>
                <span>{p.kind}</span>
              </figcaption>
            </div>
          ))}
          <div className="hero-hash">
            Document hash <code>9f2c41e0…b7a3</code>
          </div>
        </figure>
      </section>

      <section className="how">
        <h2>How a paragraph gets into the document</h2>
        <ol className="steps">
          <li>
            <h3>Draft privately</h3>
            <p>Your branch is invisible to the group until you choose to share it.</p>
          </li>
          <li>
            <h3>Open a pull request</h3>
            <p>Tag it as an idea, evidence, structure or wording, and say if AI helped.</p>
          </li>
          <li>
            <h3>Get it reviewed</h3>
            <p>Someone other than you reads the word-level diff and approves the merge.</p>
          </li>
          <li>
            <h3>Submit the record</h3>
            <p>Export a hash-verified list of every merge with your final document.</p>
          </li>
        </ol>
      </section>

      <footer className="landing-foot muted small">
        PopDoc records work done inside PopDoc. Pasted text is flagged, but text retyped from another
        window can&rsquo;t be detected.
      </footer>
    </main>
  );
}
