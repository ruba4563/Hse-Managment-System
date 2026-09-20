import type { Request } from 'express';

// Expected information inside the signed JWT
export interface JwtPayload {
  sub: string;
  username: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

// Safe information exposed to controllers
export interface AuthenticatedUser {
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

// Express request after authentication
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}