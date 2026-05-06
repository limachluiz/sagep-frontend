import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-header',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="overflow-hidden rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] shadow-[var(--sagep-shadow-soft)]">
      <div class="border-l-4 border-[var(--sagep-gold)] px-5 py-6 sm:px-6">
        @if (backLink) {
          <a
            [routerLink]="backLink"
            class="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--sagep-brand)] transition hover:text-[var(--sagep-brand-deep)]"
          >
            {{ backLabel }}
          </a>
        }

        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            @if (eyebrow) {
              <p class="text-xs font-black uppercase tracking-[0.24em] text-[var(--sagep-brand)]">{{ eyebrow }}</p>
            }
            <h1 class="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[var(--sagep-brand-deep)]">{{ title }}</h1>
            @if (subtitle) {
              <p class="mt-3 max-w-3xl text-sm leading-6 text-[var(--sagep-muted)]">{{ subtitle }}</p>
            }
          </div>

          <div class="flex flex-col gap-3 lg:items-end">
            @if (badge) {
              <span class="rounded-full border border-[var(--sagep-line)] bg-[var(--sagep-surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sagep-muted)]">
                {{ badge }}
              </span>
            }
            <ng-content select="[page-header-actions]"></ng-content>
          </div>
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
