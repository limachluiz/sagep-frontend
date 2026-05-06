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
    <section class="space-y-6">
      <app-page-header
        title="Base inicial de consulta de estimativas"
        eyebrow="Estimativas"
        subtitle="Integração com GET /estimates para leitura da fila atual sem implementar criação, edição ou finalização nesta etapa."
      >
        @if (canCreateEstimate()) {
          <a
            page-header-actions
            routerLink="/estimates/new"
            class="inline-flex rounded-[14px] bg-[linear-gradient(135deg,var(--sagep-brand),var(--sagep-brand-dark))] px-5 py-3 text-sm font-bold text-white shadow-[var(--sagep-shadow-soft)] transition hover:-translate-y-0.5"
          >
            Nova estimativa
          </a>
        }
        <form page-header-actions [formGroup]="filtersForm" class="grid w-full gap-4 xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto]">
          <input
            type="search"
            formControlName="search"
            class="w-full rounded-[14px] border border-[var(--sagep-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--sagep-brand-mid)] focus:ring-4 focus:ring-[rgba(82,102,43,0.12)]"
            placeholder="Buscar por projeto, OM, ata ou observações"
          />
          <select
            formControlName="status"
            class="w-full rounded-[14px] border border-[var(--sagep-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--sagep-brand-mid)] focus:ring-4 focus:ring-[rgba(82,102,43,0.12)]"
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
            class="w-full rounded-[14px] border border-[var(--sagep-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--sagep-brand-mid)] focus:ring-4 focus:ring-[rgba(82,102,43,0.12)]"
            placeholder="Código do projeto"
          />
          <input
            type="number"
            min="1"
            formControlName="omCode"
            class="w-full rounded-[14px] border border-[var(--sagep-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--sagep-brand-mid)] focus:ring-4 focus:ring-[rgba(82,102,43,0.12)]"
            placeholder="Código da OM"
          />
          <button
            type="button"
            (click)="clearFilters()"
            class="rounded-[14px] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] px-5 py-3 text-sm font-semibold text-[var(--sagep-brand-dark)] transition hover:border-[var(--sagep-brand-mid)] hover:bg-[var(--sagep-brand-soft)]"
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
        <div class="rounded-[var(--sagep-radius)] border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] p-5 shadow-[var(--sagep-shadow-soft)]">
          <div class="mb-5 flex flex-col gap-3 rounded-[18px] border border-[var(--sagep-line)] bg-[var(--sagep-surface-subtle)] px-5 py-4 text-sm text-[var(--sagep-muted)] lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ metaLabel() }}</span>
              @if (activeFilterSummary()) {
                <span class="rounded-full border border-[var(--sagep-line)] bg-[var(--sagep-surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sagep-muted)]">
                  {{ activeFilterSummary() }}
                </span>
              }
            </div>
            <div class="text-xs font-black uppercase tracking-[0.18em] text-[var(--sagep-muted-soft)]">Fonte: GET /estimates</div>
          </div>

          <app-responsive-table
            [columns]="columns"
            [data]="estimates()"
            [trackBy]="trackEstimate"
            emptyTitle="Nenhuma estimativa encontrada"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="estimate" let-estimate>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">EST-{{ estimate.estimateCode }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ estimate.notes || 'Sem observações cadastradas.' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-estimate>
              <app-status-badge [label]="formatLabel(estimate.status)" [status]="estimate.status" />
            </ng-template>
            <ng-template appResponsiveTableCell="project" let-estimate>
              <p class="font-medium text-[var(--sagep-brand-deep)]">#{{ estimate.project?.projectCode || estimate.projectCode }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ estimate.project?.title || 'Projeto vinculado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="om" let-estimate>
              <p class="font-medium text-[var(--sagep-brand-deep)]">{{ estimate.om?.sigla || estimate.omName || 'Não informado' }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ locationLabel(estimate) }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="totalAmount" let-estimate>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(estimate.totalAmount) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="updatedAt" let-estimate>
              {{ formatDate(estimate.updatedAt || estimate.createdAt) }}
            </ng-template>
            <ng-template appResponsiveTableActions let-estimate>
              <a
                [routerLink]="['/estimates', estimateIdentifier(estimate)]"
                class="inline-flex rounded-[12px] border border-[var(--sagep-line)] px-4 py-2 text-sm font-semibold text-[var(--sagep-brand-dark)] transition hover:border-[var(--sagep-brand-mid)] hover:bg-[var(--sagep-brand-soft)]"
              >
                Ver detalhe
              </a>
            </ng-template>
          </app-responsive-table>

          <div class="mt-5 flex flex-col gap-4 border-t border-[var(--sagep-line)] pt-5 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex items-center gap-3 text-sm text-[var(--sagep-muted)]">
              <span>Itens por página</span>
              <select
                [value]="pageSize()"
                (change)="changePageSize($any($event.target).value)"
                class="rounded-[12px] border border-[var(--sagep-line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--sagep-brand-mid)]"
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
                class="rounded-[12px] border border-[var(--sagep-line)] px-4 py-2 text-sm font-semibold text-[var(--sagep-brand-dark)] transition hover:border-[var(--sagep-brand-mid)] hover:bg-[var(--sagep-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <span class="px-3 text-sm text-[var(--sagep-muted)]">Página {{ currentPage() }} de {{ totalPages() }}</span>
              <button
                type="button"
                [disabled]="!canGoNext()"
                (click)="changePage(currentPage() + 1)"
                class="rounded-[12px] border border-[var(--sagep-line)] px-4 py-2 text-sm font-semibold text-[var(--sagep-brand-dark)] transition hover:border-[var(--sagep-brand-mid)] hover:bg-[var(--sagep-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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
    const role = this.authService.getUserRole();
    return this.authService.hasAnyPermission(['estimates.create']) || role === 'ADMIN' || role === 'GESTOR' || role === 'PROJETISTA';
  });
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
