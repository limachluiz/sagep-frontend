import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-section-card',
  template: `
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 class="text-xl font-semibold text-slate-950">{{ title }}</h2>
          @if (subtitle) {
            <p class="mt-2 text-sm text-slate-600">{{ subtitle }}</p>
          }
        </div>
        <ng-content select="[section-card-actions]"></ng-content>
      </div>
      <div class="mt-5">
        <ng-content></ng-content>
      </div>
    </section>
  `,
})
export class SectionCardComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
}
