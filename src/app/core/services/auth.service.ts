import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../models/api-error.model';
import { AuthResponse, LoginRequest, User, UserRole } from '../models/auth.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly apiUrl = environment.apiUrl;
  private readonly accessTokenKey = 'sagep.access_token';
  private readonly refreshTokenKey = 'sagep.refresh_token';
  private readonly userKey = 'sagep.user';
  private readonly bootstrapping = signal(false);
  private readonly accessTokenSignal = signal<string | null>(this.storage.getItem(this.accessTokenKey));
  private readonly refreshTokenSignal = signal<string | null>(this.storage.getItem(this.refreshTokenKey));
  private readonly userSignal = signal<User | null>(this.restoreUser());

  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => !!this.accessTokenSignal() && !!this.userSignal());
  readonly isBootstrapping = computed(() => this.bootstrapping());

  login(payload: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, payload).pipe(
      tap((response) => this.setSession(response)),
      map((response) => response.user),
    );
  }

  logout(): Observable<void> {
    const refreshToken = this.getRefreshToken();
    const request$ = refreshToken
      ? this.http.post<{ message: string }>(`${this.apiUrl}/auth/logout`, { refreshToken })
      : of({ message: 'Sessao local encerrada.' });

    return request$.pipe(
      map(() => void 0),
      catchError(() => of(void 0)),
      tap(() => this.clearSession()),
    );
  }

  refreshToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => ({ message: 'Sessão expirada.' } satisfies ApiError));
    }

    return this.http
      .post<Omit<AuthResponse, 'user'>>(`${this.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((response) => {
          this.setAccessToken(response.accessToken);
          this.setRefreshToken(response.refreshToken);
        }),
        map((response) => response.accessToken),
      );
  }

  loadCurrentUser(force = false): Observable<User | null> {
    if (!this.getAccessToken()) {
      this.clearSession();
      return of(null);
    }

    if (!force && this.userSignal()) {
      return of(this.userSignal());
    }

    this.bootstrapping.set(true);

    return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => this.setUser(user)),
      map((user) => user),
      catchError((error) => {
        this.clearSession();
        return of(null);
      }),
      finalize(() => this.bootstrapping.set(false)),
    );
  }

  hydrateSession(): Observable<User | null> {
    return this.loadCurrentUser(true);
  }

  getAccessToken(): string | null {
    return this.accessTokenSignal();
  }

  getRefreshToken(): string | null {
    return this.refreshTokenSignal();
  }

  getCurrentUser(): User | null {
    return this.userSignal();
  }

  getUserRole(): UserRole | null {
    return this.userSignal()?.role ?? null;
  }

  getPermissions(): string[] {
    const user = this.userSignal();
    return user?.access?.permissions ?? user?.permissions ?? [];
  }

  hasAnyPermission(requiredPermissions: string[] = []): boolean {
    if (!requiredPermissions.length) {
      return true;
    }

    const permissions = new Set(this.getPermissions());
    return requiredPermissions.some((permission) => permissions.has(permission));
  }

  private setSession(response: AuthResponse): void {
    this.setAccessToken(response.accessToken);
    this.setRefreshToken(response.refreshToken);
    this.setUser(response.user);
  }

  private setAccessToken(token: string): void {
    this.accessTokenSignal.set(token);
    this.storage.setItem(this.accessTokenKey, token);
  }

  private setRefreshToken(token: string): void {
    this.refreshTokenSignal.set(token);
    this.storage.setItem(this.refreshTokenKey, token);
  }

  private setUser(user: User): void {
    const normalizedUser: User = {
      ...user,
      permissions: user.access?.permissions ?? user.permissions ?? [],
    };

    this.userSignal.set(normalizedUser);
    this.storage.setItem(this.userKey, JSON.stringify(normalizedUser));
  }

  private clearSession(): void {
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.userSignal.set(null);
    this.storage.removeItem(this.accessTokenKey);
    this.storage.removeItem(this.refreshTokenKey);
    this.storage.removeItem(this.userKey);
  }

  private restoreUser(): User | null {
    const raw = this.storage.getItem(this.userKey);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      this.storage.removeItem(this.userKey);
      return null;
    }
  }
}
