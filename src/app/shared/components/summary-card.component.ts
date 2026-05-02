import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-summary-card',
  template: `
    <article class="rounded-3xl border p-5 shadow-[var(--sagep-shadow)]" [class]="resolvedClass">
      @if (icon) {
        <p class="text-xs uppercase tracking-[0.24em] opacity-70">{{ icon }}</p>
      }
      <p class="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">{{ title }}</p>
      <p class="mt-4 text-3xl font-semibold text-slate-950">{{ value }}</p>
      @if (description) {
        <p class="mt-2 text-sm text-slate-600">{{ description }}</p>
      }
    </article>
  `,
})
export class SummaryCardComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) value = '';
  @Input() description = '';
  @Input() icon = '';
  @Input() tone: 'default' | 'accent' | 'soft' = 'default';

  get resolvedClass(): string {
    switch (this.tone) {
      case 'accent':
        return 'border-teal-200 bg-teal-50';
      case 'soft':
        return 'border-slate-200 bg-slate-50';
      default:
        return 'border-slate-200 bg-white';
    }
  }
}
