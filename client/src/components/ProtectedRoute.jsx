import { Navigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return children;
}
