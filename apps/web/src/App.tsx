import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import LoginPage from './pages/LoginPage';

import DashboardPage from './pages/DashboardPage';

import ProtectedRoute from './auth/ProtectedRoute';

export default function App() {
  return (
    <Routes>

      {/* Default route */}

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      {/* Public login page */}

      <Route
        path="/login"
        element={<LoginPage />}
      />

      {/* Protected dashboard */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Unknown routes */}

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

    </Routes>
  );
}