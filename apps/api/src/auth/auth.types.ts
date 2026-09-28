import type {
  Request,
} from 'express';

export interface AuthenticatedCompany {
  id: string;
  name: string;
}

export interface AuthenticatedRole {
  id: string;
  name: string;
}

export interface AuthenticatedUser {
  id: string;

  username: string;

  email: string;

  company: AuthenticatedCompany;

  role: AuthenticatedRole;

  permissions: string[];
}

export interface AuthenticatedRequest
  extends Request {
  user: AuthenticatedUser;
}