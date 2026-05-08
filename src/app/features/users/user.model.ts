import { UserRole } from '../../core/models/auth.model';

export interface UserAccessProfile {
  role?: UserRole | string | null;
  permissions?: string[] | null;
  isAdmin?: boolean | null;
}

export interface UserProfile {
  id?: string | null;
  name?: string | null;
  code?: string | number | null;
  permissions?: string[] | null;
}

export interface AppUser {
  id: string;
  userCode?: number | string | null;
  code?: number | string | null;
  name?: string | null;
  email?: string | null;
  role?: UserRole | string | null;
  profile?: UserProfile | string | null;
  permissions?: string[] | null;
  access?: UserAccessProfile | null;
  rank?: string | null;
  cpf?: string | null;
  active?: boolean | null;
  isActive?: boolean | null;
  status?: string | null;
  lastLoginAt?: string | null;
  lastLogin?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UserListResponse {
  items: AppUser[];
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
