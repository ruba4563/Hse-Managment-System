import { useAuth } from '../auth/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <main className="dashboard-content">

      {/* WELCOME BANNER */}

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

      {/* INFORMATION CARDS */}

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

      {/* DEVELOPMENT STATUS */}

      <section className="system-notice">

        <h3>
          System Status
        </h3>

        <p>
          Authentication and authorization
          are operational.
        </p>

        <p>
          Company and Department Management
          are being implemented.
        </p>

      </section>

    </main>
  );
}