import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="empty">
      <h1>No page at this address</h1>
      <p>
        Check the link, or go back to <Link to="/docs">your documents</Link>.
      </p>
    </main>
  );
}
