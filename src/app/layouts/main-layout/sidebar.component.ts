import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UserRole } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

interface MenuItem {
  label: string;
  path: string;
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
    <aside class="border-b border-slate-200/80 bg-slate-950 px-4 py-5 text-slate-100 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div class="lg:sticky lg:top-6">
        <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p class="text-xs uppercase tracking-[0.35em] text-teal-300">SAGEP</p>
          <h1 class="mt-3 text-2xl font-semibold">Sistema de Apoio à Gestão de Projetos</h1>
          <p class="mt-2 text-sm leading-6 text-slate-300">
            Navegação organizada por área, perfil e permissões efetivas do backend.
          </p>
        </div>

        <nav class="mt-6 space-y-6" aria-label="Navegação principal">
          @for (section of visibleSections(); track section.title) {
            <section>
              <p class="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {{ section.title }}
              </p>

              <div class="mt-2 space-y-1.5">
                @for (item of section.items; track item.path) {
                  @if (item.disabled) {
                    <div class="rounded-xl border border-white/8 px-3 py-3 text-sm text-slate-400">
                      <div class="flex items-center justify-between gap-3">
                        <span>{{ item.label }}</span>
                        <span class="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                          Em construção
                        </span>
                      </div>
                      @if (item.hint) {
                        <p class="mt-2 text-xs leading-5 text-slate-500">{{ item.hint }}</p>
                      }
                    </div>
                  } @else {
                    <a
                      [routerLink]="item.path"
                      routerLinkActive="border-teal-400/60 bg-teal-500/20 text-white"
                      class="block rounded-xl border border-transparent px-3 py-3 text-sm font-medium text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white"
                    >
                      {{ item.label }}
                    </a>
                  }
                }
              </div>
            </section>
          }
        </nav>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);

  private readonly menuSections: MenuSection[] = [
    {
      title: 'Visão Geral',
      items: [
        {
          label: 'Dashboard',
          path: '/dashboard',
          permissions: ['dashboard.view_operational', 'dashboard.view_executive', 'dashboard.financial_view'],
        },
      ],
    },
    {
      title: 'Planejamento',
      items: [
        { label: 'Projetos', path: '/projects' },
        { label: 'Estimativas', path: '/estimates' },
      ],
    },
    {
      title: 'Documentos',
      items: [
        { label: 'DIEx', path: '/diex', disabled: true, hint: 'Será integrado a partir de estimativas finalizadas.' },
        {
          label: 'Ordens de Serviço',
          path: '/ordens-servico',
          disabled: true,
          hint: 'Módulo planejado após DIEx e Nota de Empenho.',
        },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { label: 'ATAs', path: '/atas', disabled: true, hint: 'Estrutura já prevista, sem implementação nesta entrega.' },
        { label: 'Itens da ATA', path: '/itens-ata', disabled: true, hint: 'Ligado ao controle de estoque e saldo da ATA.' },
        { label: 'Saldo da ATA', path: '/saldo-ata', disabled: true, hint: 'Painel reservado para movimentações e disponibilidade.' },
      ],
    },
    {
      title: 'Gestão',
      items: [
        { label: 'Relatórios', path: '/relatorios', disabled: true, hint: 'Exportações e relatórios serão integrados em etapa futura.' },
        { label: 'Auditoria', path: '/auditoria', disabled: true, hint: 'Consulta de eventos e rastreabilidade ainda pendente.' },
      ],
    },
    {
      title: 'Administração',
      items: [
        { label: 'Usuários', path: '/usuarios', disabled: true, roles: ['ADMIN'], hint: 'Módulo administrativo reservado ao perfil ADMIN.' },
        { label: 'OMs', path: '/oms', disabled: true, roles: ['ADMIN'], hint: 'Cadastro institucional previsto para módulo administrativo.' },
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
