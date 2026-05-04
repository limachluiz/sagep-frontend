import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface MetadataItem {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
  description?: string;
}

@Component({
  selector: 'app-metadata-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid gap-4" [ngClass]="gridClass">
      @for (item of items; track item.label) {
        <div
          class="rounded-2xl p-4"
          [ngClass]="item.highlight ? 'border border-teal-200 bg-teal-50' : 'bg-slate-50'"
        >
          <p
            class="text-xs uppercase tracking-[0.18em]"
            [ngClass]="item.highlight ? 'text-teal-700' : 'text-slate-500'"
          >
            {{ item.label }}
          </p>
          <p
            class="mt-2 text-sm font-medium"
            [ngClass]="item.highlight ? 'text-teal-950' : 'text-slate-900'"
          >
            {{ item.value || fallback }}
          </p>
          @if (item.description) {
            <p class="mt-2 text-sm leading-6" [ngClass]="item.highlight ? 'text-teal-900/80' : 'text-slate-600'">
              {{ item.description }}
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class MetadataGridComponent {
  @Input() items: MetadataItem[] = [];
  @Input() fallback = 'Nao informado';
  @Input() gridClass = 'md:grid-cols-2';
}
