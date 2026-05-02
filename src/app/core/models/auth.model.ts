export type UserRole = 'ADMIN' | 'GESTOR' | 'PROJETISTA' | 'CONSULTA';

export interface AccessProfile {
  role: UserRole;
  permissions: string[];
  isAdmin: boolean;
}

export interface User {
  id: string;
  userCode?: number;
  name: string;
  email: string;
  role: UserRole;
  rank?: string | null;
  cpf?: string | null;
  active?: boolean;
  createdAt?: string;
  permissions: string[];
  access?: AccessProfile;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
