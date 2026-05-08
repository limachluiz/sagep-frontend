import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import {
  ResponsiveTableActionsDirective,
  ResponsiveTableCellDirective,
  ResponsiveTableColumn,
  ResponsiveTableComponent,
} from '../../shared/components/responsive-table.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import {
  buildEstimateIdentifier,
  formatCurrency,
  formatDate,
  formatLabel,
} from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { Estimate, EstimateListResponse, EstimateStatus } from './estimate.model';
import { EstimatesService } from './estimates.service';

@Component({
  selector: 'app-estimates-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AccessDeniedStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    ResponsiveTableActionsDirective,
    ResponsiveTableCellDirective,
    ResponsiveTableComponent,
    StatusBadgeComponent,
  ],
  template: `
    <section class="estimates-workspace">
      <app-page-header
        title="Estimativas"
        eyebrow="Estimativas"
        subtitle="Fila atual de estimativas com filtros, paginação e acesso ao detalhe."
      >
        @if (canCreateEstimate()) {
          <a page-header-actions routerLink="/estimates/new" class="btn btn-gold">
            Nova estimativa
          </a>
        }
      </app-page-header>

      <section class="card">
        <form [formGroup]="filtersForm" class="filters estimates-filters">
          <input
            type="search"
            formControlName="search"
            class="input"
            placeholder="Buscar por projeto, OM, ata ou observações"
          />
          <select formControlName="status" class="select">
            <option value="">Todos os status</option>
            @for (status of statusOptions; track status) {
              <option [value]="status">{{ formatLabel(status) }}</option>
            }
          </select>
          <input
            type="number"
            min="1"
            formControlName="projectCode"
            class="input"
            placeholder="Código do projeto"
          />
          <input
            type="number"
            min="1"
            formControlName="omCode"
            class="input"
            placeholder="Código da OM"
          />
          <button type="button" (click)="clearFilters()" class="btn btn-ghost">
            Limpar filtros
          </button>
        </form>
      </section>

      @if (loading()) {
        <app-loading-state variant="list" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar estimativas."
          description="A API retornou acesso negado para esta listagem. Sua sessão permanece ativa e você pode seguir usando os módulos disponíveis."
          primaryLink="/dashboard"
          secondaryLink="/projects"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar as estimativas"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadEstimates()"
        />
      } @else if (!estimates().length) {
        <app-empty-state
          title="Nenhuma estimativa encontrada com os filtros atuais"
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
                <span class="badge b-neutral">
                  {{ activeFilterSummary() }}
                </span>
              }
            </div>
            <span>Dados atualizados</span>
          </div>

          <app-responsive-table
            [columns]="columns"
            [data]="estimates()"
            [trackBy]="trackEstimate"
            emptyTitle="Nenhuma estimativa encontrada"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="estimate" let-estimate>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">
                EST-{{ estimate.estimateCode }}
              </p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">
                {{ estimate.notes || 'Sem observações cadastradas.' }}
              </p>
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-estimate>
              <app-status-badge [label]="formatLabel(estimate.status)" [status]="estimate.status" />
            </ng-template>
            <ng-template appResponsiveTableCell="project" let-estimate>
              <p class="font-medium text-[var(--sagep-brand-deep)]">
                #{{ estimate.project?.projectCode || estimate.projectCode }}
              </p>
              <p class="mt-1 text-[var(--sagep-muted)]">
                {{ estimate.project?.title || 'Projeto vinculado' }}
              </p>
            </ng-template>
            <ng-template appResponsiveTableCell="om" let-estimate>
              <p class="font-medium text-[var(--sagep-brand-deep)]">
                {{ estimate.om?.sigla || estimate.omName || 'Não informado' }}
              </p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ locationLabel(estimate) }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="totalAmount" let-estimate>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{
                formatCurrency(estimate.totalAmount)
              }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="updatedAt" let-estimate>
              {{ formatDate(estimate.updatedAt || estimate.createdAt) }}
            </ng-template>
            <ng-template appResponsiveTableActions let-estimate>
              <a
                [routerLink]="['/estimates', estimateIdentifier(estimate)]"
                class="btn btn-sm btn-ghost"
              >
                Ver detalhe
              </a>
            </ng-template>
          </app-responsive-table>

          <div class="estimates-pagination">
            <div class="pagination-size">
              <span>Itens por página</span>
              <select
                [value]="pageSize()"
                (change)="changePageSize($any($event.target).value)"
                class="select"
              >
                @for (option of pageSizeOptions; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>
            <div class="pagination-actions">
              <button
                type="button"
                [disabled]="!canGoPrevious()"
                (click)="changePage(currentPage() - 1)"
                class="btn btn-ghost"
              >
                Anterior
              </button>
              <span>Página {{ currentPage() }} de {{ totalPages() }}</span>
              <button
                type="button"
                [disabled]="!canGoNext()"
                (click)="changePage(currentPage() + 1)"
                class="btn btn-ghost"
              >
                Próxima
              </button>
            </div>
          </div>
        </section>
      }
    </section>
  `,
})
export class EstimatesPageComponent implements OnInit {
  private readonly estimatesService = inject(EstimatesService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly response = signal<EstimateListResponse | null>(null);
  readonly pageSize = signal(10);

  readonly statusOptions: EstimateStatus[] = ['RASCUNHO', 'FINALIZADA', 'CANCELADA'];
  readonly pageSizeOptions = [10, 20, 50];
  readonly columns: ResponsiveTableColumn[] = [
    { key: 'estimate', label: 'Estimativa' },
    { key: 'status', label: 'Status' },
    { key: 'project', label: 'Projeto' },
    { key: 'om', label: 'OM' },
    { key: 'totalAmount', label: 'Valor total' },
    { key: 'updatedAt', label: 'Atualizada em' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: ['' as EstimateStatus | ''],
    projectCode: [''],
    omCode: [''],
  });

  readonly estimates = computed<Estimate[]>(() => this.response()?.items ?? []);
  readonly canCreateEstimate = computed(() => {
    return this.authService.canPerformMutation(['estimates.create']);
  });
  readonly currentPage = computed(() => this.response()?.meta.page ?? 1);
  readonly totalPages = computed(() => this.response()?.meta.totalPages ?? 1);
  readonly canGoPrevious = computed(
    () => (this.response()?.meta.hasPreviousPage ?? false) && this.currentPage() > 1,
  );
  readonly canGoNext = computed(
    () => (this.response()?.meta.hasNextPage ?? false) && this.currentPage() < this.totalPages(),
  );
  readonly metaLabel = computed(() => {
    const meta = this.response()?.meta;
    if (!meta) return '';
    return `${meta.totalItems} estimativa(s) encontradas. Exibindo página ${meta.page} de ${meta.totalPages}.`;
  });
  readonly activeFilterSummary = computed(() => {
    const { search, status, projectCode, omCode } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      status ? `Status: ${formatLabel(status)}` : '',
      projectCode ? `Projeto: ${projectCode}` : '',
      omCode ? `OM: ${omCode}` : '',
    ]
      .filter(Boolean)
      .join(' • ');
  });

