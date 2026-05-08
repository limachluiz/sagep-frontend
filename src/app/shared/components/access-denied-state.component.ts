import { Component, Input, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-access-denied-state',
  imports: [RouterLink],
  template: `
    <section
      class="rounded-[1.75rem] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-6 shadow-[var(--sagep-shadow)] sm:p-8"
    >
      <div class="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
        <div
          class="flex h-20 w-20 items-center justify-center rounded-[1.25rem] border border-amber-200 bg-amber-50 text-3xl font-black text-amber-700 sm:h-24 sm:w-24"
          aria-hidden="true"
        >
          !
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--sagep-muted)]">
            Acesso negado
          </p>
          <h1 class="mt-3 text-2xl font-semibold text-[var(--sagep-brand-deep)] sm:text-3xl">
            {{ title }}
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-[var(--sagep-muted)]">
            {{ description }}
          </p>

          @if (profileLabel()) {
            <div
              class="mt-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-[var(--sagep-line)] bg-white px-4 py-2 text-sm text-[var(--sagep-muted)]"
            >
              <span>Perfil atual</span>
              <b class="text-[var(--sagep-brand-deep)]">{{ profileLabel() }}</b>
            </div>
          }

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" class="btn btn-ghost justify-center" (click)="goBack()">
              Voltar
            </button>
            <a [routerLink]="primaryLink" class="btn btn-primary justify-center">
              {{ primaryLabel }}
            </a>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class AccessDeniedStateComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @Input() title = 'Acesso restrito';
  @Input() description = 'Seu perfil não possui permissão para acessar esta área.';
  @Input() primaryLabel = 'Ir para Dashboard';
  @Input() primaryLink = '/dashboard';
  @Input() secondaryLabel = 'Ir para projetos';
  @Input() secondaryLink = '/projects';

  readonly profileLabel = computed(() => {
    const user = this.authService.getCurrentUser();
    const role = this.authService.getUserRole();

    return [user?.name, role].filter(Boolean).join(' - ');
  });

  goBack(): void {
    if (history.length > 1) {
      history.back();
      return;
    }

    void this.router.navigate(['/dashboard']);
  }
}
