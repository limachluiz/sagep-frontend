import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  template: `
    <div class="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700 shadow-[var(--sagep-shadow)]">
      <h2 class="text-lg font-semibold">{{ title }}</h2>
      <p class="mt-2 text-sm leading-6">{{ message }}</p>
      @if (retryLabel) {
        <button
          type="button"
          (click)="retry.emit()"
          class="mt-5 rounded-full border border-red-300 px-5 py-2 text-sm font-medium text-red-700 transition hover:border-red-500"
        >
          {{ retryLabel }}
        </button>
      }
    </div>
  `,
})
export class ErrorStateComponent {
  @Input() title = 'Nao foi possivel carregar os dados';
  @Input() message = 'Ocorreu um erro inesperado.';
  @Input() retryLabel = 'Tentar novamente';
  @Output() retry = new EventEmitter<void>();
}
