import {
  Navigate,
  Outlet,
} from 'react-router-dom';

import {
  useAuth,
} from './AuthContext';

interface PermissionRouteProps {
  permission: string;
}

export default function PermissionRoute({
  permission,
}: PermissionRouteProps) {
  const {
    isAuthenticated,
    hasPermission,
  } =
    useAuth();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (
    !hasPermission(
      permission,
    )
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return <Outlet />;
}