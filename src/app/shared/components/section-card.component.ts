import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-section-card',
  template: `
    <section class="card">
      <div class="card-head">
        <div>
          <div class="card-title">{{ title }}</div>
          @if (subtitle) {
            <div class="card-sub">{{ subtitle }}</div>
          }
        </div>
        <ng-content select="[section-card-actions]"></ng-content>
      </div>
      <div class="card-body">
        <ng-content></ng-content>
      </div>
    </section>
  `,
})
export class SectionCardComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
}
