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
import { ServiceOrder, ServiceOrderListResponse } from './service-order.model';
import { ServiceOrdersService } from './service-orders.service';

@Component({
  selector: 'app-service-orders-page',
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
        title="Ordens de Serviço"
        eyebrow="Documentos"
        subtitle="Listagem operacional integrada a GET /service-orders com filtros simples, paginação e navegação para o detalhe."
        badge="Fonte: GET /service-orders"
      />

      <section class="card">
        <form [formGroup]="filtersForm" class="filters estimates-filters">
          <input type="search" formControlName="search" class="input" placeholder="Buscar por número, contratada, requisitante ou observações" />
          <input type="number" min="1" formControlName="code" class="input" placeholder="Código da OS" />
          <input type="number" min="1" formControlName="projectCode" class="input" placeholder="Código do projeto" />
          <input type="number" min="1" formControlName="estimateCode" class="input" placeholder="Código da estimativa" />
          <input type="number" min="1" formControlName="diexCode" class="input" placeholder="Código do DIEx" />
          <select formControlName="emergency" class="select">
            <option value="">Todas as OS</option>
            <option value="true">Somente emergenciais</option>
            <option value="false">Somente não emergenciais</option>
          </select>
          <button type="button" (click)="clearFilters()" class="btn btn-ghost">
            Limpar filtros
          </button>
        </form>
      </section>

      @if (loading()) {
        <app-loading-state variant="list" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar ordens de serviço."
          description="A API retornou acesso negado para esta listagem. Sua sessão permanece ativa e você pode seguir usando os demais módulos."
          primaryLink="/dashboard"
          secondaryLink="/projects"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar as ordens de serviço"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadServiceOrders()"
        />
      } @else if (!serviceOrders().length) {
        <app-empty-state
          title="Nenhuma ordem de serviço encontrada com os filtros atuais"
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
            <span>Fonte: GET /service-orders</span>
          </div>

          <app-responsive-table
            [columns]="columns"
            [data]="serviceOrders()"
            [trackBy]="trackServiceOrder"
            emptyTitle="Nenhuma ordem de serviço encontrada"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="serviceOrder" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ serviceOrderIdentifier(item) }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.serviceOrderNumber || 'Número ainda não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="project" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">PRJ-{{ item.projectCode }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.project?.title || 'Projeto vinculado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="estimate" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">EST-{{ item.estimateCode }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.estimate?.status ? formatLabel(item.estimate?.status || '') : 'Estimativa vinculada' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="diex" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">
                {{ item.diexRequest?.diexNumber || (item.diexCode ? 'DIEX-' + item.diexCode : 'Sem DIEx') }}
              </p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.diexRequest?.issuedAt ? formatDate(item.diexRequest?.issuedAt) : 'Sem emissão vinculada' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="contractor" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">{{ item.contractorName || item.estimate?.ata?.vendorName || 'Contratada vinculada' }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.contractorCnpj || 'CNPJ não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="totalAmount" let-item>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ totalAmountLabel(item) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="issuedAt" let-item>
              {{ formatDate(item.issuedAt || item.createdAt) }}
            </ng-template>
            <ng-template appResponsiveTableActions let-item>
              <a [routerLink]="['/service-orders', serviceOrderIdentifier(item)]" class="btn btn-sm btn-ghost">
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
export class ServiceOrdersPageComponent implements OnInit {
  private readonly serviceOrdersService = inject(ServiceOrdersService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly response = signal<ServiceOrderListResponse | null>(null);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'serviceOrder', label: 'Ordem de Serviço' },
    { key: 'project', label: 'Projeto' },
    { key: 'estimate', label: 'Estimativa' },
    { key: 'diex', label: 'DIEx' },
    { key: 'contractor', label: 'Contratada' },
    { key: 'totalAmount', label: 'Valor total', align: 'right' },
    { key: 'issuedAt', label: 'Emitida em' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    code: [''],
    projectCode: [''],
    estimateCode: [''],
    diexCode: [''],
    emergency: [''],
  });

  readonly serviceOrders = computed<ServiceOrder[]>(() => this.response()?.items ?? []);
  readonly currentPage = computed(() => this.response()?.meta.page ?? 1);
  readonly totalPages = computed(() => this.response()?.meta.totalPages ?? 1);
  readonly canGoPrevious = computed(() => (this.response()?.meta.hasPreviousPage ?? false) && this.currentPage() > 1);
  readonly canGoNext = computed(() => (this.response()?.meta.hasNextPage ?? false) && this.currentPage() < this.totalPages());
  readonly metaLabel = computed(() => {
    const meta = this.response()?.meta;
    if (!meta) return '';
    return `${meta.totalItems} ordem(ns) de serviço encontrada(s). Exibindo página ${meta.page} de ${meta.totalPages}.`;
  });
  readonly activeFilterSummary = computed(() => {
    const { search, code, projectCode, estimateCode, diexCode, emergency } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      code ? `OS: ${code}` : '',
      projectCode ? `Projeto: ${projectCode}` : '',
      estimateCode ? `Estimativa: ${estimateCode}` : '',
      diexCode ? `DIEx: ${diexCode}` : '',
      emergency === 'true' ? 'Emergencial' : emergency === 'false' ? 'Não emergencial' : '',
    ].filter(Boolean).join(' • ');
  });

  ngOnInit(): void {
    this.loadServiceOrders();
    this.filtersForm.controls.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadServiceOrders(1));
    this.filtersForm.controls.code.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadServiceOrders(1));
    this.filtersForm.controls.projectCode.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadServiceOrders(1));
    this.filtersForm.controls.estimateCode.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadServiceOrders(1));
    this.filtersForm.controls.diexCode.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.loadServiceOrders(1));
    this.filtersForm.controls.emergency.valueChanges.subscribe(() => this.loadServiceOrders(1));
  }

  loadServiceOrders(page = this.currentPage()): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    const { search, code, projectCode, estimateCode, diexCode, emergency } = this.filtersForm.getRawValue();

    this.serviceOrdersService
      .list({
        page,
        pageSize: this.pageSize(),
        search: search || undefined,
        code: code ? Number(code) : null,
        projectCode: projectCode ? Number(projectCode) : null,
        estimateCode: estimateCode ? Number(estimateCode) : null,
        diexCode: diexCode ? Number(diexCode) : null,
        emergency: emergency === '' ? null : emergency === 'true',
      })
      .subscribe({
        next: (response) => {
          this.response.set(response);
          this.loading.set(false);
        },
        error: (error) => {
          this.forbidden.set(isForbiddenError(error));
          this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar as ordens de serviço.'));
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
        diexCode: '',
        emergency: '',
      },
      { emitEvent: false },
    );
    this.loadServiceOrders(1);
  }

  changePage(page: number): void {
    this.loadServiceOrders(page);
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.loadServiceOrders(1);
  }

  totalAmountLabel(item: ServiceOrder): string {
    return formatCurrency(item.totalAmount ?? item.estimate?.totalAmount);
  }

  serviceOrderIdentifier(item: ServiceOrder): string {
    return item.serviceOrderNumber || item.id;
  }

  trackServiceOrder = (item: ServiceOrder) => item.id;
  readonly formatDate = formatDate;
  readonly formatLabel = formatLabel;
}

