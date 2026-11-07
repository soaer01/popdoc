export const originNames = {
  typed: 'Typed here',
  pasted: 'Pasted',
  ai: 'AI proposal, accepted as is',
  'ai-edited': 'AI proposal, then edited',
  translated: 'Translated from own draft',
};

export default function ProvenanceLegend() {
  return (
    <ul className="legend" aria-label="What the margin colours mean">
      {Object.entries(originNames).map(([key, label]) => (
        <li key={key}>
          <span className={`legend-swatch origin-${key}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
