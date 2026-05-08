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
import { formatCurrency, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { AtaItem, AtaItemListResponse } from './ata-item.model';
import { AtaItemsService } from './ata-items.service';

@Component({
  selector: 'app-ata-items-page',
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
        title="Itens da ATA"
        eyebrow="Catálogo"
        subtitle="Consulta de itens precificados, vínculo com ATA, grupo de cobertura, unidade, valor e situação."
        badge="Catálogo operacional"
      />

      <section class="card">
        <form [formGroup]="filtersForm" class="filters ata-items-filters">
          <input type="search" formControlName="search" class="input" placeholder="Buscar por código, ATA, grupo ou descrição" />
          <select formControlName="status" class="select">
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <input type="search" formControlName="coverageGroup" class="input" placeholder="Grupo de cobertura" />
          <button type="button" (click)="clearFilters()" class="btn btn-ghost">
            Limpar filtros
          </button>
        </form>
      </section>

      @if (loading()) {
        <app-loading-state variant="list" [count]="3" />
      } @else if (forbidden()) {
        <app-access-denied-state
          title="Seu acesso atual não permite consultar itens da ATA."
          description="A consulta ao catálogo foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/dashboard"
          secondaryLink="/atas"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar os itens da ATA"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadAtaItems()"
        />
      } @else if (!filteredItems().length) {
        <app-empty-state
          title="Nenhum item encontrado com os filtros atuais"
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
            [data]="pagedItems()"
            [trackBy]="trackAtaItem"
            emptyTitle="Nenhum item encontrado"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="code" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ itemCode(item) }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.referenceCode || 'Sem referência' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="ata" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">{{ ataLabel(item) }}</p>
              <p class="mt-1 text-[var(--sagep-muted)]">{{ item.ata?.vendorName || 'Fornecedor não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="coverageGroup" let-item>
              {{ coverageGroupLabel(item) }}
            </ng-template>
            <ng-template appResponsiveTableCell="description" let-item>
              <p class="font-medium text-[var(--sagep-brand-deep)]">{{ item.description || 'Descrição não informada' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="unitPrice" let-item>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(item.unitPrice) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="initialQuantity" let-item>
              {{ item.initialQuantity ?? item.balance?.initialQuantity ?? 'Não informado' }}
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-item>
              <span class="badge" [class]="isActive(item) ? 'b-ok' : 'b-warn'">
                {{ isActive(item) ? 'Ativo' : 'Inativo' }}
              </span>
            </ng-template>
            <ng-template appResponsiveTableActions let-item>
              @if (ataId(item)) {
                <a [routerLink]="['/atas', ataId(item)]" class="btn btn-sm btn-ghost">
                  Ver ATA
                </a>
              }
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
export class AtaItemsPageComponent implements OnInit {
  private readonly ataItemsService = inject(AtaItemsService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly ataItems = signal<AtaItem[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'code', label: 'Código' },
    { key: 'ata', label: 'ATA' },
    { key: 'coverageGroup', label: 'Grupo de cobertura' },
    { key: 'description', label: 'Descrição' },
    { key: 'unit', label: 'Unidade' },
    { key: 'unitPrice', label: 'Valor unit.', align: 'right' },
    { key: 'initialQuantity', label: 'Qtd. inicial' },
    { key: 'status', label: 'Status' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
    coverageGroup: [''],
  });

  readonly filteredItems = computed(() => {
    const { search, status, coverageGroup } = this.filtersForm.getRawValue();
    const term = search.trim().toLowerCase();
    const groupTerm = coverageGroup.trim().toLowerCase();

    return this.ataItems().filter((item) => {
      const matchesSearch = !term ||
        [
          this.itemCode(item),
          item.referenceCode,
          item.description,
          this.ataLabel(item),
          item.ata?.vendorName,
          this.coverageGroupLabel(item),
          item.unit,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = !status || (status === 'active' ? this.isActive(item) : !this.isActive(item));
      const matchesCoverage = !groupTerm || this.coverageGroupLabel(item).toLowerCase().includes(groupTerm);

      return matchesSearch && matchesStatus && matchesCoverage;
    });
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize())));
  readonly canGoPrevious = computed(() => this.currentPage() > 1);
  readonly canGoNext = computed(() => this.currentPage() < this.totalPages());
  readonly pagedItems = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });
  readonly metaLabel = computed(() =>
    `${this.filteredItems().length} item(ns) encontrado(s). Exibindo página ${this.currentPage()} de ${this.totalPages()}.`,
  );
  readonly activeFilterSummary = computed(() => {
    const { search, status, coverageGroup } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      status === 'active' ? 'Ativos' : status === 'inactive' ? 'Inativos' : '',
      coverageGroup ? `Grupo: ${coverageGroup}` : '',
    ].filter(Boolean).join(' • ');
  });

  ngOnInit(): void {
    this.loadAtaItems();
    this.filtersForm.valueChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.currentPage.set(1);
    });
  }

  loadAtaItems(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    this.ataItemsService.list().subscribe({
      next: (response) => {
        this.ataItems.set(this.listItems(response));
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar os itens da ATA.'));
        this.ataItems.set([]);
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '', coverageGroup: '' }, { emitEvent: false });
    this.currentPage.set(1);
  }

  changePage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  itemCode(item: AtaItem): string {
    return item.ataItemCode ? `#${item.ataItemCode}` : item.referenceCode || item.id;
  }

  ataId(item: AtaItem): string {
    return item.ata?.id || item.ataId || '';
  }

  ataLabel(item: AtaItem): string {
    const ata = item.ata;
    const number = ata?.number || item.ataNumber || (ata?.ataCode || item.ataCode ? `#${ata?.ataCode || item.ataCode}` : '');
    return [ata?.type ? formatLabel(ata.type) : 'ATA', number].filter(Boolean).join(' ');
  }

  coverageGroupLabel(item: AtaItem): string {
    const group = item.coverageGroup;
    return group ? [group.code, group.name].filter(Boolean).join(' - ') || group.id : item.coverageGroupId || 'Não informado';
  }

  isActive(item: AtaItem): boolean {
    return item.isActive !== false && !item.deletedAt;
  }

  trackAtaItem = (item: AtaItem) => item.id;
  readonly formatCurrency = formatCurrency;

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }
}
