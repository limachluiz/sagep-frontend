import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { RootRedirectComponent } from './shared/components/root-redirect.component';
import { UnderConstructionComponent } from './shared/components/under-construction.component';

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
        component: UnderConstructionComponent,
        data: { title: 'DIEx' },
      },
      {
        path: 'ordens-servico',
        component: UnderConstructionComponent,
        data: { title: 'Ordens de Serviço' },
      },
      {
        path: 'atas',
        component: UnderConstructionComponent,
        data: { title: 'ATAs' },
      },
      {
        path: 'itens-ata',
        component: UnderConstructionComponent,
        data: { title: 'Itens da ATA' },
      },
      {
        path: 'saldo-ata',
        component: UnderConstructionComponent,
        data: { title: 'Saldo da ATA' },
      },
      {
        path: 'relatorios',
        component: UnderConstructionComponent,
        data: { title: 'Relatórios' },
      },
      {
        path: 'auditoria',
        component: UnderConstructionComponent,
        data: { title: 'Auditoria' },
      },
      {
        path: 'usuarios',
        component: UnderConstructionComponent,
        data: { title: 'Usuários' },
      },
      {
        path: 'oms',
        component: UnderConstructionComponent,
        data: { title: 'OMs' },
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
