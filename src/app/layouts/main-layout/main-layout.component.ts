import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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

@Component({
  selector: 'app-main-layout',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="min-h-screen bg-transparent">
      <div class="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[290px_1fr]">
        <aside class="border-r border-slate-200/80 bg-slate-950 px-5 py-6 text-slate-100">
          <div class="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p class="text-xs uppercase tracking-[0.35em] text-teal-300">SAGEP</p>
            <h1 class="mt-3 text-2xl font-semibold">Painel institucional</h1>
            <p class="mt-2 text-sm text-slate-300">Navegação baseada em perfil e permissões efetivas do backend.</p>
          </div>

          <nav class="mt-8 space-y-2">
            @for (item of visibleMenu(); track item.path) {
              @if (item.disabled) {
                <div class="rounded-2xl border border-white/8 px-4 py-3 text-sm text-slate-400">
                  <div class="flex items-center justify-between gap-3">
                    <span>{{ item.label }}</span>
                    <span class="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Em construcao
                    </span>
                  </div>
                  @if (item.hint) {
                    <p class="mt-2 text-xs leading-5 text-slate-500">{{ item.hint }}</p>
                  }
                </div>
              } @else {
                <a
                  [routerLink]="item.path"
                  routerLinkActive="bg-teal-500/20 text-white border-teal-400/50"
                  class="block rounded-2xl border border-transparent px-4 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white"
                >
                  {{ item.label }}
                </a>
              }
            }
          </nav>
        </aside>

        <div class="flex min-h-screen flex-col">
          <header class="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Sessao autenticada</p>
                <h2 class="text-2xl font-semibold text-slate-900">Sistema de Apoio a Gestao de Projetos</h2>
              </div>

              <div class="flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                <div class="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                  {{ initials() }}
                </div>
                <div>
                  <p class="text-sm font-semibold text-slate-900">{{ userName() }}</p>
                  <p class="text-xs uppercase tracking-[0.24em] text-slate-500">{{ userRole() }}</p>
                </div>
                <button
                  type="button"
                  (click)="logout()"
                  class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>

          <main class="flex-1 px-4 py-6 sm:px-6">
            <router-outlet />
          </main>
        </div>
      </div>
    </div>
  `,
})
export class MainLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly menu: MenuItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      permissions: ['dashboard.view_operational', 'dashboard.view_executive', 'dashboard.financial_view'],
    },
    { label: 'Projetos', path: '/projects' },
    { label: 'Estimativas', path: '/estimates' },
    { label: 'DIEx', path: '/diex', disabled: true, hint: 'Será integrado a partir de estimativas finalizadas.' },
    { label: 'Ordens de Serviço', path: '/ordens-servico', disabled: true, hint: 'Módulo planejado após DIEx e Nota de Empenho.' },
    { label: 'ATAs', path: '/atas', disabled: true, hint: 'Estrutura já prevista, sem implementação nesta entrega.' },
    { label: 'Itens da ATA', path: '/itens-ata', disabled: true, hint: 'Ligado ao controle de estoque e saldo da ATA.' },
    { label: 'Saldo da ATA', path: '/saldo-ata', disabled: true, hint: 'Painel reservado para movimentações e disponibilidade.' },
    { label: 'Relatórios', path: '/relatorios', disabled: true, hint: 'Exportações e relatórios serão integrados em etapa futura.' },
    { label: 'Auditoria', path: '/auditoria', disabled: true, hint: 'Consulta de eventos e rastreabilidade ainda pendente.' },
    { label: 'Usuários', path: '/usuarios', disabled: true, roles: ['ADMIN'], hint: 'Módulo administrativo reservado ao perfil ADMIN.' },
    { label: 'OMs', path: '/oms', disabled: true, roles: ['ADMIN'], hint: 'Cadastro institucional previsto para módulo administrativo.' },
  ];

  readonly visibleMenu = computed(() => {
    const role = this.authService.getUserRole();

    return this.menu.filter((item) => {
      const roleAllowed = !item.roles?.length || (role ? item.roles.includes(role) : false);
      const permissionAllowed = !item.permissions?.length || this.authService.hasAnyPermission(item.permissions);
      return roleAllowed && permissionAllowed;
    });
  });

  readonly userName = computed(() => this.authService.getCurrentUser()?.name ?? 'Usuario');
  readonly userRole = computed(() => this.authService.getUserRole() ?? 'SEM PERFIL');
  readonly initials = computed(() =>
    (this.authService.getCurrentUser()?.name ?? 'S A')
      .split(' ')
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase(),
  );

  logout(): void {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
    });
  }
}
