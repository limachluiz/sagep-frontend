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
          path: '/ordens-servico',
          icon: '▤',
          disabled: true,
          hint: 'Módulo planejado após DIEx e Nota de Empenho.',
        },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { label: 'ATAs', path: '/atas', icon: '◫', disabled: true, hint: 'Estrutura já prevista, sem implementação nesta entrega.' },
        { label: 'Itens da ATA', path: '/itens-ata', icon: '▦', disabled: true, hint: 'Ligado ao controle de estoque e saldo da ATA.' },
        { label: 'Saldo da ATA', path: '/saldo-ata', icon: '▥', disabled: true, hint: 'Painel reservado para movimentações e disponibilidade.' },
      ],
    },
    {
      title: 'Governança',
      items: [
        { label: 'Relatórios', path: '/relatorios', icon: '▧', disabled: true, hint: 'Exportações e relatórios serão integrados em etapa futura.' },
        { label: 'Auditoria', path: '/auditoria', icon: '◎', disabled: true, hint: 'Consulta de eventos e rastreabilidade ainda pendente.' },
        { label: 'Usuários', path: '/usuarios', icon: '◉', disabled: true, roles: ['ADMIN'], hint: 'Módulo administrativo reservado ao perfil ADMIN.' },
        { label: 'OMs', path: '/oms', icon: '◆', disabled: true, roles: ['ADMIN'], hint: 'Cadastro institucional previsto para módulo administrativo.' },
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
