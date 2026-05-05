import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../models/api-error.model';
import { AuthResponse, LoginRequest, User, UserRole } from '../models/auth.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly apiUrl = environment.apiUrl;
  private readonly bootstrapping = signal(false);
  private readonly accessTokenSignal = signal<string | null>(this.storage.getAccessToken());
  private readonly refreshTokenSignal = signal<string | null>(this.storage.getRefreshToken());
  private readonly userSignal = signal<User | null>(this.storage.getUser());

  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => !!this.accessTokenSignal() || !!this.refreshTokenSignal());
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
      tap(() => this.clearSession('logout')),
    );
  }

  refreshToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.debug('refresh sem refreshToken salvo');
      return throwError(() => ({ message: 'Sessao expirada.' } satisfies ApiError));
    }

    this.debug('refresh iniciado', refreshToken);

    return this.http
      .post<Partial<AuthResponse> & { accessToken: string; refreshToken?: string }>(
        `${this.apiUrl}/auth/refresh`,
        { refreshToken },
      )
      .pipe(
        tap((response) => {
          this.setAccessToken(response.accessToken);

          if (response.refreshToken) {
            this.setRefreshToken(response.refreshToken);
          }

          if (response.user) {
            this.setUser(response.user);
          }

          this.debug('refresh sucesso', response.accessToken);
        }),
        map((response) => response.accessToken),
        catchError((error) => {
          this.debug('refresh falhou');
          return throwError(() => error);
        }),
      );
  }

  loadCurrentUser(force = false): Observable<User | null> {
    if (!this.getAccessToken()) {
      if (!this.getRefreshToken()) {
        this.clearSession('sem tokens para carregar usuario');
        return of(null);
      }

      return this.refreshToken().pipe(
        switchMap(() => this.loadCurrentUser(force)),
        catchError(() => {
          this.clearSession('refresh invalido ao carregar usuario');
          return of(null);
        }),
      );
    }

    if (!force && this.userSignal()) {
      return of(this.userSignal());
    }

    this.bootstrapping.set(true);

    return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => this.setUser(user)),
      map((user) => user),
      catchError((error) => {
        if (error?.status === 401) {
          this.clearSession('auth/me retornou 401');
        }

        return of(null);
      }),
      finalize(() => this.bootstrapping.set(false)),
    );
  }

  hydrateSession(): Observable<User | null> {
    return this.loadCurrentUser(true);
  }

  ensureAuthenticated(): Observable<boolean> {
    if (this.getAccessToken()) {
      if (this.getCurrentUser()) {
        return of(true);
      }

      return this.loadCurrentUser().pipe(
        map(() => !!this.getAccessToken()),
        catchError(() => of(false)),
      );
    }

    if (!this.getRefreshToken()) {
      return of(false);
    }

    return this.refreshToken().pipe(
      switchMap(() => this.loadCurrentUser(true)),
      map(() => !!this.getAccessToken()),
      catchError(() => {
        this.clearSession('refresh invalido no guard');
        return of(false);
      }),
    );
  }

  getAccessToken(): string | null {
    return this.accessTokenSignal();
  }

  getRefreshToken(): string | null {
    return this.refreshTokenSignal();
  }

  hasRefreshToken(): boolean {
    return !!this.refreshTokenSignal();
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

  clearSession(reason = 'limpeza explicita'): void {
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.userSignal.set(null);
    this.storage.clearSession();
    this.debug(`sessao limpa: ${reason}`);
  }

  private setSession(response: AuthResponse): void {
    this.storage.setTokens(response.accessToken, response.refreshToken);
    this.accessTokenSignal.set(response.accessToken);
    this.refreshTokenSignal.set(response.refreshToken);
    this.setUser(response.user);
    this.debug('login salvou sessao', response.accessToken);
  }

  private setAccessToken(token: string): void {
    this.accessTokenSignal.set(token);
    this.storage.setTokens(token, this.getRefreshToken());
  }

  private setRefreshToken(token: string): void {
    this.refreshTokenSignal.set(token);

    const accessToken = this.getAccessToken();
    if (accessToken) {
      this.storage.setTokens(accessToken, token);
    }
  }

  private setUser(user: User): void {
    const normalizedUser: User = {
      ...user,
      permissions: user.access?.permissions ?? user.permissions ?? [],
    };

    this.userSignal.set(normalizedUser);
    this.storage.setUser(normalizedUser);
  }

  private debug(message: string, token?: string | null): void {
    if (environment.production) {
      return;
    }

    const suffix = token ? ` (${this.maskToken(token)})` : '';
    console.debug(`[auth] ${message}${suffix}`);
  }

  private maskToken(token: string): string {
    return token.length <= 12 ? '***' : `${token.slice(0, 6)}...${token.slice(-4)}`;
  }
}
