import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-state',
  imports: [RouterLink],
  template: `
    <section class="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-amber-900 shadow-[var(--sagep-shadow)]">
      <p class="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Acesso negado</p>
      <h2 class="mt-3 text-2xl font-semibold">{{ title }}</h2>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-amber-900/80">
        {{ description }}
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <a
          [routerLink]="primaryLink"
          class="inline-flex rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {{ primaryLabel }}
        </a>
        <a
          [routerLink]="secondaryLink"
          class="inline-flex rounded-full border border-amber-300 px-5 py-2 text-sm font-medium text-amber-900 transition hover:border-amber-500"
        >
          {{ secondaryLabel }}
        </a>
      </div>
    </section>
  `,
})
export class AccessDeniedStateComponent {
  @Input() title = 'Você não possui permissão para acessar este conteúdo.';
  @Input() description =
    'O backend recusou a operação para o perfil ou conjunto de permissões atual. Sua sessão continua ativa normalmente.';
  @Input() primaryLabel = 'Voltar ao dashboard';
  @Input() primaryLink = '/dashboard';
  @Input() secondaryLabel = 'Ir para projetos';
  @Input() secondaryLink = '/projects';
}
