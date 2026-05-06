import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-under-construction',
  imports: [RouterLink],
  template: `
    <section class="rounded-3xl border border-slate-200 bg-white p-8 shadow-[var(--sagep-shadow)]">
      <p class="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Módulo planejado</p>
      <h1 class="mt-3 text-3xl font-semibold text-slate-900">{{ title() }}</h1>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        Esta área já está mapeada no backend e no menu principal, mas ainda não entrou no escopo desta etapa.
      </p>
      <a
        routerLink="/dashboard"
        class="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Voltar ao dashboard
      </a>
    </section>
  `,
})
export class UnderConstructionComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = computed(() => (this.route.snapshot.data['title'] as string) ?? 'Em construção');
}
