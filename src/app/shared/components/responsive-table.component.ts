import { CommonModule } from '@angular/common';
import {
  Component,
  ContentChild,
  ContentChildren,
  Directive,
  Input,
  QueryList,
  TemplateRef,
} from '@angular/core';

export type ResponsiveTableColumnAlign = 'left' | 'center' | 'right';

export interface ResponsiveTableColumn {
  key: string;
  label: string;
  align?: ResponsiveTableColumnAlign;
  class?: string;
}

interface ResponsiveTableContext<T> {
  $implicit: T;
  row: T;
  value: unknown;
}

@Directive({
  selector: 'ng-template[appResponsiveTableCell]',
})
export class ResponsiveTableCellDirective<T = unknown> {
  @Input('appResponsiveTableCell') key = '';

  constructor(readonly template: TemplateRef<ResponsiveTableContext<T>>) {}
}

@Directive({
  selector: 'ng-template[appResponsiveTableActions]',
})
export class ResponsiveTableActionsDirective<T = unknown> {
  constructor(readonly template: TemplateRef<{ $implicit: T; row: T }>) {}
}

@Component({
  selector: 'app-responsive-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (!data.length) {
      <div class="empty">
        <p class="text-sm font-semibold text-[var(--sagep-brand-deep)]">{{ emptyTitle }}</p>
        @if (emptyDescription) {
          <p class="mt-2 text-sm leading-6 text-[var(--sagep-muted)]">{{ emptyDescription }}</p>
        }
      </div>
    } @else {
      <div class="table-wrap responsive-table__desktop">
        <table class="table">
          <thead>
            <tr>
              @for (column of columns; track column.key) {
                <th class="px-5 py-4" [ngClass]="[alignClass(column.align), column.class || '']">
                  {{ column.label }}
                </th>
              }
              @if (hasActions()) {
                <th class="px-5 py-4"></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of data; track trackRow(row, $index)) {
              <tr>
                @for (column of columns; track column.key) {
                  <td [ngClass]="[alignClass(column.align), column.class || '']">
                    @if (cellTemplate(column.key); as template) {
                      <ng-container
                        [ngTemplateOutlet]="template"
                        [ngTemplateOutletContext]="cellContext(row, column)"
                      />
                    } @else {
                      {{ cellValue(row, column.key) || fallback }}
                    }
                  </td>
                }
                @if (actionsTemplate?.template; as template) {
                  <td class="text-right">
                    <ng-container
                      [ngTemplateOutlet]="template"
                      [ngTemplateOutletContext]="actionContext(row)"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="responsive-table__cards" aria-label="Listagem em cards">
        @for (row of data; track trackRow(row, $index)) {
          <article class="card responsive-table-card">
            <div class="card-body grid grid-2">
              @for (column of columns; track column.key) {
                <div class="detail-item" [ngClass]="column.class || ''">
                  <label>{{ column.label }}</label>
                  <b [ngClass]="alignClass(column.align)">
                    @if (cellTemplate(column.key); as template) {
                      <ng-container
                        [ngTemplateOutlet]="template"
                        [ngTemplateOutletContext]="cellContext(row, column)"
                      />
                    } @else {
                      {{ cellValue(row, column.key) || fallback }}
                    }
                  </b>
                </div>
              }
            </div>
            @if (actionsTemplate?.template; as template) {
              <div class="responsive-table-card__actions">
                <ng-container
                  [ngTemplateOutlet]="template"
                  [ngTemplateOutletContext]="actionContext(row)"
                />
              </div>
            }
          </article>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      :host .responsive-table__desktop {
        display: block;
      }

      :host .responsive-table__cards {
        display: none;
      }

      @media (max-width: 1023.98px) {
        :host .responsive-table__desktop {
          display: none;
        }

        :host .responsive-table__cards {
          display: grid;
          gap: 1rem;
        }
      }
    `,
  ],
})
export class ResponsiveTableComponent<T = unknown> {
  @Input() columns: ResponsiveTableColumn[] = [];
  @Input() data: T[] = [];
  @Input() emptyTitle = 'Nenhum registro encontrado';
  @Input() emptyDescription = '';
  @Input() fallback = 'Não informado';
  @Input() trackBy?: (row: T, index: number) => unknown;

  @ContentChildren(ResponsiveTableCellDirective) private readonly cellTemplates?: QueryList<ResponsiveTableCellDirective<T>>;
  @ContentChild(ResponsiveTableActionsDirective) readonly actionsTemplate?: ResponsiveTableActionsDirective<T>;

  cellTemplate(key: string): TemplateRef<ResponsiveTableContext<T>> | null {
    return this.cellTemplates?.find((item) => item.key === key)?.template ?? null;
  }

  cellContext(row: T, column: ResponsiveTableColumn): ResponsiveTableContext<T> {
    return {
      $implicit: row,
      row,
      value: this.cellValue(row, column.key),
    };
  }

  actionContext(row: T): { $implicit: T; row: T } {
    return { $implicit: row, row };
  }

  cellValue(row: T, key: string): unknown {
    return key.split('.').reduce<unknown>((source, part) => {
      if (source && typeof source === 'object' && part in source) {
        return (source as Record<string, unknown>)[part];
      }

      return undefined;
    }, row);
  }

  alignClass(align: ResponsiveTableColumnAlign = 'left'): string {
    return {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    }[align];
  }

  hasActions(): boolean {
    return Boolean(this.actionsTemplate);
  }

  trackRow(row: T, index: number): unknown {
    return this.trackBy ? this.trackBy(row, index) : index;
  }
}
