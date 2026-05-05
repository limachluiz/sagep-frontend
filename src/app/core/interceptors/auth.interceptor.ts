import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

let refreshRequest$: Observable<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (shouldSkipAuth(req)) {
    return next(req);
  }

  const accessToken = authService.getAccessToken();

  if (accessToken) {
    debug('accessToken encontrado', accessToken);
    return next(addToken(req, accessToken)).pipe(
      catchError((error: HttpErrorResponse) => handleAuthError(error, req, next, authService, router)),
    );
  }

  if (authService.getRefreshToken()) {
    debug('sem accessToken; tentando refresh antes da requisicao protegida');
    return getRefreshRequest(authService).pipe(
      switchMap((newToken) =>
        next(addToken(req, newToken)).pipe(
          catchError((error: HttpErrorResponse) => handleRetryError(error, authService, router)),
        ),
      ),
      catchError((error) => {
        expireSession(authService, router, 'refresh falhou antes da requisicao');
        return throwError(() => error);
      }),
    );
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => handleAuthError(error, req, next, authService, router)),
  );
};

function handleAuthError(
  error: HttpErrorResponse,
  req: HttpRequest<unknown>,
  next: Parameters<HttpInterceptorFn>[1],
  authService: AuthService,
  router: Router,
) {
  if (error.status !== 401) {
    return throwError(() => error);
  }

  const refreshToken = authService.getRefreshToken();

  if (!refreshToken) {
    expireSession(authService, router, '401 sem refreshToken');
    return throwError(() => error);
  }

  debug('401 recebido; refresh iniciado', refreshToken);

  return getRefreshRequest(authService).pipe(
    switchMap((newToken) =>
      next(addToken(req, newToken)).pipe(
        catchError((retryError: HttpErrorResponse) => handleRetryError(retryError, authService, router)),
      ),
    ),
    catchError((refreshError) => {
      expireSession(authService, router, 'refresh invalido apos 401');
      return throwError(() => refreshError);
    }),
  );
}

function handleRetryError(error: HttpErrorResponse, authService: AuthService, router: Router) {
  if (error.status === 401) {
    expireSession(authService, router, '401 apos retry com token renovado');
  }

  return throwError(() => error);
}

function getRefreshRequest(authService: AuthService): Observable<string> {
  if (!refreshRequest$) {
    refreshRequest$ = authService.refreshToken().pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
      finalize(() => {
        refreshRequest$ = null;
      }),
    );
  }

  return refreshRequest$;
}

function expireSession(authService: AuthService, router: Router, reason: string): void {
  authService.clearSession(reason);
  void router.navigate(['/login'], {
    queryParams: { reason: 'expired' },
  });
}

function shouldSkipAuth(req: HttpRequest<unknown>): boolean {
  return ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some((path) =>
    req.url.includes(path),
  );
}

function addToken(req: HttpRequest<unknown>, token: string) {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function debug(message: string, token?: string | null): void {
  if (environment.production) {
    return;
  }

  const suffix = token ? ` (${maskToken(token)})` : '';
  console.debug(`[auth] ${message}${suffix}`);
}

function maskToken(token: string): string {
  return token.length <= 12 ? '***' : `${token.slice(0, 6)}...${token.slice(-4)}`;
}
