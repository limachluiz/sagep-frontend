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
    <div class="detail-grid metadata-grid" [ngClass]="gridClass">
      @for (item of items; track item.label) {
        <div class="detail-item" [class.highlight]="item.highlight">
          <label>{{ item.label }}</label>
          <b>{{ item.value || fallback }}</b>
          @if (item.description) {
            <p>{{ item.description }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class MetadataGridComponent {
  @Input() items: MetadataItem[] = [];
  @Input() fallback = 'Não informado';
  @Input() gridClass = 'md:grid-cols-2';
}
