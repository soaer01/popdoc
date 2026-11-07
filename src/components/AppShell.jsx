import { Link, NavLink, Outlet } from 'react-router-dom';
import './AppShell.css';

export default function AppShell() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="PopDoc home">
          <span className="wordmark-rule" aria-hidden="true" />
          PopDoc
        </Link>
        <nav className="topnav">
          <NavLink to="/docs">Documents</NavLink>
          <NavLink to="/login">Log in</NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
