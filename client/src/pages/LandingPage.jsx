import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function Choice({ to, title, text, action }) {
  return (
    <article className="flex flex-col rounded-xl bg-white p-6 ring-2 ring-slate-400">
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-2 flex-1 text-lg">{text}</p>
      <Link
        to={to}
        className="mt-5 rounded-md bg-blue-900 px-5 py-3 text-center text-lg font-semibold text-white hover:bg-blue-950"
      >
        {action}
      </Link>
    </article>
  );
}

export default function LandingPage() {
  const [service, setService] = useState('Checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setService(r.ok ? 'Working' : 'Having trouble. Please try again later.'))
      .catch(() => setService('Having trouble. Please try again later.'));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-lg font-semibold text-blue-900">All India Council for Technical Education (AICTE)</p>
        <h1 className="mt-2 text-4xl font-bold">Complaint Portal</h1>
        <p className="mt-3 text-xl">Raise a complaint, follow it step by step, and see it resolved.</p>
      </header>

      <section aria-labelledby="choose-heading" className="mt-10">
        <h2 id="choose-heading" className="text-2xl font-bold">Who are you?</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <Choice
            to="/login"
            title="I represent an institution"
            text="Raise a complaint and follow its progress. Log in with your Institution ID or your email."
            action="Log in"
          />
          <Choice
            to="/login"
            title="I work for AICTE"
            text="Review, route, and resolve complaints. Log in with your official AICTE email."
            action="Staff log in"
          />
          <Choice
            to="/track"
            title="I want to track a complaint"
            text="Check the status of a complaint using its ID and the email your institution registered."
            action="Track my complaint"
          />
        </div>
      </section>

      <section aria-labelledby="how-heading" className="mt-12">
        <h2 id="how-heading" className="text-2xl font-bold">How it works</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-lg">
          <li>Log in as an institution, or create an account if your institution is new.</li>
          <li>Describe the problem and attach any documents, such as letters or photos.</li>
          <li>Check the suggested priority and any similar complaints, then submit.</li>
          <li>Follow the updates. If AICTE asks for more information, reply from the complaint page.</li>
        </ol>
      </section>

      <p className="mt-10 text-lg">
        <span className="font-semibold">Service status: </span>
        {service}
      </p>
    </main>
  );
}
