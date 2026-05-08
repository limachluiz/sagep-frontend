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
import { formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { Diex, DiexListResponse } from './diex.model';
import { DiexService } from './diex.service';

@Component({
  selector: 'app-diex-page',
  standalone: true,
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
  ],
  template: `
    <section class="workspace">
      <app-page-header
        title="DIEx Requisitório"
        eyebrow="Documentos"
        subtitle="Listagem operacional de DIEx com busca, filtros simples, paginação e navegação para o detalhe."
        badge="Documento"
      />

      <section class="card">
        <form [formGroup]="filtersForm" class="filters estimates-filters">
          <input
            type="search"
            formControlName="search"
            class="input"
            placeholder="Buscar por número, fornecedor, requisitante ou observações"
          />
          <input
            type="number"
            min="1"
            formControlName="code"
            class="input"
            placeholder="Código do DIEx"
          />
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
            formControlName="estimateCode"
            class="input"
            placeholder="Código da estimativa"
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
          title="Seu acesso atual não permite consultar DIEx."
          description="A API retornou acesso negado para esta listagem. Sua sessão permanece ativa e você pode seguir usando os demais módulos."
          primaryLink="/dashboard"
          secondaryLink="/projects"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar os DIEx"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadDiex()"
        />
      } @else if (!diex().length) {
        <app-empty-state
          title="Nenhum DIEx encontrado com os filtros atuais"
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
            [data]="diex()"
            [trackBy]="trackDiex"
            emptyTitle="Nenhum DIEx encontrado"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="diex" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ diexIdentifier(item) }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.diexNumber || 'Número ainda não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="project" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">PRJ-{{ item.projectCode }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.project?.title || 'Projeto vinculado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="estimate" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">EST-{{ item.estimateCode }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.estimate?.status ? formatLabel(item.estimate?.status || '') : 'Estimativa vinculada' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="supplier" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">{{ supplierLabel(item) }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.supplierCnpj || 'CNPJ não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="totalAmount" let-item>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ totalAmountLabel(item) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="issuedAt" let-item>
              {{ formatDate(item.issuedAt || item.createdAt) }}
            </ng-template>
            <ng-template appResponsiveTableActions let-item>
              <a [routerLink]="['/diex', diexIdentifier(item)]" class="btn btn-sm btn-ghost">
                Ver detalhe
              </a>
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
export class DiexPageComponent implements OnInit {
  private readonly diexService = inject(DiexService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly response = signal<DiexListResponse | null>(null);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'diex', label: 'DIEx' },
    { key: 'project', label: 'Projeto' },
    { key: 'estimate', label: 'Estimativa' },
    { key: 'supplier', label: 'Fornecedor' },
    { key: 'totalAmount', label: 'Valor total', align: 'right' },
    { key: 'issuedAt', label: 'Emitido em' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    code: [''],
    projectCode: [''],
    estimateCode: [''],
  });

  readonly diex = computed<Diex[]>(() => this.response()?.items ?? []);
  readonly currentPage = computed(() => this.response()?.meta.page ?? 1);
  readonly totalPages = computed(() => this.response()?.meta.totalPages ?? 1);
  readonly canGoPrevious = computed(() => (this.response()?.meta.hasPreviousPage ?? false) && this.currentPage() > 1);
  readonly canGoNext = computed(() => (this.response()?.meta.hasNextPage ?? false) && this.currentPage() < this.totalPages());
  readonly metaLabel = computed(() => {
    const meta = this.response()?.meta;
    if (!meta) return '';
    return `${meta.totalItems} DIEx encontrado(s). Exibindo página ${meta.page} de ${meta.totalPages}.`;
  });
  readonly activeFilterSummary = computed(() => {
    const { search, code, projectCode, estimateCode } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      code ? `DIEx: ${code}` : '',
      projectCode ? `Projeto: ${projectCode}` : '',
      estimateCode ? `Estimativa: ${estimateCode}` : '',
    ].filter(Boolean).join(' • ');
  });

  ngOnInit(): void {
    this.loadDiex();
    this.filtersForm.controls.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadDiex(1));
    this.filtersForm.controls.code.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadDiex(1));
    this.filtersForm.controls.projectCode.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadDiex(1));
    this.filtersForm.controls.estimateCode.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadDiex(1));
  }

  loadDiex(page = this.currentPage()): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const { search, code, projectCode, estimateCode } = this.filtersForm.getRawValue();

    this.diexService
      .list({
        page,
        pageSize: this.pageSize(),
        search: search || undefined,
        code: code ? Number(code) : null,
        projectCode: projectCode ? Number(projectCode) : null,
        estimateCode: estimateCode ? Number(estimateCode) : null,
      })
      .subscribe({
        next: (response) => {
          this.response.set(response);
          this.loading.set(false);
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar os DIEx.'));
          this.response.set(null);
          this.loading.set(false);
        },
      });
  }

  clearFilters(): void {
    this.filtersForm.reset(
      {
        search: '',
        code: '',
        projectCode: '',
        estimateCode: '',
      },
      { emitEvent: false },
    );
    this.loadDiex(1);
  }

  changePage(page: number): void {
    this.loadDiex(page);
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.loadDiex(1);
  }

  supplierLabel(item: Diex): string {
    return item.estimate?.ata?.vendorName || item.estimate?.om?.sigla || item.requesterName || 'Fornecedor vinculado';
  }

  totalAmountLabel(item: Diex): string {
    const total = item.totalAmount ?? item.estimate?.totalAmount;
    return formatCurrency(total);
  }

  diexIdentifier(item: Diex): string {
    const year = this.yearFromDate(item.createdAt || item.issuedAt);
    const code = Number(item.diexCode);

    if (year && Number.isFinite(code)) {
      return `DIEX-${year}-${String(code).padStart(4, '0')}`;
    }

    return item.id;
  }

  trackDiex = (item: Diex) => item.id;
  readonly formatDate = formatDate;
  readonly formatLabel = formatLabel;

  private yearFromDate(value: unknown): number | null {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.getFullYear();
  }
}
