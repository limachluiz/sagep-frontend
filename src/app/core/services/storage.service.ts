import { Injectable } from '@angular/core';

import { User } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly accessTokenKey = 'sagep.access_token';
  private readonly refreshTokenKey = 'sagep.refresh_token';
  private readonly userKey = 'sagep.user';

  getAccessToken(): string | null {
    return this.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return this.getItem(this.refreshTokenKey);
  }

  getUser(): User | null {
    const raw = this.getItem(this.userKey);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      this.removeItem(this.userKey);
      return null;
    }
  }

  setTokens(accessToken: string, refreshToken?: string | null): void {
    this.setItem(this.accessTokenKey, accessToken);

    if (refreshToken) {
      this.setItem(this.refreshTokenKey, refreshToken);
    }
  }

  setUser(user: User): void {
    this.setItem(this.userKey, JSON.stringify(user));
  }

  clearSession(): void {
    this.removeItem(this.accessTokenKey);
    this.removeItem(this.refreshTokenKey);
    this.removeItem(this.userKey);
  }

  getItem(key: string): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(key);
  }
}
