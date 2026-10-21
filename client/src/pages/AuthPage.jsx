import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Field from '../components/ui/Field';
import Logo from '../components/Logo';
import Avatar from '../components/ui/Avatar';
import { errorMessage } from '../utils/format';

// Static sample shown beside the form so the first screen shows what the app does.
const SAMPLE_TASKS = [
  { title: 'Draft the launch checklist', who: 'Maya Lopez', due: 'Due Fri', tone: 'bg-amber-400' },
  { title: 'Review pricing page copy', who: 'Dev Patel', due: 'Due Mon', tone: 'bg-sky-400' },
  { title: 'Book the offsite venue', who: 'Sara Khan', due: 'Done', tone: 'bg-emerald-400' },
];

function SamplePreview() {
  return (
    <div className="w-full max-w-md space-y-3" aria-hidden="true">
      {SAMPLE_TASKS.map((task, index) => (
        <div
          key={task.title}
          className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-white/10"
          style={{ marginLeft: `${index * 20}px` }}
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${task.tone}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{task.title}</p>
            <p className="text-xs text-white/60">{task.due}</p>
          </div>
          <Avatar name={task.who} />
        </div>
      ))}
    </div>
  );
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  /** Mirrors the server rules so people get instant feedback; the server still re-checks everything. */
  function validate() {
    const errors = {};
    if (isRegister && form.name.trim().length < 2) errors.name = 'Enter your name (at least 2 characters)';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address';
    if (isRegister) {
      const { password } = form;
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        errors.password = 'Use at least 8 characters, including a letter and a number';
      }
    } else if (!form.password) {
      errors.password = 'Enter your password';
    }
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ name: form.name, email: form.email, password: form.password });
      } else {
        await login({ email: form.email, password: form.password });
      }
      navigate('/', { replace: true });
    } catch (error) {
      // Show server validation messages next to the right field, anything else above the button.
      const serverErrors = {};
      (error.details || []).forEach((detail) => {
        serverErrors[detail.field] = detail.message;
      });
      if (Object.keys(serverErrors).length > 0) setFieldErrors(serverErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-ink p-12 lg:flex">
        <Logo light />
        <div className="space-y-10">
          <div className="max-w-md space-y-4">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
              Who is doing what, and by when.
            </h1>
            <p className="text-base leading-relaxed text-white/70">
              Set up a team, hand out tasks, and follow each one from to do to done.
            </p>
          </div>
          <SamplePreview />
        </div>
        <p className="text-sm text-white/50">Built for small teams that want a clear shared list.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {isRegister ? 'Create your account' : 'Log in to Tandem'}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {isRegister ? 'It takes less than a minute.' : 'Pick up where your team left off.'}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
            {isRegister && (
              <Field label="Full name" error={fieldErrors.name}>
                <input className="input" value={form.name} onChange={update('name')} autoComplete="name" />
              </Field>
            )}
            <Field label="Email" error={fieldErrors.email}>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={update('email')}
                autoComplete="email"
                inputMode="email"
              />
            </Field>
            <Field
              label="Password"
              error={fieldErrors.password}
              hint={isRegister ? 'At least 8 characters, with a letter and a number.' : undefined}
            >
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={update('password')}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </Field>

            {formError && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
                {formError}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
              {submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {isRegister ? 'Already have an account?' : 'New to Tandem?'}{' '}
            <Link
              to={isRegister ? '/login' : '/register'}
              className="font-semibold text-cobalt underline-offset-2 hover:underline"
            >
              {isRegister ? 'Log in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
