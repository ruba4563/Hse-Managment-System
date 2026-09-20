import {
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  Navigate,
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../auth/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();

  const {
    login,
    isAuthenticated,
  } = useAuth();

  const [username, setUsername] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  // Redirect users who are already logged in.
  if (isAuthenticated) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError('');

    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      await login(
        username.trim(),
        password,
      );

      // Remove the password from component state.
      setPassword('');

      navigate('/dashboard', {
        replace: true,
      });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(
          'An unexpected error occurred.',
        );
      }

      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* Left branding panel */}

      <section className="login-brand">
        <div className="brand-content">

          <div className="brand-logo">
            NH
          </div>

          <h1>
            Nature Horizon
          </h1>

          <p className="brand-subtitle">
            Environmental Consulting
          </p>

          <div className="brand-divider" />

          <h2>
            HSE Management System
          </h2>

          <p className="brand-description">
            A centralized platform for managing
            workplace health, safety, and
            environmental operations.
          </p>

        </div>

        <div className="brand-footer">
          © Nature Horizon
        </div>
      </section>

      {/* Right login panel */}

      <section className="login-form-section">

        <div className="login-card">

          <div className="mobile-logo">
            NH
          </div>

          <div className="login-heading">

            <span className="login-eyebrow">
              SECURE ACCESS
            </span>

            <h2>
              Welcome back
            </h2>

            <p>
              Sign in to your HSE account
              to continue.
            </p>

          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
          >

            {/* Error message */}

            {error && (
              <div
                className="error-message"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Username */}

            <div className="form-group">

              <label htmlFor="username">
                Username
              </label>

              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                disabled={isLoading}
                onChange={(event) => {
                  setUsername(
                    event.target.value,
                  );
                  setError('');
                }}
              />

            </div>

            {/* Password */}

            <div className="form-group">

              <label htmlFor="password">
                Password
              </label>

              <div className="password-wrapper">

                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  disabled={isLoading}
                  onChange={(event) => {
                    setPassword(
                      event.target.value,
                    );
                    setError('');
                  }}
                />

                <button
                  type="button"
                  className="password-toggle"
                  disabled={isLoading}
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  onClick={() => {
                    setShowPassword(
                      !showPassword,
                    );
                  }}
                >
                  {showPassword
                    ? 'Hide'
                    : 'Show'}
                </button>

              </div>

            </div>

            {/* Submit */}

            <button
              className="login-button"
              type="submit"
              disabled={isLoading}
            >
              {isLoading
                ? 'Signing in...'
                : 'Sign In'}
            </button>

          </form>

          <p className="login-help">
            Contact your HSE administrator
            if you cannot access your account.
          </p>

        </div>

        <div className="login-bottom">
          HSE Management System
        </div>

      </section>

    </div>
  );
}