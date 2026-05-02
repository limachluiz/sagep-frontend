import { Component, Input } from '@angular/core';

import { getStatusBadgeClasses } from '../utils/format.util';

@Component({
  selector: 'app-status-badge',
  template: `
    <span class="inline-flex rounded-full border px-3 py-1 text-sm font-medium" [class]="resolvedClass">
      {{ label }}
    </span>
  `,
})
export class StatusBadgeComponent {
  @Input() label = '';
  @Input() status: string | null | undefined;
  @Input() variantClass = '';

  get resolvedClass(): string {
    return this.variantClass || getStatusBadgeClasses(this.status);
  }
}
