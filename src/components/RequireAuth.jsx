import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function RequireAuth() {
  const { user, status } = useSelector((s) => s.auth);
  const location = useLocation();

  if (status === 'idle' || status === 'checking') {
    return <p className="empty">Checking your session…</p>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
