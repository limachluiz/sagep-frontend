import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { UserRole } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const permissions = (route.data?.['permissions'] as string[] | undefined) ?? [];
  const roles = (route.data?.['roles'] as UserRole[] | undefined) ?? [];
  const permissionRoles = (route.data?.['permissionRoles'] as UserRole[] | undefined) ?? [];
  const deniedRoles = (route.data?.['deniedRoles'] as UserRole[] | undefined) ?? [];
  const role = authService.getUserRole();

  if (!role) {
    return router.createUrlTree(['/access-denied']);
  }

  if (role === 'ADMIN') {
    return true;
  }

  if (deniedRoles.includes(role)) {
    return router.createUrlTree(['/access-denied']);
  }

  const hasFinePermission = permissions.length > 0 && authService.hasAnyPermission(permissions);

  if (hasFinePermission && (!permissionRoles.length || permissionRoles.includes(role))) {
    return true;
  }

  if (roles.includes(role)) {
    return true;
  }

  return router.createUrlTree(['/access-denied']);
};
