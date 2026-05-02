import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-header',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
      @if (backLink) {
        <a
          [routerLink]="backLink"
          class="mb-5 inline-flex items-center gap-2 text-sm font-medium text-teal-700 transition hover:text-teal-900"
        >
          {{ backLabel }}
        </a>
      }

      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          @if (eyebrow) {
            <p class="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">{{ eyebrow }}</p>
          }
          <h1 class="mt-2 text-3xl font-semibold text-slate-950">{{ title }}</h1>
          @if (subtitle) {
            <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{{ subtitle }}</p>
          }
        </div>

        <div class="flex flex-col gap-3 lg:items-end">
          @if (badge) {
            <span class="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-600">
              {{ badge }}
            </span>
          }
          <ng-content select="[page-header-actions]"></ng-content>
        </div>
      </div>
    </section>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() eyebrow = '';
  @Input() subtitle = '';
  @Input() badge = '';
  @Input() backLink: string | string[] | null = null;
  @Input() backLabel = 'Voltar';
}
