import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import {
  ResponsiveTableCellDirective,
  ResponsiveTableColumn,
  ResponsiveTableComponent,
} from '../../shared/components/responsive-table.component';
import { formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { AuditActor, AuditLog } from './audit.model';
import { AuditService } from './audit.service';

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccessDeniedStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    ResponsiveTableCellDirective,
    ResponsiveTableComponent,
  ],
  template: `
    <section class="workspace">
      <app-page-header
        title="Auditoria"
        eyebrow="Governança"
        subtitle="Consulta de eventos registrados para rastreabilidade operacional."
        badge="Trilha de eventos"
      />

      <section class="card">
        <form [formGroup]="filtersForm" class="filters projects-filters">
          <input type="search" formControlName="search" class="input" placeholder="Buscar por ator, entidade, ação ou resumo" />
          <input type="search" formControlName="entityType" class="input" placeholder="Tipo de entidade" />
          <input type="search" formControlName="action" class="input" placeholder="Ação" />
          <input type="search" formControlName="actor" class="input" placeholder="Ator" />
          <input type="date" formControlName="from" class="input" aria-label="Data inicial" />
          <input type="date" formControlName="to" class="input" aria-label="Data final" />
          <button type="button" (click)="clearFilters()" class="btn btn-ghost">
            Limpar filtros
          </button>
        </form>
      </section>

      @if (loading()) {
        <app-loading-state variant="list" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar auditoria."
          description="A consulta de eventos foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/dashboard"
          secondaryLink="/projects"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar a auditoria"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadLogs()"
        />
      } @else if (!filteredLogs().length) {
        <app-empty-state
          title="Nenhum evento encontrado com os filtros atuais"
          description="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          actionLabel="Limpar filtros"
          [action]="clearFilters.bind(this)"
        />
      } @else {
        <section class="card">
          <div class="estimates-table-head">
            <div>
              <strong>{{ metaLabel() }}</strong>
              @if (activeFilterSummary()) {
                <span class="badge b-neutral">{{ activeFilterSummary() }}</span>
              }
            </div>
            <span>Dados atualizados</span>
          </div>

          <app-responsive-table
            [columns]="columns"
            [data]="pagedLogs()"
            [trackBy]="trackLog"
            emptyTitle="Nenhum evento encontrado"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="date" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ logDate(item) }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="actor" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ actorLabel(item) }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="entity" let-item>
              {{ entityLabel(item) }}
            </ng-template>
            <ng-template appResponsiveTableCell="action" let-item>
              <span class="badge b-neutral">{{ actionLabel(item) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="summary" let-item>
              <p>{{ summaryLabel(item) }}</p>
            </ng-template>
          </app-responsive-table>

          <div class="estimates-pagination">
            <div class="pagination-size">
              <span>Itens por página</span>
              <select [value]="pageSize()" (change)="changePageSize($any($event.target).value)" class="select">
                @for (option of pageSizeOptions; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>
            <div class="pagination-actions">
              <button type="button" [disabled]="!canGoPrevious()" (click)="changePage(currentPage() - 1)" class="btn btn-ghost">
                Anterior
              </button>
              <span>Página {{ currentPage() }} de {{ totalPages() }}</span>
              <button type="button" [disabled]="!canGoNext()" (click)="changePage(currentPage() + 1)" class="btn btn-ghost">
                Próxima
              </button>
            </div>
          </div>
        </section>
      }
    </section>
  `,
})
export class AuditPageComponent implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly logs = signal<AuditLog[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'date', label: 'Data' },
    { key: 'actor', label: 'Ator' },
    { key: 'entity', label: 'Entidade' },
    { key: 'action', label: 'Ação' },
    { key: 'summary', label: 'Resumo' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    entityType: [''],
    action: [''],
    actor: [''],
    from: [''],
    to: [''],
  });

  readonly filteredLogs = computed(() => {
    const { search, entityType, action, actor, from, to } = this.filtersForm.getRawValue();
    const term = search.trim().toLowerCase();
    const selectedEntity = entityType.trim().toLowerCase();
    const selectedAction = action.trim().toLowerCase();
    const selectedActor = actor.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return this.logs().filter((log) => {
      const dateTime = this.logTimestamp(log);
      const matchesSearch = !term ||
        [this.actorLabel(log), this.entityLabel(log), this.actionLabel(log), this.summaryLabel(log)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesEntity = !selectedEntity || this.entityLabel(log).toLowerCase().includes(selectedEntity);
      const matchesAction = !selectedAction || this.actionLabel(log).toLowerCase().includes(selectedAction);
      const matchesActor = !selectedActor || this.actorLabel(log).toLowerCase().includes(selectedActor);
      const matchesFrom = fromTime === null || (dateTime !== null && dateTime >= fromTime);
      const matchesTo = toTime === null || (dateTime !== null && dateTime <= toTime);

      return matchesSearch && matchesEntity && matchesAction && matchesActor && matchesFrom && matchesTo;
    });
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredLogs().length / this.pageSize())));
  readonly canGoPrevious = computed(() => this.currentPage() > 1);
  readonly canGoNext = computed(() => this.currentPage() < this.totalPages());
  readonly pagedLogs = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredLogs().slice(start, start + this.pageSize());
  });
  readonly metaLabel = computed(() =>
    `${this.filteredLogs().length} evento(s) encontrado(s). Exibindo página ${this.currentPage()} de ${this.totalPages()}.`,
  );
  readonly activeFilterSummary = computed(() => {
    const { search, entityType, action, actor, from, to } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      entityType ? `Entidade: ${entityType}` : '',
      action ? `Ação: ${action}` : '',
      actor ? `Ator: ${actor}` : '',
      from ? `De: ${formatDate(from)}` : '',
      to ? `Até: ${formatDate(to)}` : '',
    ].filter(Boolean).join(' • ');
  });

  ngOnInit(): void {
    this.loadLogs();
    this.filtersForm.valueChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.currentPage.set(1);
    });
  }

  loadLogs(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    this.auditService.list().subscribe({
      next: (response) => {
        this.logs.set(this.listItems(response));
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar a auditoria.'));
        this.logs.set([]);
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', entityType: '', action: '', actor: '', from: '', to: '' }, { emitEvent: false });
    this.currentPage.set(1);
  }

  changePage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  logDate(log: AuditLog): string {
    return formatDate(log.createdAt ?? log.occurredAt ?? log.timestamp ?? log.date ?? log.updatedAt);
  }

  actorLabel(log: AuditLog): string {
    return this.personLabel(log.actor) ||
      this.personLabel(log.user) ||
      this.personLabel(log.performedBy) ||
      log.actorName ||
      log.userName ||
      log.userEmail ||
      'Não informado';
  }

  entityLabel(log: AuditLog): string {
    const entity = log.entityType || log.entity || log.entityName || log.resource || log.tableName;
    return [entity, log.entityId].filter(Boolean).join(' #') || 'Não informado';
  }

  actionLabel(log: AuditLog): string {
    const value = log.action || log.event || log.operation || log.method;
    return value ? formatLabel(value) : 'Não informado';
  }

  summaryLabel(log: AuditLog): string {
    return log.summary || log.description || log.message || log.details || this.metadataSummary(log) || 'Resumo não informado';
  }

  trackLog = (item: AuditLog) => item.id ?? `${this.logDate(item)}-${this.actorLabel(item)}-${this.actionLabel(item)}-${this.entityLabel(item)}`;

  private logTimestamp(log: AuditLog): number | null {
    const value = log.createdAt ?? log.occurredAt ?? log.timestamp ?? log.date ?? log.updatedAt;
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }

  private personLabel(person: AuditActor | string | null | undefined): string {
    if (!person) return '';
    if (typeof person === 'string') return person;
    return [person.name, person.email].filter(Boolean).join(' - ');
  }

  private metadataSummary(log: AuditLog): string {
    if (!log.metadata) return '';

    const values = Object.entries(log.metadata)
      .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
      .slice(0, 3)
      .map(([key, value]) => `${formatLabel(key)}: ${value}`);

    return values.join(' • ');
  }

  private listItems(response: unknown): AuditLog[] {
    if (Array.isArray(response)) return response as AuditLog[];
    if (!response || typeof response !== 'object') return [];

    const body = response as Record<string, unknown>;
    const directKeys = ['items', 'data', 'results', 'audits', 'logs', 'records', 'content'];

    for (const key of directKeys) {
      const value = body[key];
      if (Array.isArray(value)) return value as AuditLog[];
    }

    for (const key of ['data', 'result', 'payload']) {
      const nested = body[key];
      if (nested && typeof nested === 'object') {
        const nestedItems = this.listItems(nested);
        if (nestedItems.length) return nestedItems;
      }
    }

    return [];
  }
}
