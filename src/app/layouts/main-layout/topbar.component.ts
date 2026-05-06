import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  template: `
    <header class="sticky top-0 z-10 border-b border-[var(--sagep-line)] bg-[rgba(255,253,247,0.92)] px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-black uppercase tracking-[0.22em] text-[var(--sagep-brand)]">Sessão autenticada</p>
          <h2 class="mt-1 text-xl font-semibold text-[var(--sagep-brand-deep)] sm:text-2xl">Sistema de Apoio à Gestão de Projetos</h2>
        </div>

        <div class="flex w-full items-center gap-3 rounded-[16px] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] px-3 py-2.5 shadow-[var(--sagep-shadow-soft)] sm:w-auto">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#e0c26b,#c8a64b)] text-sm font-black text-[var(--sagep-brand-deep)]">
            {{ initials() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-[var(--sagep-ink)]">{{ userName() }}</p>
            <p class="truncate text-[11px] uppercase tracking-[0.18em] text-[var(--sagep-muted)]">{{ userRole() }}</p>
          </div>
          <button
            type="button"
            (click)="logout()"
            class="shrink-0 rounded-[12px] border border-[var(--sagep-line)] px-3 py-2 text-sm font-semibold text-[var(--sagep-brand-dark)] transition hover:border-[var(--sagep-brand-mid)] hover:bg-[var(--sagep-brand-soft)] focus:ring-4 focus:ring-[rgba(200,166,75,0.18)]"
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
