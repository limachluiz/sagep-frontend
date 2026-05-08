import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { RootRedirectComponent } from './shared/components/root-redirect.component';

export const routes: Routes = [
  {
    path: '',
    component: RootRedirectComponent,
  },
  {
    path: '',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then((m) => m.LoginComponent),
      },
    ],
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [permissionGuard],
        data: { permissions: ['dashboard.view_operational', 'dashboard.view_executive', 'dashboard.financial_view'] },
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
      },
      {
        path: 'projects',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/projects/projects-page.component').then((m) => m.ProjectsPageComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/projects/project-detail-page.component').then((m) => m.ProjectDetailPageComponent),
          },
        ],
      },
      {
        path: 'estimates',
        children: [
          {
            path: 'new',
            loadComponent: () =>
              import('./features/estimates/estimate-create-page.component').then((m) => m.EstimateCreatePageComponent),
          },
          {
            path: '',
            loadComponent: () =>
              import('./features/estimates/estimates-page.component').then((m) => m.EstimatesPageComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/estimates/estimate-detail-page.component').then((m) => m.EstimateDetailPageComponent),
          },
        ],
      },
      {
        path: 'diex',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/diex/diex-page.component').then((m) => m.DiexPageComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/diex/diex-detail-page.component').then((m) => m.DiexDetailPageComponent),
          },
        ],
      },
      {
        path: 'service-orders',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/service-orders/service-orders-page.component').then((m) => m.ServiceOrdersPageComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/service-orders/service-order-detail-page.component').then((m) => m.ServiceOrderDetailPageComponent),
          },
        ],
      },
      {
        path: 'atas',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/atas/atas-page.component').then((m) => m.AtasPageComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/atas/ata-detail-page.component').then((m) => m.AtaDetailPageComponent),
          },
        ],
      },
      {
        path: 'itens-ata',
        loadComponent: () =>
          import('./features/ata-items/ata-items-page.component').then((m) => m.AtaItemsPageComponent),
      },
      {
        path: 'saldo-ata',
        loadComponent: () =>
          import('./features/ata-balance/ata-balance-page.component').then((m) => m.AtaBalancePageComponent),
      },
      {
        path: 'relatorios',
        loadComponent: () =>
          import('./features/reports/reports-page.component').then((m) => m.ReportsPageComponent),
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./features/audit/audit-page.component').then((m) => m.AuditPageComponent),
      },
      {
        path: 'users',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/users/users-page.component').then((m) => m.UsersPageComponent),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/users/user-detail-page.component').then((m) => m.UserDetailPageComponent),
          },
        ],
      },
      {
        path: 'oms',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/military-organizations/military-organizations-page.component').then(
                (m) => m.MilitaryOrganizationsPageComponent,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/military-organizations/military-organization-detail-page.component').then(
                (m) => m.MilitaryOrganizationDetailPageComponent,
              ),
          },
        ],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
