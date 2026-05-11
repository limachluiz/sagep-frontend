import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  AppUser,
  UserCreatePayload,
  UserListResponse,
  UserRoleUpdatePayload,
  UserStatusUpdatePayload,
  UserUpdatePayload,
} from './user.model';

@Injectable({ providedIn: 'root' })
export class UsersFeatureService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<UserListResponse | AppUser[]>(`${this.apiUrl}/users`);
  }

  create(payload: UserCreatePayload) {
    return this.http.post<AppUser>(`${this.apiUrl}/users`, payload);
  }

  getById(id: string) {
    return this.http.get<AppUser>(`${this.apiUrl}/users/${encodeURIComponent(id)}`);
  }

  update(id: string, payload: UserUpdatePayload) {
    return this.http.patch<AppUser>(`${this.apiUrl}/users/${encodeURIComponent(id)}`, payload);
  }

  updateRole(id: string, payload: UserRoleUpdatePayload) {
    return this.http.patch<AppUser>(`${this.apiUrl}/users/${encodeURIComponent(id)}/role`, payload);
  }

  updateStatus(id: string, payload: UserStatusUpdatePayload) {
    return this.http.patch<AppUser>(`${this.apiUrl}/users/${encodeURIComponent(id)}/status`, payload);
  }
}
