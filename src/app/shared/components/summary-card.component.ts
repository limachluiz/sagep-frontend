import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-summary-card',
  template: `
    <article class="relative overflow-hidden rounded-[var(--sagep-radius)] border p-5 shadow-[var(--sagep-shadow-soft)]" [class]="resolvedClass">
      <div class="absolute inset-x-0 top-0 h-1" [class]="toneBarClass"></div>
      @if (icon) {
        <p class="text-xl opacity-80">{{ icon }}</p>
      }
      <p class="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--sagep-muted)]">{{ title }}</p>
      <p class="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[var(--sagep-brand-deep)]">{{ value }}</p>
      @if (description) {
        <p class="mt-2 text-sm leading-6 text-[var(--sagep-muted)]">{{ description }}</p>
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
        return 'border-[var(--sagep-line)] bg-[var(--sagep-gold-soft)]';
      case 'soft':
        return 'border-[var(--sagep-line)] bg-[var(--sagep-surface-subtle)]';
      default:
        return 'border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)]';
    }
  }

  get toneBarClass(): string {
    switch (this.tone) {
      case 'accent':
        return 'bg-[var(--sagep-gold)]';
      case 'soft':
        return 'bg-[var(--sagep-brand-mid)]';
      default:
        return 'bg-[var(--sagep-brand)]';
    }
  }
}
