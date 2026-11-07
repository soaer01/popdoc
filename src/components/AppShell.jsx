import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { fetchMe, logout, selectUser } from '../features/auth/authSlice.js';
import './AppShell.css';

export default function AppShell() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);

  async function onLogout() {
    await dispatch(logout());
    navigate('/');
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="PopDoc home">
          <span className="wordmark-rule" aria-hidden="true" />
          PopDoc
        </Link>
        <nav className="topnav">
          <NavLink to="/docs">Documents</NavLink>
          {user ? (
            <>
              <span className="topnav-user">{user.name}</span>
              <button className="btn btn-quiet" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
