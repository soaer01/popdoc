import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAuthError, login, signup } from './authSlice.js';
import './AuthForm.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthForm({ mode }) {
  const isSignup = mode === 'signup';
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, error } = useSelector((s) => s.auth);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    dispatch(clearAuthError());
  }, [mode, dispatch]);

  function update(e) {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  }

  function validate() {
    const next = {};
    if (isSignup && values.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!EMAIL.test(values.email)) next.email = 'Enter an email like name@university.edu.';
    if (values.password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const action = await dispatch(isSignup ? signup(values) : login(values));
    if (!action.error) navigate(location.state?.from || '/docs', { replace: true });
  }

  return (
    <main className="auth">
      <form className="auth-card sheet" onSubmit={onSubmit} noValidate>
        <h1>{isSignup ? 'Create your account' : 'Log in'}</h1>
        {isSignup && (
          <label className="field">
            Full name
            <input name="name" value={values.name} onChange={update} autoComplete="name" />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
        )}
        <label className="field">
          Email
          <input name="email" type="email" value={values.email} onChange={update} autoComplete="email" />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label className="field">
          Password
          <input
            name="password"
            type="password"
            value={values.password}
            onChange={update}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-primary auth-submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Working…' : isSignup ? 'Create account' : 'Log in'}
        </button>

        <p className="small muted">
          {isSignup ? (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          ) : (
            <>
              New to PopDoc? <Link to="/signup">Create an account</Link>
            </>
          )}
        </p>
        {!isSignup && (
          <p className="small muted auth-demo">
            Demo: <code>afzal@popdoc.dev</code> with any 8-character password.
          </p>
        )}
      </form>
    </main>
  );
}
