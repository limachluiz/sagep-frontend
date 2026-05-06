import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-summary-card',
  template: `
    <article class="card metric" [class]="toneClass">
      @if (icon) {
        <div class="icon">{{ icon }}</div>
      }
      <div class="value">{{ value }}</div>
      <div class="label">{{ title }}</div>
      @if (description) {
        <div class="trend">{{ description }}</div>
      }
    </article>
  `,
})
export class SummaryCardComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) value = '';
  @Input() description = '';
  @Input() icon = '';
  @Input() tone: 'default' | 'accent' | 'soft' | 'success' | 'warning' | 'danger' = 'default';

  get toneClass(): string {
    switch (this.tone) {
      case 'accent':
        return 'gold';
      case 'soft':
        return 'info';
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'danger':
        return 'danger';
      default:
        return '';
    }
  }
}
