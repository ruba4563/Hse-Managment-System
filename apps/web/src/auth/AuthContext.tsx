import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type {
  ReactNode,
} from 'react';

import {
  API_URL,
  getErrorMessage,
} from '../lib/api';

// =====================================================
// TYPES
// =====================================================

export interface AuthCompany {
  id: string;
  name: string;
}

export interface AuthRole {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;

  company: AuthCompany;

  role: AuthRole;

  permissions: string[];
}

interface AuthContextValue {
  token: string | null;

  user: AuthUser | null;

  isAuthenticated: boolean;

  login: (
    username: string,
    password: string,
  ) => Promise<void>;

  logout: () => void;

  refreshUser: () => Promise<void>;

  hasPermission: (
    permission: string,
  ) => boolean;

  hasAnyPermission: (
    permissions: string[],
  ) => boolean;
}

// =====================================================
// CONTEXT
// =====================================================

const AuthContext =
  createContext<AuthContextValue | undefined>(
    undefined,
  );

// =====================================================
// HELPERS
// =====================================================

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function readString(
  object: Record<string, unknown>,
  key: string,
): string | null {
  const value =
    object[key];

  return typeof value === 'string'
    ? value
    : null;
}

// =====================================================
// TOKEN EXTRACTION
// =====================================================

function extractAccessToken(
  responseData: unknown,
): string | null {
  if (!isRecord(responseData)) {
    return null;
  }

  // Support:
  // {
  //   "accessToken": "..."
  // }

  const accessToken =
    readString(
      responseData,
      'accessToken',
    );

  if (accessToken) {
    return accessToken;
  }

  // Support:
  // {
  //   "access_token": "..."
  // }

  const accessTokenSnakeCase =
    readString(
      responseData,
      'access_token',
    );

  if (accessTokenSnakeCase) {
    return accessTokenSnakeCase;
  }

  // Support:
  // {
  //   "token": "..."
  // }

  const token =
    readString(
      responseData,
      'token',
    );

  if (token) {
    return token;
  }

  // Support:
  // {
  //   "jwt": "..."
  // }

  const jwt =
    readString(
      responseData,
      'jwt',
    );

  if (jwt) {
    return jwt;
  }

  // Support nested responses:
  //
  // {
  //   "data": {
  //     "accessToken": "..."
  //   }
  // }
  //
  // or
  //
  // {
  //   "data": {
  //     "access_token": "..."
  //   }
  // }

  const nestedData =
    responseData.data;

  if (isRecord(nestedData)) {
    const nestedAccessToken =
      readString(
        nestedData,
        'accessToken',
      );

    if (nestedAccessToken) {
      return nestedAccessToken;
    }

    const nestedAccessTokenSnakeCase =
      readString(
        nestedData,
        'access_token',
      );

    if (
      nestedAccessTokenSnakeCase
    ) {
      return nestedAccessTokenSnakeCase;
    }

    const nestedToken =
      readString(
        nestedData,
        'token',
      );

    if (nestedToken) {
      return nestedToken;
    }
  }

  return null;
}

// =====================================================
// PROVIDER
// =====================================================

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Token stays in memory intentionally.
  //
  // Refreshing the browser signs the user out,
  // matching the security approach we used earlier.

  const [
    token,
    setToken,
  ] =
    useState<string | null>(
      null,
    );

  const [
    user,
    setUser,
  ] =
    useState<AuthUser | null>(
      null,
    );

  // ===================================================
  // LOAD CURRENT USER
  // ===================================================

  const loadCurrentUser =
    useCallback(
      async (
        currentToken: string,
      ): Promise<AuthUser> => {
        const response =
          await fetch(
            `${API_URL}/auth/me`,
            {
              method: 'GET',

              headers: {
                Authorization:
                  `Bearer ${currentToken}`,
              },
            },
          );

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
            ),
          );
        }

        const data: unknown =
          await response.json();

        if (!isRecord(data)) {
          throw new Error(
            'Invalid user response from server.',
          );
        }

        return data as unknown as AuthUser;
      },
      [],
    );

  // ===================================================
  // LOGIN
  // ===================================================

  const login =
    useCallback(
      async (
        username: string,
        password: string,
      ): Promise<void> => {
        const response =
          await fetch(
            `${API_URL}/auth/login`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  username:
                    username.trim(),

                  password,
                }),
            },
          );

        // ---------------------------------------------
        // LOGIN FAILURE
        // ---------------------------------------------

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
            ),
          );
        }

        // ---------------------------------------------
        // READ LOGIN RESPONSE
        // ---------------------------------------------

        const responseData: unknown =
          await response.json();

        // ---------------------------------------------
        // GET JWT
        // ---------------------------------------------

        const newToken =
          extractAccessToken(
            responseData,
          );

        if (!newToken) {
          throw new Error(
            'Login succeeded, but the server response did not contain a recognized access token.',
          );
        }

        // ---------------------------------------------
        // GET CURRENT ROLE + PERMISSIONS
        // ---------------------------------------------

        const currentUser =
          await loadCurrentUser(
            newToken,
          );

        // Only mark authentication successful after
        // /auth/me also succeeds.

        setToken(
          newToken,
        );

        setUser(
          currentUser,
        );
      },
      [
        loadCurrentUser,
      ],
    );

  // ===================================================
  // LOGOUT
  // ===================================================

  const logout =
    useCallback(
      () => {
        setToken(
          null,
        );

        setUser(
          null,
        );
      },
      [],
    );

  // ===================================================
  // REFRESH USER
  // ===================================================

  const refreshUser =
    useCallback(
      async (): Promise<void> => {
        if (!token) {
          return;
        }

        try {
          const currentUser =
            await loadCurrentUser(
              token,
            );

          setUser(
            currentUser,
          );
        } catch {
          setToken(
            null,
          );

          setUser(
            null,
          );
        }
      },
      [
        token,
        loadCurrentUser,
      ],
    );

  // ===================================================
  // PERMISSION CHECK
  // ===================================================

  const hasPermission =
    useCallback(
      (
        permission: string,
      ): boolean => {
        if (!user) {
          return false;
        }

        return (
          user.permissions?.includes(
            permission,
          ) ?? false
        );
      },
      [
        user,
      ],
    );

  // ===================================================
  // ANY PERMISSION CHECK
  // ===================================================

  const hasAnyPermission =
    useCallback(
      (
        permissions: string[],
      ): boolean => {
        if (!user) {
          return false;
        }

        return permissions.some(
          permission =>
            user.permissions?.includes(
              permission,
            ) ?? false,
        );
      },
      [
        user,
      ],
    );

  // ===================================================
  // CONTEXT VALUE
  // ===================================================

  const value =
    useMemo<AuthContextValue>(
      () => ({
        token,

        user,

        isAuthenticated:
          Boolean(
            token &&
            user,
          ),

        login,

        logout,

        refreshUser,

        hasPermission,

        hasAnyPermission,
      }),
      [
        token,
        user,
        login,
        logout,
        refreshUser,
        hasPermission,
        hasAnyPermission,
      ],
    );

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

// =====================================================
// HOOK
// =====================================================
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth():
  AuthContextValue {
  const context =
    useContext(
      AuthContext,
    );

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    );
  }

  return context;
}