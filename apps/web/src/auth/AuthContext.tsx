/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/set-state-in-effect */
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import type {
  ReactNode,
} from 'react';

import {
  API_URL,
  getErrorMessage,
} from '../lib/api';

// ---------------------------------------
// Types
// ---------------------------------------

export interface AuthUser {
  id: string;
  username: string;
  email: string;

  role: {
    id: string;
    name: string;
  };

  company: {
    id: string;
    name: string;
  };
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ProfileResponse {
  user: AuthUser;
}

interface Session {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
}

// ---------------------------------------
// Create context
// ---------------------------------------

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined,
  );

// ---------------------------------------
// Provider
// ---------------------------------------

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);

  const logout = () => {
    setSession(null);
  };

  // Automatically clear an expired session.
  useEffect(() => {
    if (!session) {
      return;
    }

    const remainingTime =
      session.expiresAt - Date.now();

    if (remainingTime <= 0) {
      setSession(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      setSession(null);
    }, remainingTime);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [session]);

  // -------------------------------------
  // Login
  // -------------------------------------

  const login = async (
    username: string,
    password: string,
  ): Promise<void> => {
    // Remove any previous session.
    setSession(null);

    let response: Response;

    try {
      response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            username,
            password,
          }),
        },
      );
    } catch {
      throw new Error(
        'Cannot connect to the server. Check that the backend is running.',
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          'Invalid username or password.',
        );
      }

      throw new Error(
        await getErrorMessage(response),
      );
    }

    const loginData =
      (await response.json()) as LoginResponse;

    if (
      !loginData.access_token ||
      !Number.isFinite(loginData.expires_in) ||
      loginData.expires_in <= 0
    ) {
      throw new Error(
        'The server returned an invalid login response.',
      );
    }

    const expiresAt =
      Date.now() +
      loginData.expires_in * 1000;

    // Verify the new token against /auth/me.
    let profileResponse: Response;

    try {
      profileResponse = await fetch(
        `${API_URL}/auth/me`,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Bearer ${loginData.access_token}`,
          },
        },
      );
    } catch {
      throw new Error(
        'Login succeeded, but the user profile could not be loaded.',
      );
    }

    if (!profileResponse.ok) {
      throw new Error(
        'Unable to verify your session. Please try again.',
      );
    }

    const profileData =
      (await profileResponse.json()) as ProfileResponse;

    if (!profileData.user?.id) {
      throw new Error(
        'Invalid user profile returned by the server.',
      );
    }

    // Save session in React memory.
    setSession({
      token: loginData.access_token,
      user: profileData.user,
      expiresAt,
    });
  };

  const value: AuthContextType = {
    user: session?.user ?? null,
    token: session?.token ?? null,
    isAuthenticated:
      Boolean(session) &&
      (session?.expiresAt ?? 0) > Date.now(),
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------
// Custom authentication hook
// ---------------------------------------

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    );
  }

  return context;
}