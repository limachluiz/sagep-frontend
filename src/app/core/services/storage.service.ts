import { Injectable } from '@angular/core';

import { User } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly accessTokenKey = 'sagep.access_token';
  private readonly refreshTokenKey = 'sagep.refresh_token';
  private readonly userKey = 'sagep.user';

  constructor() {
    this.clearLegacyLocalSession();
  }

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
      this.clearSession();
      return null;
    }
  }

  setSession(accessToken: string, refreshToken: string, user: User): void {
    this.setTokens(accessToken, refreshToken);
    this.setUser(user);
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    this.setItem(this.accessTokenKey, accessToken);
    this.setItem(this.refreshTokenKey, refreshToken);
  }

  private setUser(user: User): void {
    this.setItem(this.userKey, JSON.stringify(user));
  }

  clearSession(): void {
    this.removeItem(this.accessTokenKey);
    this.removeItem(this.refreshTokenKey);
    this.removeItem(this.userKey);
  }

  getItem(key: string): string | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    return sessionStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.removeItem(key);
  }

  private clearLegacyLocalSession(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
  }
}
