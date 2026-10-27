import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AppHeader({ links = [] }) {
  const { user, logout } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">AICTE Complaint Portal</p>
          <p className="text-sm text-slate-500">{user.name} · {user.email}</p>
        </div>
        <button onClick={logout} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-100">
          Logout
        </button>
      </div>
      {links.length > 0 && (
        <nav className="flex gap-1 px-6">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                `border-b-2 px-3 py-2 text-sm ${
                  isActive ? 'border-blue-700 font-medium text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
