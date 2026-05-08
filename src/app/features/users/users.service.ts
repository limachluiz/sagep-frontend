import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AppUser, UserListResponse } from './user.model';

@Injectable({ providedIn: 'root' })
export class UsersFeatureService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  list() {
    return this.http.get<UserListResponse | AppUser[]>(`${this.apiUrl}/users`);
  }
}
