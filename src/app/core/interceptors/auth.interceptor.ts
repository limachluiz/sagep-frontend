import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

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
      catchError((error: HttpErrorResponse) =>
        handleAuthError(error, req, next, authService, router),
      ),
    );
  }

  if (authService.getRefreshToken()) {
    debug('sem accessToken; tentando refresh antes da requisicao protegida');
    return authService.refreshToken().pipe(
      catchError((error) => {
        navigateToExpiredLogin(router);
        return throwError(() => error);
      }),
      switchMap((newToken) => next(addToken(req, newToken))),
    );
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) =>
      handleAuthError(error, req, next, authService, router),
    ),
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
    authService.clearSession('401 sem refreshToken');
    navigateToExpiredLogin(router);
    return throwError(() => error);
  }

  debug('401 recebido; refresh centralizado iniciado', refreshToken);

  return authService.refreshToken().pipe(
    catchError((refreshError) => {
      navigateToExpiredLogin(router);
      return throwError(() => refreshError);
    }),
    switchMap((newToken) => next(addToken(req, newToken))),
  );
}

function navigateToExpiredLogin(router: Router): void {
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
