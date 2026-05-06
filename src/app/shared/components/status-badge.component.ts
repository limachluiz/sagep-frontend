import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  template: `
    <span class="badge" [class]="resolvedClass">
      {{ label }}
    </span>
  `,
})
export class StatusBadgeComponent {
  @Input() label = '';
  @Input() status: string | null | undefined;
  @Input() variantClass = '';

  get resolvedClass(): string {
    if (this.variantClass) {
      return this.variantClass;
    }

    const status = (this.status ?? '').toUpperCase();

    if (['FINALIZADA', 'CONCLUIDO', 'SERVICO_CONCLUIDO'].includes(status)) {
      return 'b-ok';
    }

    if (['CANCELADA', 'CANCELADO'].includes(status)) {
      return 'b-danger';
    }

    if (['PAUSADO', 'ANALISANDO_AS_BUILT', 'AGUARDANDO_NOTA_EMPENHO', 'AGUARDANDO_NOTA_CREDITO'].includes(status)) {
      return 'b-warn';
    }

    if (['RASCUNHO', 'EM_ANDAMENTO', 'SERVICO_EM_EXECUCAO', 'OS_LIBERADA'].includes(status)) {
      return 'b-info';
    }

    return 'b-neutral';
  }
}
