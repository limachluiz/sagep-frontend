import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  imports: [CommonModule],
  template: `
    <div
      class="grid gap-4"
      [ngClass]="{
        'md:grid-cols-2 xl:grid-cols-4': variant === 'cards'
      }"
    >
      @for (item of skeletons; track item) {
        <div
          class="animate-pulse rounded-[2rem] border border-slate-200 bg-white/80 shadow-[var(--sagep-shadow)]"
          [class.h-28]="variant === 'list'"
          [class.h-32]="variant === 'cards'"
          [class.h-36]="variant === 'detail'"
        ></div>
      }
      @if (message) {
        <p class="text-sm text-slate-500">{{ message }}</p>
      }
    </div>
  `,
})
export class LoadingStateComponent {
  @Input() count = 3;
  @Input() message = '';
  @Input() variant: 'list' | 'cards' | 'detail' = 'list';

  get skeletons(): number[] {
    return Array.from({ length: this.count }, (_, index) => index + 1);
  }
}
