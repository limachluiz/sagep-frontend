import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UserRole } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

interface MenuItem {
  label: string;
  path: string;
  icon: string;
  disabled?: boolean;
  permissions?: string[];
  permissionRoles?: UserRole[];
  roles?: UserRole[];
  deniedRoles?: UserRole[];
  hint?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const READ_ROLES: UserRole[] = ['ADMIN', 'GESTOR', 'PROJETISTA', 'CONSULTA'];

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" aria-label="Menu principal">
      @for (section of visibleSections(); track section.title) {
        <nav class="nav-group" aria-label="Navegação principal">
          <div class="nav-title">{{ section.title }}</div>
          @for (item of section.items; track item.path) {
            @if (item.disabled) {
              <div class="nav-item disabled" [title]="item.hint || item.label" aria-disabled="true">
                <span class="nav-icon">{{ item.icon }}</span>
                <span>{{ item.label }}</span>
                <small>Em construção</small>
              </div>
            } @else {
              <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
                <span class="nav-icon">{{ item.icon }}</span>
                <span>{{ item.label }}</span>
              </a>
            }
          }
        </nav>
      }
      <div class="sidebar-footer">
        <strong>SAGEP</strong>
        <span>Ambiente operacional integrado ao perfil autenticado.</span>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);

  private readonly menuSections: MenuSection[] = [
    {
      title: 'Comando',
      items: [
        {
          label: 'Dashboard',
          path: '/dashboard',
          icon: '⌘',
          roles: READ_ROLES,
          permissions: [
            'dashboard.view_operational',
            'dashboard.view_executive',
            'dashboard.financial_view',
          ],
        },
      ],
    },
    {
      title: 'Operação',
      items: [
        {
          label: 'Projetos',
          path: '/projects',
          icon: '▣',
          roles: READ_ROLES,
          permissions: ['projects.view_own', 'projects.view_all'],
        },
        {
          label: 'Estimativas',
          path: '/estimates',
          icon: '∑',
          roles: READ_ROLES,
          permissions: ['estimates.view', 'estimates.view_all'],
        },
      ],
    },
    {
      title: 'Documentos',
      items: [
        {
          label: 'DIEx Requisitório',
          path: '/diex',
          icon: '◇',
          roles: READ_ROLES,
          permissions: ['diex.view', 'diex.view_all'],
        },
        {
          label: 'Ordens de Serviço',
          path: '/service-orders',
          icon: '▤',
          roles: READ_ROLES,
          permissions: ['service_orders.view', 'service_orders.view_all'],
        },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        {
          label: 'ATAs',
          path: '/atas',
          icon: '◫',
          roles: READ_ROLES,
          permissions: ['atas.view', 'atas.view_all'],
        },
        {
          label: 'Itens da ATA',
          path: '/itens-ata',
          icon: '▦',
          roles: READ_ROLES,
          permissions: ['ata_items.view', 'ata_items.view_all'],
        },
        {
          label: 'Saldo da ATA',
          path: '/saldo-ata',
          icon: '▥',
          roles: READ_ROLES,
          permissions: ['ata_balance.view', 'ata_balance.view_all'],
        },
      ],
    },
    {
      title: 'Governança',
      items: [
        {
          label: 'Relatórios',
          path: '/relatorios',
          icon: '▧',
          roles: ['ADMIN', 'GESTOR', 'PROJETISTA'],
          permissions: ['reports.view', 'reports.export', 'exports.projects'],
        },
        {
          label: 'Auditoria',
          path: '/auditoria',
          icon: '◎',
          roles: ['ADMIN', 'GESTOR'],
          permissions: ['audit.view', 'audit.view_all'],
          permissionRoles: ['PROJETISTA'],
          deniedRoles: ['CONSULTA'],
        },
        { label: 'Usuários', path: '/users', icon: '◉', roles: ['ADMIN'] },
        {
          label: 'OMs',
          path: '/oms',
          icon: '◆',
          roles: READ_ROLES,
          permissions: ['military_organizations.view', 'oms.view'],
        },
      ],
    },
  ];

  readonly visibleSections = computed(() => {
    const role = this.authService.getUserRole();

    return this.menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => this.canShow(item, role)),
      }))
      .filter((section) => section.items.length > 0);
  });

  private canShow(item: MenuItem, role: UserRole | null): boolean {
    if (!role) {
      return false;
    }

    if (role === 'ADMIN') {
      return true;
    }

    if (item.deniedRoles?.includes(role)) {
      return false;
    }

    const hasFinePermission =
      !!item.permissions?.length && this.authService.hasAnyPermission(item.permissions);

    if (
      hasFinePermission &&
      (!item.permissionRoles?.length || item.permissionRoles.includes(role))
    ) {
      return true;
    }

    return !!item.roles?.includes(role);
  }
}
