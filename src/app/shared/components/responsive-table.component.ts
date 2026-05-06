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
      <div class="rounded-[var(--sagep-radius)] border border-dashed border-[var(--sagep-line-strong)] bg-[var(--sagep-surface-subtle)] p-6 text-center">
        <p class="text-sm font-semibold text-[var(--sagep-brand-deep)]">{{ emptyTitle }}</p>
        @if (emptyDescription) {
          <p class="mt-2 text-sm leading-6 text-[var(--sagep-muted)]">{{ emptyDescription }}</p>
        }
      </div>
    } @else {
      <div class="hidden overflow-x-auto rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] lg:block">
        <table class="min-w-full divide-y divide-[var(--sagep-line)]">
          <thead class="bg-[var(--sagep-surface-subtle)]">
            <tr class="text-left text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sagep-muted)]">
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
          <tbody class="divide-y divide-[var(--sagep-line)]">
            @for (row of data; track trackRow(row, $index)) {
              <tr class="align-top transition hover:bg-[#fffaf0]">
                @for (column of columns; track column.key) {
                  <td class="px-5 py-4 text-sm text-[var(--sagep-ink)]" [ngClass]="[alignClass(column.align), column.class || '']">
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
                  <td class="px-5 py-4 text-right">
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

      <div class="grid gap-4 lg:hidden">
        @for (row of data; track trackRow(row, $index)) {
          <article class="rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-4 shadow-[var(--sagep-shadow-soft)]">
            <div class="grid gap-3 sm:grid-cols-2">
              @for (column of columns; track column.key) {
                <div class="rounded-[14px] bg-[var(--sagep-surface-subtle)] p-3" [ngClass]="column.class || ''">
                  <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sagep-muted)]">{{ column.label }}</p>
                  <div class="mt-2 text-sm font-medium text-[var(--sagep-brand-deep)]" [ngClass]="alignClass(column.align)">
                    @if (cellTemplate(column.key); as template) {
                      <ng-container
                        [ngTemplateOutlet]="template"
                        [ngTemplateOutletContext]="cellContext(row, column)"
                      />
                    } @else {
                      {{ cellValue(row, column.key) || fallback }}
                    }
                  </div>
                </div>
              }
            </div>
            @if (actionsTemplate?.template; as template) {
              <div class="mt-4">
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