  ngOnInit(): void {
    this.loadEstimates();
    this.filtersForm.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.loadEstimates(1);
      });
    this.filtersForm.controls.status.valueChanges.subscribe(() => this.loadEstimates(1));
    this.filtersForm.controls.projectCode.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.loadEstimates(1);
      });
    this.filtersForm.controls.omCode.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.loadEstimates(1);
      });
  }

  loadEstimates(page = this.currentPage()): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const { search, status, projectCode, omCode } = this.filtersForm.getRawValue();

    this.estimatesService
      .list({
        page,
        pageSize: this.pageSize(),
        search: search || undefined,
        status: status || undefined,
        projectCode: projectCode ? Number(projectCode) : null,
        omCode: omCode ? Number(omCode) : null,
      })
      .subscribe({
        next: (response) => {
          this.response.set(response);
          this.loading.set(false);
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar as estimativas.'));
          this.response.set(null);
          this.loading.set(false);
        },
      });
  }

  clearFilters(): void {
    this.filtersForm.reset(
      {
        search: '',
        status: '',
        projectCode: '',
        omCode: '',
      },
      { emitEvent: false },
    );
    this.loadEstimates(1);
  }

  changePage(page: number): void {
    this.loadEstimates(page);
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.loadEstimates(1);
  }

  locationLabel(estimate: Estimate): string {
    const city = estimate.om?.cityName || estimate.destinationCityName;
    const state = estimate.om?.stateUf || estimate.destinationStateUf;
    return [city, state].filter(Boolean).join(' / ') || 'Não informado';
  }

  estimateIdentifier(estimate: Estimate): string {
    return buildEstimateIdentifier(estimate.estimateCode, estimate.id, estimate.createdAt);
  }

  trackEstimate(estimate: Estimate): string {
    return estimate.id;
  }

  protected readonly formatLabel = formatLabel;
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
}
