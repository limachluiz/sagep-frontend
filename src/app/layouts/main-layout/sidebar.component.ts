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
    <aside class="border-b border-[var(--sagep-line)] bg-[linear-gradient(180deg,var(--sagep-brand-dark),var(--sagep-brand-deep))] px-4 py-5 text-slate-100 lg:border-b-0 lg:border-r lg:border-[rgba(200,166,75,0.18)] lg:px-5 lg:py-6">
      <div class="lg:sticky lg:top-6">
        <div class="rounded-[18px] border border-[rgba(200,166,75,0.22)] bg-[rgba(255,255,255,0.06)] p-5 shadow-[0_18px_42px_-34px_rgba(0,0,0,0.9)]">
          <div class="flex items-center justify-between gap-4">
            <p class="text-xs font-black uppercase tracking-[0.35em] text-[var(--sagep-gold)]">SAGEP</p>
            <span class="h-2 w-10 rounded-full bg-[var(--sagep-gold)]"></span>
          </div>
          <h1 class="mt-4 text-xl font-semibold leading-tight">Sistema de Apoio à Gestão de Projetos</h1>
          <p class="mt-3 text-sm leading-6 text-white/[0.62]">
            4º CTA · Divisão Técnica · Exército Brasileiro
          </p>
        </div>

        <nav class="mt-6 space-y-6" aria-label="Navegação principal">
          @for (section of visibleSections(); track section.title) {
            <section>
              <p class="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-[rgba(200,166,75,0.62)]">
                {{ section.title }}
              </p>

              <div class="mt-2 space-y-1">
                @for (item of section.items; track item.path) {
                  @if (item.disabled) {
                    <div class="rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm text-white/[0.42]">
                      <div class="flex items-center justify-between gap-3">
                        <span class="font-medium">{{ item.label }}</span>
                        <span class="shrink-0 rounded-full border border-white/10 bg-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/[0.38]">
                          Em construção
                        </span>
                      </div>
                      @if (item.hint) {
                        <p class="mt-2 text-xs leading-5 text-white/[0.35]">{{ item.hint }}</p>
                      }
                    </div>
                  } @else {
                    <a
                      [routerLink]="item.path"
                      routerLinkActive="border-[rgba(200,166,75,0.42)] bg-[rgba(200,166,75,0.16)] text-[var(--sagep-gold)] shadow-sm"
                      class="block rounded-[14px] border border-transparent px-3 py-3 text-sm font-medium text-white/[0.68] transition hover:border-white/10 hover:bg-white/[0.07] hover:text-white focus:ring-4 focus:ring-[rgba(200,166,75,0.16)]"
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
