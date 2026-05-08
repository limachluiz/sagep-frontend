import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

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
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { formatCurrency, formatDate, formatLabel } from '../../shared/utils/format.util';
import { getErrorMessage, isForbiddenError } from '../../shared/utils/http-error.util';
import { AtaBalanceItem, AtaBalanceListResponse, AtaBalanceMovement } from './ata-balance.model';
import { AtaBalanceService } from './ata-balance.service';

type BalanceStatus = 'normal' | 'baixo' | 'insuficiente';

@Component({
  selector: 'app-ata-balance-page',
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
    SummaryCardComponent,
  ],
  template: `
    <section class="workspace">
      <app-page-header
        title="Saldo da ATA"
        eyebrow="Catálogo"
        subtitle="Consulta de saldo inicial, reservado, consumido e disponível dos itens das ATAs."
        badge="Painel operacional"
      />

      @if (!loading() && !forbidden() && !errorMessage()) {
        <div class="grid grid-5">
          @for (item of summaryCards(); track item.title) {
            <app-summary-card
              [title]="item.title"
              [value]="item.value"
              [description]="item.description"
              [icon]="item.icon"
              [tone]="item.tone"
            />
          }
        </div>
      }

      <section class="card">
        <form [formGroup]="filtersForm" class="filters ata-balance-filters">
          <input type="search" formControlName="search" class="input" placeholder="Buscar por ATA, item ou descrição" />
          <select formControlName="status" class="select">
            <option value="">Todos os saldos</option>
            <option value="insuficiente">Insuficiente</option>
            <option value="baixo">Saldo baixo</option>
            <option value="normal">Normal</option>
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
          title="Seu acesso atual não permite consultar saldo da ATA."
          description="A consulta ao painel de saldo foi recusada para o perfil ou permissões atuais. Sua sessão permanece ativa."
          primaryLink="/dashboard"
          secondaryLink="/atas"
        />
      } @else if (errorMessage()) {
        <app-error-state
          title="Não foi possível carregar o saldo da ATA"
          [message]="errorMessage()"
          retryLabel="Tentar novamente"
          (retry)="loadBalance()"
        />
      } @else if (!filteredItems().length) {
        <app-empty-state
          title="Nenhum saldo encontrado com os filtros atuais"
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
            [trackBy]="trackBalanceItem"
            emptyTitle="Nenhum saldo encontrado"
            emptyDescription="Ajuste a busca ou limpe os filtros para ampliar a consulta."
          >
            <ng-template appResponsiveTableCell="ata" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ ataLabel(item) }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.ata?.vendorName || 'Fornecedor não informado' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="item" let-item>
              <p class="font-semibold text-[var(--sagep-brand-deep)]">{{ itemCode(item) }}</p>
              <p class="mt-1 text-sm text-[var(--sagep-muted)]">{{ item.referenceCode || 'Sem referência' }}</p>
            </ng-template>
            <ng-template appResponsiveTableCell="description" let-item>
              {{ item.description || 'Descrição não informada' }}
            </ng-template>
            <ng-template appResponsiveTableCell="initialQuantity" let-item>
              {{ quantityLabel(initialQuantity(item), item.unit) }}
            </ng-template>
            <ng-template appResponsiveTableCell="reservedQuantity" let-item>
              {{ quantityLabel(reservedQuantity(item), item.unit) }}
            </ng-template>
            <ng-template appResponsiveTableCell="consumedQuantity" let-item>
              {{ quantityLabel(consumedQuantity(item), item.unit) }}
            </ng-template>
            <ng-template appResponsiveTableCell="availableQuantity" let-item>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ quantityLabel(availableQuantity(item), item.unit) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="availableAmount" let-item>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(availableAmount(item)) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-item>
              <span class="badge" [class]="statusClass(balanceStatus(item))">
                {{ statusLabel(balanceStatus(item)) }}
              </span>
            </ng-template>
            <ng-template appResponsiveTableActions let-item>
              <button type="button" (click)="openMovements(item)" class="btn btn-sm btn-ghost">
                Ver movimentações
              </button>
              @if (ataId(item)) {
                <a [routerLink]="['/atas', ataId(item)]" class="btn btn-sm btn-ghost">
                  Ver ATA
                </a>
              }
            </ng-template>
          </app-responsive-table>

          @if (selectedItem()) {
            <section class="ata-movement-panel">
              <div class="ata-movement-panel__head">
                <div>
                  <p class="document-action-label">Movimentações do saldo</p>
                  <h3>{{ itemCode(selectedItem()!) }} - {{ selectedItem()?.description || 'Descrição não informada' }}</h3>
                  <p>{{ ataLabel(selectedItem()!) }}</p>
                </div>
                <button type="button" (click)="closeMovements()" class="btn btn-sm btn-ghost">
                  Fechar
                </button>
              </div>

              <div class="detail-grid">
                <div class="detail-item">
                  <label>Quantidade inicial</label>
                  <b>{{ quantityLabel(initialQuantity(selectedItem()!), selectedItem()?.unit) }}</b>
                </div>
                <div class="detail-item">
                  <label>Reservado</label>
                  <b>{{ quantityLabel(reservedQuantity(selectedItem()!), selectedItem()?.unit) }}</b>
                </div>
                <div class="detail-item">
                  <label>Consumido</label>
                  <b>{{ quantityLabel(consumedQuantity(selectedItem()!), selectedItem()?.unit) }}</b>
                </div>
                <div class="detail-item highlight">
                  <label>Disponível</label>
                  <b>{{ quantityLabel(availableQuantity(selectedItem()!), selectedItem()?.unit) }}</b>
                </div>
                <div class="detail-item">
                  <label>Valor disponível</label>
                  <b>{{ formatCurrency(availableAmount(selectedItem()!)) }}</b>
                </div>
                <div class="detail-item">
                  <label>Status</label>
                  <b>{{ statusLabel(balanceStatus(selectedItem()!)) }}</b>
                </div>
              </div>

              @if (movementsLoading()) {
                <div class="card">
                  <div class="card-body">
                    <app-loading-state variant="list" [count]="2" />
                  </div>
                </div>
              } @else if (movementsError()) {
                <div class="form-alert">{{ movementsError() }}</div>
              } @else if (movements().length) {
                <div class="document-list">
                  @for (movement of movements(); track movementTrack(movement, $index)) {
                    <article class="document-item">
                      <b>{{ movementLabel(movement) }}</b>
                      <div class="ata-movement-grid">
                        <span><strong>Quantidade</strong>{{ quantityLabel(numberValue(movement.quantity), selectedItem()?.unit) }}</span>
                        <span><strong>Valor unitário</strong>{{ formatCurrency(movement.unitPrice) }}</span>
                        <span><strong>Valor total</strong>{{ formatCurrency(movement.totalPrice ?? movement.amount) }}</span>
                        <span><strong>Resumo</strong>{{ movement.summary || movement.description || movement.source || 'Movimentação registrada.' }}</span>
                        <span><strong>Ator</strong>{{ actorLabel(movement) }}</span>
                        <span><strong>Projeto</strong>{{ projectLabel(movement) }}</span>
                        <span><strong>Estimativa</strong>{{ estimateLabel(movement) }}</span>
                        <span><strong>DIEx</strong>{{ diexLabel(movement) }}</span>
                        <span><strong>OS</strong>{{ serviceOrderLabel(movement) }}</span>
                        <span><strong>Data</strong>{{ formatDate(movement.occurredAt || movement.createdAt) }}</span>
                      </div>
                    </article>
                  }
                </div>
              } @else {
                <div class="empty">
                  <p>Nenhuma movimentação foi encontrada para este item.</p>
                </div>
              }
            </section>
          }

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
export class AtaBalancePageComponent implements OnInit {
  private readonly ataBalanceService = inject(AtaBalanceService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly items = signal<AtaBalanceItem[]>([]);
  readonly selectedItem = signal<AtaBalanceItem | null>(null);
  readonly movements = signal<AtaBalanceMovement[]>([]);
  readonly movementsLoading = signal(false);
  readonly movementsError = signal('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'ata', label: 'ATA' },
    { key: 'item', label: 'Item' },
    { key: 'description', label: 'Descrição' },
    { key: 'initialQuantity', label: 'Qtd. inicial' },
    { key: 'reservedQuantity', label: 'Reservado' },
    { key: 'consumedQuantity', label: 'Consumido' },
    { key: 'availableQuantity', label: 'Disponível' },
    { key: 'availableAmount', label: 'Valor disponível', align: 'right' },
    { key: 'status', label: 'Status' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
  });

  readonly filteredItems = computed(() => {
    const { search, status } = this.filtersForm.getRawValue();
    const term = search.trim().toLowerCase();

    return this.items().filter((item) => {
      const matchesSearch = !term ||
        [
          this.ataLabel(item),
          item.ata?.vendorName,
          this.itemCode(item),
          item.referenceCode,
          item.description,
          item.unit,
          item.coverageGroup?.code,
          item.coverageGroup?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = !status || this.balanceStatus(item) === status;

      return matchesSearch && matchesStatus;
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
    `${this.filteredItems().length} saldo(s) encontrado(s). Exibindo página ${this.currentPage()} de ${this.totalPages()}.`,
  );
  readonly activeFilterSummary = computed(() => {
    const { search, status } = this.filtersForm.getRawValue();
    return [
      search ? `Busca: ${search}` : '',
      status ? `Status: ${this.statusLabel(status as BalanceStatus)}` : '',
    ].filter(Boolean).join(' • ');
  });
  readonly summaryCards = computed(() => {
    const items = this.items();
    const critical = items.filter((item) => this.balanceStatus(item) === 'insuficiente').length;
    const lowStock = items.filter((item) => this.balanceStatus(item) === 'baixo').length;

    return [
      {
        title: 'Itens críticos',
        value: String(critical),
        description: 'Saldo insuficiente',
        icon: 'CR',
        tone: critical ? ('danger' as const) : ('success' as const),
      },
      {
        title: 'Saldo baixo',
        value: String(lowStock),
        description: 'Itens em atenção',
        icon: 'BX',
        tone: lowStock ? ('warning' as const) : ('success' as const),
      },
      {
        title: 'Total reservado',
        value: formatCurrency(this.sumAmount(items, 'reserved')),
        description: 'Valor reservado',
        icon: 'RS',
        tone: 'soft' as const,
      },
      {
        title: 'Total consumido',
        value: formatCurrency(this.sumAmount(items, 'consumed')),
        description: 'Valor consumido',
        icon: 'CN',
        tone: 'accent' as const,
      },
      {
        title: 'Total disponível',
        value: formatCurrency(this.sumAmount(items, 'available')),
        description: 'Valor em saldo',
        icon: 'SD',
        tone: 'success' as const,
      },
    ];
  });

  ngOnInit(): void {
    this.loadBalance();
    this.filtersForm.valueChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.currentPage.set(1);
    });
  }

  loadBalance(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.errorMessage.set('');

    this.ataBalanceService.list().subscribe({
      next: (response) => {
        this.items.set(this.listItems(response));
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar o saldo da ATA.'));
        this.items.set([]);
        this.loading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filtersForm.reset({ search: '', status: '' }, { emitEvent: false });
    this.currentPage.set(1);
  }

  changePage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  openMovements(item: AtaBalanceItem): void {
    this.selectedItem.set(item);
    this.movements.set([]);
    this.movementsError.set('');
    this.movementsLoading.set(true);

    this.ataBalanceService
      .getItemMovements(item.id)
      .pipe(finalize(() => this.movementsLoading.set(false)))
      .subscribe({
        next: (response) => this.movements.set(this.listItems(response)),
        error: (error) => {
          this.movementsError.set(getErrorMessage(error, 'Não foi possível carregar as movimentações deste item.'));
        },
      });
  }

  closeMovements(): void {
    this.selectedItem.set(null);
    this.movements.set([]);
    this.movementsError.set('');
    this.movementsLoading.set(false);
  }

  itemCode(item: AtaBalanceItem): string {
    return item.ataItemCode ? `#${item.ataItemCode}` : item.referenceCode || item.id;
  }

  ataId(item: AtaBalanceItem): string {
    return item.ata?.id || item.ataId || '';
  }

  ataLabel(item: AtaBalanceItem): string {
    const ata = item.ata;
    const number = ata?.number || item.ataNumber || (ata?.ataCode || item.ataCode ? `#${ata?.ataCode || item.ataCode}` : '');
    return [ata?.type ? formatLabel(ata.type) : 'ATA', number].filter(Boolean).join(' ');
  }

  balanceStatus(item: AtaBalanceItem): BalanceStatus {
    if (item.balance?.insufficient) return 'insuficiente';
    if (item.balance?.lowStock) return 'baixo';
    return 'normal';
  }

  statusLabel(status: BalanceStatus): string {
    return {
      normal: 'Normal',
      baixo: 'Saldo baixo',
      insuficiente: 'Insuficiente',
    }[status];
  }

  statusClass(status: BalanceStatus): string {
    return {
      normal: 'b-ok',
      baixo: 'b-warn',
      insuficiente: 'b-danger',
    }[status];
  }

  initialQuantity(item: AtaBalanceItem): number {
    return this.numberValue(item.balance?.initialQuantity ?? item.initialQuantity);
  }

  reservedQuantity(item: AtaBalanceItem): number {
    return this.numberValue(item.balance?.reservedQuantity);
  }

  consumedQuantity(item: AtaBalanceItem): number {
    return this.numberValue(item.balance?.consumedQuantity);
  }

  availableQuantity(item: AtaBalanceItem): number {
    return this.numberValue(item.balance?.availableQuantity);
  }

  availableAmount(item: AtaBalanceItem): number {
    const explicit = this.numberValue(item.balance?.availableAmount);
    if (explicit) return explicit;
    return this.availableQuantity(item) * this.numberValue(item.unitPrice);
  }

  quantityLabel(value: number, unit?: string | null): string {
    return `${new Intl.NumberFormat('pt-BR').format(value)}${unit ? ` ${unit}` : ''}`;
  }

  movementLabel(movement: AtaBalanceMovement): string {
    return formatLabel(movement.movementType || movement.type || 'Movimentação');
  }

  actorLabel(movement: AtaBalanceMovement): string {
    return movement.actorName || movement.actor?.name || movement.actor?.fullName || 'Não informado';
  }

  projectLabel(movement: AtaBalanceMovement): string {
    const code = movement.project?.projectCode ?? movement.projectCode ?? movement.projectNumber;
    return code ? `PRJ-${code}` : movement.project?.title || 'Não informado';
  }

  estimateLabel(movement: AtaBalanceMovement): string {
    const code = movement.estimate?.estimateCode ?? movement.estimateCode;
    return code ? `EST-${code}` : 'Não informado';
  }

  diexLabel(movement: AtaBalanceMovement): string {
    return movement.diex?.diexNumber || movement.diexNumber || (movement.diex?.diexCode || movement.diexCode ? `DIEX-${movement.diex?.diexCode || movement.diexCode}` : 'Não informado');
  }

  serviceOrderLabel(movement: AtaBalanceMovement): string {
    return movement.serviceOrder?.serviceOrderNumber ||
      movement.serviceOrderNumber ||
      (movement.serviceOrder?.serviceOrderCode || movement.serviceOrderCode ? `OS-${movement.serviceOrder?.serviceOrderCode || movement.serviceOrderCode}` : 'Não informado');
  }

  movementTrack(movement: AtaBalanceMovement, index: number): string | number {
    return movement.id || index;
  }

  trackBalanceItem = (item: AtaBalanceItem) => item.id;
  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;

  private sumAmount(items: AtaBalanceItem[], type: 'reserved' | 'consumed' | 'available'): number {
    return items.reduce((sum, item) => {
      if (type === 'available') return sum + this.availableAmount(item);

      const amount = type === 'reserved' ? item.balance?.reservedAmount : item.balance?.consumedAmount;
      const quantity = type === 'reserved' ? this.reservedQuantity(item) : this.consumedQuantity(item);
      return sum + (this.numberValue(amount) || quantity * this.numberValue(item.unitPrice));
    }, 0);
  }

  numberValue(value: unknown): number {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : 0;
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }
}
