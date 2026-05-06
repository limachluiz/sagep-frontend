import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-header',
  imports: [CommonModule, RouterLink],
  template: `
    <header class="page-head">
      <div>
        <div class="crumb">
          @if (backLink) {
            <a [routerLink]="backLink">{{ backLabel }}</a>
            <span> / </span>
          }
          @if (eyebrow) {
            <span>{{ eyebrow }}</span>
          }
        </div>
        <h1>{{ title }}</h1>
        @if (subtitle) {
          <p>{{ subtitle }}</p>
        }
      </div>

      <div class="page-actions">
        @if (badge) {
          <span class="badge b-neutral">{{ badge }}</span>
        }
        <ng-content select="[page-header-actions]"></ng-content>
      </div>
    </header>
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
