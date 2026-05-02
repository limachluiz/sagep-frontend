import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-[var(--sagep-shadow)]">
      <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">{{ eyebrow }}</p>
      <h2 class="mt-3 text-2xl font-semibold text-slate-900">{{ title }}</h2>
      <p class="mt-3 text-sm leading-6 text-slate-600">{{ description }}</p>
      @if (actionLabel) {
        <button
          type="button"
          (click)="action?.()"
          class="mt-6 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() eyebrow = 'Nenhum resultado';
  @Input({ required: true }) title = '';
  @Input({ required: true }) description = '';
  @Input() actionLabel = '';
  @Input() action?: () => void;
}
