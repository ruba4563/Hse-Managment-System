import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { useAuth } from './auth/AuthContext';

import LoginPage from './pages/LoginPage';

import DashboardPage from './pages/DashboardPage';

import CompanyPage from './pages/CompanyPage';

import DepartmentsPage from './pages/DepartmentsPage';

import ProtectedRoute from './auth/ProtectedRoute';

import AppLayout from './layouts/AppLayout';

function AdminRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (user?.role.name !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>

      {/* PUBLIC LOGIN */}

      <Route
        path="/login"
        element={<LoginPage />}
      />

      {/* PROTECTED APPLICATION */}

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >

        <Route
          path="/"
          element={
            <Navigate to="/dashboard" replace />
          }
        />

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="/companies"
          element={
            <AdminRoute>
              <CompanyPage />
            </AdminRoute>
          }
        />

        <Route
          path="/departments"
          element={
            <AdminRoute>
              <DepartmentsPage />
            </AdminRoute>
          }
        />

      </Route>

      {/* UNKNOWN ROUTES */}

      <Route
        path="*"
        element={
          <Navigate to="/dashboard" replace />
        }
      />

    </Routes>
  );
}