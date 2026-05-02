import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const permissions = (route.data?.['permissions'] as string[] | undefined) ?? [];

  if (authService.hasAnyPermission(permissions)) {
    return true;
  }

  return router.createUrlTree(['/projects']);
};
