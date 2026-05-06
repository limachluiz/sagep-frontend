import { Component, Input } from '@angular/core';

import { getStatusBadgeClasses } from '../utils/format.util';

@Component({
  selector: 'app-status-badge',
  template: `
    <span class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em]" [class]="resolvedClass">
      <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
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
