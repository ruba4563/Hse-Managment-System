import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

import CompanyPage from './pages/CompanyPage';
import DepartmentsPage from './pages/DepartmentsPage';
import ProjectsPage from './pages/ProjectsPage';
import SitesPage from './pages/SitesPage';
import EmployeesPage from './pages/EmployeesPage';
import UsersPage from './pages/UsersPage';

import AppLayout from './layouts/AppLayout';

import ProtectedRoute from './auth/ProtectedRoute';
import PermissionRoute from './auth/PermissionRoute';
import PermitsPage from './pages/PermitsPage';

// =====================================================
// APP ROUTES
// =====================================================

export default function App() {
  return (
    <Routes>

      {/* =============================================
          PUBLIC
      ============================================== */}

      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />

      {/* =============================================
          AUTHENTICATED AREA
      ============================================== */}

      <Route
        element={
          <ProtectedRoute />
        }
      >
        <Route
          element={
            <AppLayout />
          }
        >

          {/* DASHBOARD */}

          <Route
            index
            element={
              <DashboardPage />
            }
          />

          {/* COMPANY */}

          <Route
            element={
              <PermissionRoute
                permission="companies:read"
              />
            }
          >
            <Route
              path="companies"
              element={
                <CompanyPage />
              }
            />
          </Route>

          {/* DEPARTMENTS */}

          <Route
            element={
              <PermissionRoute
                permission="departments:read"
              />
            }
          >
            <Route
              path="departments"
              element={
                <DepartmentsPage />
              }
            />
          </Route>

          {/* PROJECTS */}

          <Route
            element={
              <PermissionRoute
                permission="projects:read"
              />
            }
          >
            <Route
              path="projects"
              element={
                <ProjectsPage />
              }
            />
          </Route>

          {/* SITES */}

          <Route
            element={
              <PermissionRoute
                permission="sites:read"
              />
            }
          >
            <Route
              path="sites"
              element={
                <SitesPage />
              }
            />
          </Route>

          {/* EMPLOYEES */}

          <Route
            element={
              <PermissionRoute
                permission="employees:read"
              />
            }
          >
            <Route
              path="employees"
              element={
                <EmployeesPage />
              }
            />
          </Route>

          {/* USERS */}

          <Route
            element={
              <PermissionRoute
                permission="users:read"
              />
            }
          >
            <Route
              path="users"
              element={
                <UsersPage />
              }
            />
          </Route>

        </Route>
      </Route>
      <Route
  element={
    <PermissionRoute
      permission="permits:read"
    />
  }
>
  <Route
    path="permits"
    element={
      <PermitsPage />
    }
  />
</Route>

      {/* =============================================
          FALLBACK
      ============================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}