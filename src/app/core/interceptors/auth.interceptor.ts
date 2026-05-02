import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const skipAuth = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
  const token = authService.getAccessToken();
  const request = !skipAuth && token ? addToken(req, token) : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || skipAuth || !authService.getRefreshToken() || isRefreshing) {
        if (error.status === 401 && !skipAuth && isRefreshing) {
          authService.logout().subscribe();
          void router.navigate(['/login']);
        }

        return throwError(() => error);
      }

      isRefreshing = true;

      return authService.refreshToken().pipe(
        switchMap((newToken) => next(addToken(req, newToken))),
        catchError((refreshError) => {
          authService.logout().subscribe();
          void router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
        finalize(() => {
          isRefreshing = false;
        }),
      );
    }),
  );
};

function addToken(req: HttpRequest<unknown>, token: string) {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
