import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { AccessDeniedStateComponent } from '../../shared/components/access-denied-state.component';
import { formatCurrency, formatDate, formatLabel, getStatusBadgeClasses } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { Estimate, EstimateListResponse, EstimateStatus } from './estimate.model';
import { EstimatesService } from './estimates.service';

@Component({
  selector: 'app-estimates-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AccessDeniedStateComponent],
  template: `
    <section class="space-y-6">
      <div class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[var(--sagep-shadow)]">
        <div class="flex flex-col gap-6">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Estimativas</p>
            <h1 class="mt-3 text-3xl font-semibold text-slate-950">Base inicial de consulta de estimativas</h1>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Integração com <code>GET /estimates</code> para leitura da fila atual sem implementar criação, edição ou finalização nesta etapa.
            </p>
          </div>

          <form [formGroup]="filtersForm" class="grid gap-4 xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto]">
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
        </div>
      </div>

      @if (loading()) {
        <div class="grid gap-4">
          @for (item of [1, 2, 3]; track item) {
            <div class="h-28 animate-pulse rounded-[2rem] border border-slate-200 bg-white/80 shadow-[var(--sagep-shadow)]"></div>
          }
        </div>
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar estimativas."
          description="A API retornou acesso negado para esta listagem. Sua sessão permanece ativa e você pode seguir usando os módulos disponíveis."
          primaryLink="/dashboard"
          secondaryLink="/projects"
        />
      } @else if (errorMessage()) {
        <div class="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700 shadow-[var(--sagep-shadow)]">
          <h2 class="text-lg font-semibold">Nao foi possivel carregar as estimativas</h2>
          <p class="mt-2 text-sm leading-6">{{ errorMessage() }}</p>
          <button
            type="button"
            (click)="loadEstimates()"
            class="mt-5 rounded-full border border-red-300 px-5 py-2 text-sm font-medium text-red-700 transition hover:border-red-500"
          >
            Tentar novamente
          </button>
        </div>
      } @else if (!estimates().length) {
        <div class="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-[var(--sagep-shadow)]">
          <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Nenhum resultado</p>
          <h2 class="mt-3 text-2xl font-semibold text-slate-900">Nenhuma estimativa encontrada com os filtros atuais</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">Ajuste a busca ou limpe os filtros para ampliar a consulta.</p>
          <button
            type="button"
            (click)="clearFilters()"
            class="mt-6 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Limpar filtros
          </button>
        </div>
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

          <div class="hidden overflow-x-auto lg:block">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr class="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                  <th class="px-5 py-4">Estimativa</th>
                  <th class="px-5 py-4">Status</th>
                  <th class="px-5 py-4">Projeto</th>
                  <th class="px-5 py-4">OM</th>
                  <th class="px-5 py-4">Valor total</th>
                  <th class="px-5 py-4">Atualizada em</th>
                  <th class="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (estimate of estimates(); track estimate.id) {
                  <tr class="align-top transition hover:bg-slate-50/80">
                    <td class="px-5 py-4">
                      <p class="font-semibold text-slate-900">EST-{{ estimate.estimateCode }}</p>
                      <p class="mt-1 text-sm text-slate-500">{{ estimate.notes || 'Sem observacoes cadastradas.' }}</p>
                    </td>
                    <td class="px-5 py-4 text-sm text-slate-700">
                      <span class="inline-flex rounded-full border px-3 py-1 font-medium" [class]="statusBadge(estimate.status)">
                        {{ formatLabel(estimate.status) }}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-sm text-slate-700">
                      <p class="font-medium text-slate-900">#{{ estimate.project?.projectCode || estimate.projectCode }}</p>
                      <p class="mt-1 text-slate-500">{{ estimate.project?.title || 'Projeto vinculado' }}</p>
                    </td>
                    <td class="px-5 py-4 text-sm text-slate-700">
                      <p class="font-medium text-slate-900">{{ estimate.om?.sigla || estimate.omName || 'Nao informado' }}</p>
                      <p class="mt-1 text-slate-500">{{ locationLabel(estimate) }}</p>
                    </td>
                    <td class="px-5 py-4 text-sm font-semibold text-slate-900">{{ formatCurrency(estimate.totalAmount) }}</td>
                    <td class="px-5 py-4 text-sm text-slate-700">{{ formatDate(estimate.updatedAt || estimate.createdAt) }}</td>
                    <td class="px-5 py-4 text-right">
                      <a
                        [routerLink]="['/estimates', estimate.id]"
                        class="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                      >
                        Ver detalhe
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="grid gap-4 lg:hidden">
            @for (estimate of estimates(); track estimate.id) {
              <article class="rounded-[1.5rem] border border-slate-200 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-semibold text-slate-900">EST-{{ estimate.estimateCode }}</p>
                    <p class="mt-1 text-sm text-slate-500">{{ estimate.project?.title || 'Projeto vinculado' }}</p>
                  </div>
                  <span class="inline-flex rounded-full border px-3 py-1 text-xs font-medium" [class]="statusBadge(estimate.status)">
                    {{ formatLabel(estimate.status) }}
                  </span>
                </div>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div class="rounded-2xl bg-slate-50 p-3">
                    <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Projeto</p>
                    <p class="mt-2 text-sm font-medium text-slate-900">#{{ estimate.project?.projectCode || estimate.projectCode }}</p>
                  </div>
                  <div class="rounded-2xl bg-slate-50 p-3">
                    <p class="text-xs uppercase tracking-[0.18em] text-slate-500">OM</p>
                    <p class="mt-2 text-sm font-medium text-slate-900">{{ estimate.om?.sigla || estimate.omName || 'Nao informado' }}</p>
                  </div>
                  <div class="rounded-2xl bg-slate-50 p-3">
                    <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Valor total</p>
                    <p class="mt-2 text-sm font-medium text-slate-900">{{ formatCurrency(estimate.totalAmount) }}</p>
                  </div>
                  <div class="rounded-2xl bg-slate-50 p-3">
                    <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Atualizada em</p>
                    <p class="mt-2 text-sm font-medium text-slate-900">{{ formatDate(estimate.updatedAt || estimate.createdAt) }}</p>
                  </div>
                </div>
                <a
                  [routerLink]="['/estimates', estimate.id]"
                  class="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Abrir detalhe
                </a>
              </article>
            }
          </div>

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

  statusBadge(status: string): string {
    return getStatusBadgeClasses(status);
  }

  protected readonly formatLabel = formatLabel;
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
}
