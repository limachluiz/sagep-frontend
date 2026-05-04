import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

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
    <section class="space-y-6">
      <app-page-header
        title="Base inicial de consulta de estimativas"
        eyebrow="Estimativas"
        subtitle="Integração com GET /estimates para leitura da fila atual sem implementar criação, edição ou finalização nesta etapa."
      >
        <form page-header-actions [formGroup]="filtersForm" class="grid w-full gap-4 xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto]">
          <input
            type="search"
            formControlName="search"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
            placeholder="Buscar por projeto, OM, ata ou observações"
          />
          <select
            formControlName="status"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
          >
            <option value="">Todos os status</option>
            @for (status of statusOptions; track status) {
              <option [value]="status">{{ formatLabel(status) }}</option>
            }
          </select>
          <input
            type="number"
            min="1"
            formControlName="projectCode"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
            placeholder="Código do projeto"
          />
          <input
            type="number"
            min="1"
            formControlName="omCode"
            class="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-600 focus:bg-white"
            placeholder="Código da OM"
          />
          <button
            type="button"
            (click)="clearFilters()"
            class="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Limpar filtros
          </button>
        </form>
      </app-page-header>

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
          title="Nao foi possivel carregar as estimativas"
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
        <div class="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[var(--sagep-shadow)]">
          <div class="mb-5 flex flex-col gap-3 rounded-3xl bg-slate-50 px-5 py-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-medium text-slate-900">{{ metaLabel() }}</span>
              @if (activeFilterSummary()) {
                <span class="rounded-full border border-slate-300 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-600">
                  {{ activeFilterSummary() }}
                </span>
              }
            </div>
            <div class="text-xs uppercase tracking-[0.18em] text-slate-500">Fonte: GET /estimates</div>
          </div>

          <app-responsive-table
            [columns]="columns"
            [data]="estimates()"
            [trackBy]="trackEstimate"
            emptyTitle="Nenhuma estimativa encontrada"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="estimate" let-estimate>
              <p class="font-semibold text-slate-900">EST-{{ estimate.estimateCode }}</p>
              <p class="mt-1 text-sm text-slate-500">{{ estimate.notes || 'Sem observacoes cadastradas.' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-estimate>
              <app-status-badge [label]="formatLabel(estimate.status)" [status]="estimate.status" />
            </ng-template>
            <ng-template appResponsiveTableCell="project" let-estimate>
              <p class="font-medium text-slate-900">#{{ estimate.project?.projectCode || estimate.projectCode }}</p>
              <p class="mt-1 text-slate-500">{{ estimate.project?.title || 'Projeto vinculado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="om" let-estimate>
              <p class="font-medium text-slate-900">{{ estimate.om?.sigla || estimate.omName || 'Nao informado' }}</p>
              <p class="mt-1 text-slate-500">{{ locationLabel(estimate) }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="totalAmount" let-estimate>
              <span class="font-semibold text-slate-900">{{ formatCurrency(estimate.totalAmount) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="updatedAt" let-estimate>
              {{ formatDate(estimate.updatedAt || estimate.createdAt) }}
            </ng-template>
            <ng-template appResponsiveTableActions let-estimate>
              <a
                [routerLink]="['/estimates', estimateIdentifier(estimate)]"
                class="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                Ver detalhe
              </a>
            </ng-template>
          </app-responsive-table>

          <div class="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex items-center gap-3 text-sm text-slate-600">
              <span>Itens por página</span>
              <select
                [value]="pageSize()"
                (change)="changePageSize($any($event.target).value)"
                class="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600"
              >
                @for (option of pageSizeOptions; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                [disabled]="!canGoPrevious()"
                (click)="changePage(currentPage() - 1)"
                class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                Anterior
              </button>
              <span class="px-3 text-sm text-slate-600">Página {{ currentPage() }} de {{ totalPages() }}</span>
              <button
                type="button"
                [disabled]="!canGoNext()"
                (click)="changePage(currentPage() + 1)"
                class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class EstimatesPageComponent implements OnInit {
  private readonly estimatesService = inject(EstimatesService);
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
  readonly currentPage = computed(() => this.response()?.meta.page ?? 1);
  readonly totalPages = computed(() => this.response()?.meta.totalPages ?? 1);
  readonly canGoPrevious = computed(() => (this.response()?.meta.hasPreviousPage ?? false) && this.currentPage() > 1);
  readonly canGoNext = computed(() => (this.response()?.meta.hasNextPage ?? false) && this.currentPage() < this.totalPages());
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
    this.filtersForm.controls.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.loadEstimates(1);
    });
    this.filtersForm.controls.status.valueChanges.subscribe(() => this.loadEstimates(1));
    this.filtersForm.controls.projectCode.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.loadEstimates(1);
    });
    this.filtersForm.controls.omCode.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
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
    return [city, state].filter(Boolean).join(' / ') || 'Nao informado';
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
