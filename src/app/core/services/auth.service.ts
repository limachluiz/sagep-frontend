import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

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
  private refreshInFlight$: Observable<string> | null = null;

  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = computed(
    () => !!this.accessTokenSignal() || !!this.refreshTokenSignal(),
  );
  readonly isBootstrapping = computed(() => this.bootstrapping());

  constructor() {
    const hasIncompleteSession =
      (!!this.accessTokenSignal() || !!this.refreshTokenSignal() || !!this.userSignal()) &&
      (!this.accessTokenSignal() || !this.refreshTokenSignal() || !this.userSignal());

    if (hasIncompleteSession) {
      this.clearSession('sessao local incompleta');
    }
  }

  login(payload: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, payload).pipe(
      tap((response) =>
        this.setSession(response.accessToken, response.refreshToken, response.user),
      ),
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
    if (this.refreshInFlight$) {
      this.debug('refresh em andamento reaproveitado');
      return this.refreshInFlight$;
    }

    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.debug('refresh sem refreshToken salvo');
      this.clearSession('refresh sem refreshToken salvo');
      return throwError(() => ({ message: 'Sessao expirada.' }) satisfies ApiError);
    }

    this.debug('refresh iniciado', refreshToken);

    this.refreshInFlight$ = this.http
      .post<
        Partial<AuthResponse> & { accessToken: string; refreshToken?: string }
      >(`${this.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((response) => {
          this.updateSessionAfterRefresh(
            response.accessToken,
            response.refreshToken ?? refreshToken,
            response.user,
          );
          this.debug('refresh sucesso', response.accessToken);
        }),
        map((response) => response.accessToken),
        catchError((error) => {
          this.debug('refresh falhou');
          this.clearSession('refresh falhou');
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refreshInFlight$;
  }

  loadCurrentUser(force = false): Observable<User | null> {
    if (!this.getAccessToken()) {
      if (!this.getRefreshToken()) {
        this.clearSession('sem refreshToken para carregar usuario');
        return of(null);
      }

      return this.refreshToken().pipe(
        switchMap(() => this.loadCurrentUser(force)),
        catchError(() => of(null)),
      );
    }

    if (!force && this.userSignal()) {
      return of(this.userSignal());
    }

    this.bootstrapping.set(true);

    return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => this.setUser(user)),
      map((user) => user),
      catchError(() => of(null)),
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
      this.clearSession('sem refreshToken no guard');
      return of(false);
    }

    return this.refreshToken().pipe(
      switchMap(() => this.loadCurrentUser(true)),
      map(() => !!this.getAccessToken()),
      catchError(() => of(false)),
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
    this.refreshInFlight$ = null;
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.userSignal.set(null);
    this.storage.clearSession();
    this.debug(`sessao limpa: ${reason}`);
  }

  private setSession(accessToken: string, refreshToken: string, user: User): void {
    const normalizedUser = this.normalizeUser(user);

    this.accessTokenSignal.set(accessToken);
    this.refreshTokenSignal.set(refreshToken);
    this.userSignal.set(normalizedUser);
    this.storage.setSession(accessToken, refreshToken, normalizedUser);
    this.debug('sessao salva', accessToken);
  }

  private updateSessionAfterRefresh(accessToken: string, refreshToken: string, user?: User): void {
    const normalizedUser = user ? this.normalizeUser(user) : this.userSignal();

    this.accessTokenSignal.set(accessToken);
    this.refreshTokenSignal.set(refreshToken);

    if (normalizedUser) {
      this.userSignal.set(normalizedUser);
      this.storage.setSession(accessToken, refreshToken, normalizedUser);
      return;
    }

    this.storage.clearSession();
  }

  private setUser(user: User): void {
    const normalizedUser = this.normalizeUser(user);

    this.userSignal.set(normalizedUser);

    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();

    if (accessToken && refreshToken) {
      this.storage.setSession(accessToken, refreshToken, normalizedUser);
    }
  }

  private normalizeUser(user: User): User {
    return {
      ...user,
      permissions: user.access?.permissions ?? user.permissions ?? [],
    };
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
