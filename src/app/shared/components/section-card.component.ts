import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-section-card',
  template: `
    <section class="overflow-hidden rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] shadow-[var(--sagep-shadow-soft)]">
      <div class="flex flex-col gap-3 border-b border-[var(--sagep-line)] bg-[linear-gradient(180deg,#fffdf7,var(--sagep-surface-subtle))] px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 class="text-xl font-semibold text-[var(--sagep-brand-deep)]">{{ title }}</h2>
          @if (subtitle) {
            <p class="mt-2 text-sm leading-6 text-[var(--sagep-muted)]">{{ subtitle }}</p>
          }
        </div>
        <ng-content select="[section-card-actions]"></ng-content>
      </div>
      <div class="p-5">
        <ng-content></ng-content>
      </div>
    </section>
  `,
})
export class SectionCardComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
}
