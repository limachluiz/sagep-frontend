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
  roles?: UserRole[];
  hint?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

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
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                class="nav-item"
              >
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
          permissions: ['dashboard.view_operational', 'dashboard.view_executive', 'dashboard.financial_view'],
        },
      ],
    },
    {
      title: 'Operação',
      items: [
        { label: 'Projetos', path: '/projects', icon: '▣' },
        { label: 'Estimativas', path: '/estimates', icon: '∑' },
      ],
    },
    {
      title: 'Documentos',
      items: [
        { label: 'DIEx Requisitório', path: '/diex', icon: '◇' },
        {
          label: 'Ordens de Serviço',
          path: '/service-orders',
          icon: '▤',
        },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { label: 'ATAs', path: '/atas', icon: '◫' },
        { label: 'Itens da ATA', path: '/itens-ata', icon: '▦' },
        { label: 'Saldo da ATA', path: '/saldo-ata', icon: '▥' },
      ],
    },
    {
      title: 'Governança',
      items: [
        { label: 'Relatórios', path: '/relatorios', icon: '▧' },
        { label: 'Auditoria', path: '/auditoria', icon: '◎', roles: ['ADMIN', 'GESTOR'] },
        { label: 'Usuários', path: '/users', icon: '◉', roles: ['ADMIN'] },
        { label: 'OMs', path: '/oms', icon: '◆', roles: ['ADMIN'] },
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
    const roleAllowed = !item.roles?.length || (role ? item.roles.includes(role) : false);
    const permissionAllowed = !item.permissions?.length || this.authService.hasAnyPermission(item.permissions);
    return roleAllowed && permissionAllowed;
  }
}
