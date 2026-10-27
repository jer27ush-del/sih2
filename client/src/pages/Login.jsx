import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-none';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(identifier, password);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Login to Your Account" subtitle="Use your Institution ID or email and password.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium">
          Institution ID / Email
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-700 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {submitting ? 'Logging in…' : 'Login'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New institution? <Link to="/register" className="text-blue-700 hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
