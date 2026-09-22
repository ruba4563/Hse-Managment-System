import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuth();

  const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/companies': 'Company Management',
    '/departments': 'Department Management',
    '/projects': 'Project Management',
    '/sites': 'Site Management',
    '/employees': 'Employee Management',
  };

  const pageTitle =
    pageTitles[location.pathname] ?? 'HSE Management';

  const handleLogout = () => {
    logout();

    navigate('/login', {
      replace: true,
    });
  };

  return (
    <div className="dashboard-layout">

      {/* SIDEBAR */}

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

        {/* NAVIGATION */}

        <nav
          className="sidebar-navigation"
          aria-label="Main navigation"
        >

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            Dashboard
          </NavLink>

          {user?.role.name === 'SUPER_ADMIN' && (
            <>
              <NavLink
                to="/companies"
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                Company Management
              </NavLink>

              <NavLink
                to="/departments"
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                Department Management
              </NavLink>
            </>
          )}
<NavLink
  to="/projects"
  className={({ isActive }) =>
    `sidebar-link ${isActive ? 'active' : ''}`
  }
>
  Project Management
</NavLink>
<NavLink
  to="/sites"
  className={({ isActive }) =>
    `sidebar-link ${isActive ? 'active' : ''}`
  }
>
  Site Management
</NavLink>

<NavLink
  to="/employees"
  className={({ isActive }) =>
    `sidebar-link ${isActive ? 'active' : ''}`
  }
>
  Employee Management
</NavLink>
        </nav>

        <div className="sidebar-bottom">
          HSE Management System
        </div>

      </aside>

      {/* RIGHT SIDE */}

      <div className="dashboard-main">

        {/* HEADER */}

        <header className="dashboard-header">

          <div>
            <h1>{pageTitle}</h1>

            <p>
              Health, Safety and Environmental
              Management
            </p>
          </div>

          <div className="header-actions">

            <div className="header-user">
              <strong>
                {user?.username}
              </strong>

              <span>
                {user?.role.name}
              </span>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>

          </div>

        </header>

        {/* SELECTED PAGE */}

        <div className="app-page-content">

          <Outlet />

        </div>

      </div>

    </div>
  );
}