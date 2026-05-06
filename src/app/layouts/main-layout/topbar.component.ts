import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  template: `
    <header class="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Sessão autenticada</p>
          <h2 class="mt-1 text-2xl font-semibold text-slate-950">Sistema de Apoio à Gestão de Projetos</h2>
        </div>

        <div class="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm sm:w-auto sm:px-4">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
            {{ initials() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-slate-900">{{ userName() }}</p>
            <p class="truncate text-xs uppercase tracking-[0.2em] text-slate-500">{{ userRole() }}</p>
          </div>
          <button
            type="button"
            (click)="logout()"
            class="shrink-0 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly userName = computed(() => this.authService.getCurrentUser()?.name ?? 'Usuário');
  readonly userRole = computed(() => this.authService.getUserRole() ?? 'SEM PERFIL');
  readonly initials = computed(() =>
    (this.authService.getCurrentUser()?.name ?? 'S A')
      .split(' ')
      .filter(Boolean)
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
