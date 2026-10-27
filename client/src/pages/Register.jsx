import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-none';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ aicteId: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await register(form);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create an Account" subtitle="Your institution must already be registered with AICTE.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium">
          Institution ID (AICTE Permanent ID)
          <input className={inputClass} value={form.aicteId} onChange={update('aicteId')} required />
        </label>
        <label className="block text-sm font-medium">
          Contact name
          <input className={inputClass} value={form.name} onChange={update('name')} required />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input type="email" className={inputClass} value={form.email} onChange={update('email')} required />
        </label>
        <label className="block text-sm font-medium">
          Password (min. 8 characters)
          <input type="password" className={inputClass} value={form.password} onChange={update('password')} required />
        </label>

        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-700 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered? <Link to="/login" className="text-blue-700 hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  );
}
