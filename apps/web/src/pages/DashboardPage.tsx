import {
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../auth/AuthContext';

export default function DashboardPage() {
  const navigate = useNavigate();

  const {
    user,
    logout,
  } = useAuth();

  const handleLogout = () => {
    logout();

    navigate('/login', {
      replace: true,
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-layout">

      {/* Sidebar */}

      <aside className="dashboard-sidebar">

        <div className="sidebar-brand">

          <div className="sidebar-logo">
            NH
          </div>

          <div>
            <h2>Nature Horizon</h2>
            <p>HSE Management</p>
          </div>

        </div>

        <nav
          className="sidebar-navigation"
          aria-label="Main navigation"
        >
          <a
            href="/dashboard"
            className="sidebar-link active"
          >
            Dashboard
          </a>
        </nav>

        <div className="sidebar-bottom">
          HSE Management System
        </div>

      </aside>

      {/* Main content */}

      <div className="dashboard-main">

        <header className="dashboard-header">

          <div>
            <h1>Dashboard</h1>
            <p>HSE Management Overview</p>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>

        </header>

        <main className="dashboard-content">

          <div className="welcome-banner">

            <span className="welcome-label">
              AUTHENTICATED SESSION
            </span>

            <h2>
              Welcome, {user.username}
            </h2>

            <p>
              You have successfully signed in
              to the HSE Management System.
            </p>

          </div>

          <div className="dashboard-grid">

            <div className="info-card">

              <span className="info-label">
                Username
              </span>

              <strong>
                {user.username}
              </strong>

            </div>

            <div className="info-card">

              <span className="info-label">
                Role
              </span>

              <strong>
                {user.role.name}
              </strong>

            </div>

            <div className="info-card">

              <span className="info-label">
                Company
              </span>

              <strong>
                {user.company.name}
              </strong>

            </div>

          </div>

          <section className="system-notice">

            <h3>
              System status
            </h3>

            <p>
              Your authenticated session
              is active.
            </p>

            <p>
              Operational HSE modules and
              dashboard statistics will be
              implemented in the next stages.
            </p>

          </section>

        </main>

      </div>

    </div>
  );
}