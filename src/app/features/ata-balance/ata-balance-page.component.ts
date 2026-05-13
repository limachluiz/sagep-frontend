import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, of } from 'rxjs';

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
import { Ata } from '../atas/ata.model';
import { AtasService } from '../atas/atas.service';
import {
  AtaBalanceItem,
  AtaBalanceListResponse,
  AtaBalanceMovement,
  AtaExternalBalanceComparison,
  AtaExternalBalanceListResponse,
} from './ata-balance.model';
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

      @if (successMessage()) {
        <div class="form-alert success">{{ successMessage() }}</div>
      }

      @if (syncError()) {
        <div class="form-alert">{{ syncError() }}</div>
      }

      <section class="card">
        <form [formGroup]="filtersForm" class="filters ata-balance-filters">
          <select
            [value]="selectedAtaId()"
            (change)="selectAta($any($event.target).value)"
            class="select"
            [disabled]="atasLoading()"
          >
            <option value="">Todas as ATAs</option>
            @for (ata of sortedAtas(); track ata.id) {
              <option [value]="ata.id">{{ ataOptionLabel(ata) }}</option>
            }
          </select>
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
          <button
            type="button"
            (click)="syncSelectedAta()"
            class="btn btn-gold"
            [disabled]="!selectedAtaId() || syncingAtaId() === selectedAtaId()"
          >
            {{ syncingAtaId() === selectedAtaId() ? 'Sincronizando...' : 'Sincronizar saldo da ATA' }}
          </button>
        </form>
        @if (atasLoading()) {
          <div class="mt-3 text-sm text-[var(--sagep-muted)]">Carregando ATAs...</div>
        } @else if (atasError()) {
          <div class="form-alert">{{ atasError() }}</div>
        }
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
            <span>{{ externalLoading() ? 'Comparando saldo externo...' : 'Dados atualizados' }}</span>
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
            <ng-template appResponsiveTableCell="localInitialQuantity" let-item>
              {{ quantityLabel(initialQuantity(item), item.unit) }}
            </ng-template>
            <ng-template appResponsiveTableCell="externalRegisteredQuantity" let-item>
              {{ externalRegisteredQuantityLabel(item) }}
            </ng-template>
            <ng-template appResponsiveTableCell="externalCommittedQuantity" let-item>
              {{ externalCommittedQuantityLabel(item) }}
            </ng-template>
            <ng-template appResponsiveTableCell="externalBalance" let-item>
              {{ externalQuantityLabel(item) }}
            </ng-template>
            <ng-template appResponsiveTableCell="balanceDifference" let-item>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ externalDifferenceLabel(item) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="availableAmount" let-item>
              <span class="font-semibold text-[var(--sagep-brand-deep)]">{{ formatCurrency(availableAmount(item)) }}</span>
            </ng-template>
            <ng-template appResponsiveTableCell="status" let-item>
              <span class="badge" [class]="statusClass(balanceStatus(item))">
                {{ statusLabel(balanceStatus(item)) }}
              </span>
            </ng-template>
            <ng-template appResponsiveTableCell="externalStatus" let-item>
              <span class="badge" [class]="externalStatusClass(externalStatus(item))">
                {{ externalStatusLabel(externalStatus(item)) }}
              </span>
            </ng-template>
            <ng-template appResponsiveTableCell="lastSyncedAt" let-item>
              {{ externalLastSyncedLabel(item) }}
            </ng-template>
            <ng-template appResponsiveTableActions let-item>
              @if (ataId(item)) {
                <button
                  type="button"
                  (click)="syncExternalBalance(item)"
                  class="btn btn-sm btn-gold"
                  [disabled]="syncingAtaId() === ataId(item)"
                >
                  {{ syncingAtaId() === ataId(item) ? 'Sincronizando...' : 'Sincronizar item' }}
                </button>
              }
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
            <section id="ata-movement-panel" class="ata-movement-panel">
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

              <div class="ata-external-comparison">
                <div class="ata-movement-panel__head">
                  <div>
                    <p class="document-action-label">Comparacao externa</p>
                    <h3>Saldo Compras.gov.br</h3>
                    <p>Dados consultados pelo backend do SAGEP.</p>
                  </div>
                  @if (ataId(selectedItem()!)) {
                    <button
                      type="button"
                      (click)="syncExternalBalance(selectedItem()!)"
                      class="btn btn-sm btn-gold"
                      [disabled]="syncingAtaId() === ataId(selectedItem()!)"
                    >
                      {{ syncingAtaId() === ataId(selectedItem()!) ? 'Sincronizando...' : 'Sincronizar item' }}
                    </button>
                  }
                </div>
                @if (comparisonLoading(selectedItem()!)) {
                  <app-loading-state variant="list" [count]="1" />
                } @else if (comparisonError(selectedItem()!)) {
                  <div class="form-alert">{{ comparisonError(selectedItem()!) }}</div>
                } @else {
                  <div class="detail-grid">
                    <div class="detail-item">
                      <label>Contratada externa</label>
                      <b>{{ externalRegisteredQuantityLabel(selectedItem()!) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Consumida externa</label>
                      <b>{{ externalCommittedQuantityLabel(selectedItem()!) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Saldo externo</label>
                      <b>{{ externalQuantityLabel(selectedItem()!) }}</b>
                      @if (isNoCommitmentStatus(selectedItem()!)) {
                        <small>Sem empenho registrado</small>
                      }
                    </div>
                    <div class="detail-item">
                      <label>Diferenca</label>
                      <b>{{ externalDifferenceLabel(selectedItem()!) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Última sincronização</label>
                      <b>{{ externalLastSyncedLabel(selectedItem()!) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Status externo</label>
                      <b>{{ externalStatusLabel(externalStatus(selectedItem()!)) }}</b>
                    </div>
                  </div>
                  @if (isNoCommitmentStatus(selectedItem()!)) {
                    <div class="form-alert success">
                      Saldo baseado na quantidade registrada importada. Nenhum empenho externo encontrado.
                    </div>
                  }
                }
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
  private readonly atasService = inject(AtasService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly syncError = signal('');
  readonly atasLoading = signal(false);
  readonly atasError = signal('');
  readonly atas = signal<Ata[]>([]);
  readonly selectedAtaId = signal('');
  readonly items = signal<AtaBalanceItem[]>([]);
  readonly selectedItem = signal<AtaBalanceItem | null>(null);
  readonly movements = signal<AtaBalanceMovement[]>([]);
  readonly movementsLoading = signal(false);
  readonly movementsError = signal('');
  readonly externalComparisons = signal<Record<string, AtaExternalBalanceComparison | null>>({});
  readonly externalComparisonErrors = signal<Record<string, string>>({});
  readonly externalComparisonMeta = signal<Record<string, AtaExternalBalanceListResponse>>({});
  readonly externalLoading = signal(false);
  readonly syncingAtaId = signal('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'ata', label: 'ATA' },
    { key: 'item', label: 'Item' },
    { key: 'description', label: 'Descrição' },
    { key: 'localInitialQuantity', label: 'Qtd. inicial local' },
    { key: 'externalRegisteredQuantity', label: 'Contratada externa' },
    { key: 'externalCommittedQuantity', label: 'Consumida externa' },
    { key: 'externalBalance', label: 'Saldo externo' },
    { key: 'balanceDifference', label: 'Diferença' },
    { key: 'externalStatus', label: 'Status externo' },
    { key: 'lastSyncedAt', label: 'Última sync' },
  ];

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
  });

  readonly sortedAtas = computed(() =>
    [...this.atas()].sort((left, right) => Number(this.isComprasGovAta(right)) - Number(this.isComprasGovAta(left))),
  );
  readonly selectedAtaItems = computed(() => {
    const selectedAtaId = this.selectedAtaId();
    return selectedAtaId ? this.items().filter((item) => this.ataId(item) === selectedAtaId) : this.items();
  });
  readonly filteredItems = computed(() => {
    const { search, status } = this.filtersForm.getRawValue();
    const term = search.trim().toLowerCase();

    return this.selectedAtaItems().filter((item) => {
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
    const items = this.selectedAtaItems();
    const critical = items.filter((item) => this.balanceStatus(item) === 'insuficiente').length;
    const lowStock = items.filter((item) => this.balanceStatus(item) === 'baixo').length;
    const noCommitment = items.filter((item) => this.isNoCommitmentStatus(item)).length;

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
        title: 'Sem empenho registrado',
        value: String(noCommitment),
        description: 'Sem empenho externo',
        icon: 'SE',
        tone: noCommitment ? ('success' as const) : ('soft' as const),
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
    this.loadAtas();
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
        const items = this.listItems(response);
        this.items.set(items);
        this.currentPage.set(1);
        this.loading.set(false);
        if (this.selectedAtaId()) {
          this.loadAtaExternalBalance(this.selectedAtaId());
        } else {
          this.loadExternalComparisons(items);
        }
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar o saldo da ATA.'));
        this.items.set([]);
        this.externalComparisons.set({});
        this.externalComparisonErrors.set({});
        this.externalComparisonMeta.set({});
        this.loading.set(false);
      },
    });
  }

  loadAtas(): void {
    this.atasLoading.set(true);
    this.atasError.set('');

    this.atasService
      .list()
      .pipe(finalize(() => this.atasLoading.set(false)))
      .subscribe({
        next: (response) => this.atas.set(this.listItems(response)),
        error: (error) => {
          this.atas.set([]);
          this.atasError.set(getErrorMessage(error, 'Nao foi possivel carregar as ATAs para selecao.'));
        },
      });
  }

  selectAta(ataId: string): void {
    this.selectedAtaId.set(ataId);
    this.currentPage.set(1);
    this.closeMovements();
    this.syncError.set('');
    this.successMessage.set('');

    if (ataId) {
      this.loadAtaExternalBalance(ataId);
    } else {
      this.loadExternalComparisons(this.items());
    }
  }

  syncSelectedAta(): void {
    const ataId = this.selectedAtaId();

    if (!ataId) {
      return;
    }

    this.syncAtaExternalBalance(ataId);
  }

  syncExternalBalance(item: AtaBalanceItem): void {
    const ataId = this.ataId(item);

    this.syncAtaExternalBalance(ataId, item.id);
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
    this.loadItemBalanceComparison(item);
    this.focusMovementPanel();

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

  ataOptionLabel(ata: Ata): string {
    const number = ata.number || (ata.ataCode ? `#${ata.ataCode}` : 'ATA sem numero');
    const vendor = ata.vendorName || 'Fornecedor nao informado';
    const bidding = [this.ataStringField(ata, ['uasg', 'uAsg']), this.biddingLabel(ata)].filter(Boolean).join(' - ');

    return [number, vendor, bidding].filter(Boolean).join(' | ');
  }

  isComprasGovAta(ata: Ata): boolean {
    const values = [
      this.ataStringField(ata, ['source', 'origin', 'externalSource', 'integrationSource']),
      ata.observations,
      ata.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();

    return values.includes('COMPRAS') || values.includes('COMPRAS_GOV');
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

  comparison(item: AtaBalanceItem): AtaExternalBalanceComparison | null {
    return this.externalComparisons()[item.id] ?? null;
  }

  comparisonLoading(item: AtaBalanceItem): boolean {
    return this.externalLoading() && !(item.id in this.externalComparisons());
  }

  comparisonError(item: AtaBalanceItem): string {
    return this.externalComparisonErrors()[item.id] || '';
  }

  localComparisonLabel(item: AtaBalanceItem): string {
    const comparison = this.comparison(item);
    const value = comparison?.localBalance ?? comparison?.localAvailableQuantity ?? comparison?.availableQuantity;
    return this.quantityLabel(value == null ? this.availableQuantity(item) : this.numberValue(value), item.unit);
  }

  externalRegisteredQuantityLabel(item: AtaBalanceItem): string {
    return this.externalQuantityFieldLabel(item, 'registeredQuantity');
  }

  externalCommittedQuantityLabel(item: AtaBalanceItem): string {
    return this.externalQuantityFieldLabel(item, 'committedQuantity');
  }

  externalQuantityLabel(item: AtaBalanceItem): string {
    const value = this.externalAvailableQuantityValue(item);

    return value == null ? this.externalMissingLabel(item) : this.quantityLabel(this.numberValue(value), item.unit);
  }

  externalDifferenceLabel(item: AtaBalanceItem): string {
    const comparison = this.comparison(item);
    const value = comparison?.difference ?? comparison?.balanceDifference;

    if (value == null) {
      return this.externalMissingLabel(item);
    }

    return this.quantityLabel(this.numberValue(value), item.unit);
  }

  externalStatus(item: AtaBalanceItem): string {
    return this.comparison(item)?.status || 'NOT_SYNCED';
  }

  externalStatusLabel(status: string): string {
    const normalized = status.toUpperCase();
    return {
      OK: 'OK',
      DIVERGENT: 'Divergente',
      DIVERGENTE: 'Divergente',
      EXTERNAL_CONSUMPTION_DETECTED: 'Consumo externo detectado',
      CONSUMO_EXTERNO_DETECTADO: 'Consumo externo detectado',
      SEM_EMPENHO_REGISTRADO: 'Sem empenho registrado',
      NOT_FOUND: 'Nao encontrado',
      NAO_ENCONTRADO: 'Nao encontrado',
      ERRO_CONSULTA_EXTERNA: 'Erro na consulta externa',
      NOT_SYNCED: 'Nao sincronizado',
    }[normalized] ?? formatLabel(status);
  }

  externalStatusClass(status: string): string {
    const normalized = status.toUpperCase();

    if (normalized === 'OK') return 'b-ok';
    if (normalized === 'SEM_EMPENHO_REGISTRADO') return 'b-ok';
    if (normalized === 'NOT_FOUND' || normalized === 'NAO_ENCONTRADO') return 'b-neutral';
    if (normalized === 'NOT_SYNCED') return 'b-info';
    if (normalized === 'EXTERNAL_CONSUMPTION_DETECTED' || normalized === 'CONSUMO_EXTERNO_DETECTADO') return 'b-warn';
    if (normalized === 'ERRO_CONSULTA_EXTERNA') return 'b-danger';
    return 'b-danger';
  }

  externalLastSyncedLabel(item: AtaBalanceItem): string {
    return formatDate(this.externalLastSyncValue(item));
  }

  isNoCommitmentStatus(item: AtaBalanceItem): boolean {
    return this.externalStatus(item).toUpperCase() === 'SEM_EMPENHO_REGISTRADO';
  }

  private externalQuantityFieldLabel(
    item: AtaBalanceItem,
    field: 'registeredQuantity' | 'committedQuantity' | 'availableQuantity',
  ): string {
    const value = this.externalBalanceValue(item, field);
    return value == null ? this.externalMissingLabel(item) : this.quantityLabel(this.numberValue(value), item.unit);
  }

  private externalBalanceValue(
    item: AtaBalanceItem,
    field: 'registeredQuantity' | 'committedQuantity' | 'availableQuantity',
  ): string | number | null | undefined {
    const externalBalance = this.comparison(item)?.externalBalance;

    if (externalBalance && typeof externalBalance === 'object') {
      return externalBalance[field];
    }

    return undefined;
  }

  private externalAvailableQuantityValue(item: AtaBalanceItem): string | number | null | undefined {
    return this.externalBalanceValue(item, 'availableQuantity');
  }

  private externalMissingLabel(item: AtaBalanceItem): string {
    const normalized = this.externalStatus(item).toUpperCase();
    return normalized === 'NOT_FOUND' || normalized === 'NAO_ENCONTRADO' ? 'Nao encontrado' : 'Nao sincronizado';
  }

  private externalLastSyncValue(item: AtaBalanceItem): string | null | undefined {
    const comparison = this.comparison(item);
    const ataId = this.ataId(item);
    const ataMeta = this.externalComparisonMeta()[ataId];
    const selectedAta = this.atas().find((ata) => ata.id === ataId);

    return [
      comparison?.lastSyncAt ??
        comparison?.lastSyncedAt ??
        comparison?.syncedAt,
      comparison?.itemComparison?.lastSyncAt,
      comparison?.item?.lastSyncAt ?? item.lastSyncAt,
      comparison?.ata?.externalLastSyncAt ?? item.ata?.externalLastSyncAt,
      ataMeta?.comparedAt ?? comparison?.comparedAt,
      this.ataStringField(selectedAta, ['externalLastSyncAt']),
      ataMeta?.externalLastSyncAt,
      comparison?.externalLastSyncAt,
      comparison?.updatedAt,
      ataMeta?.lastSyncAt,
      ataMeta?.lastSyncedAt,
    ].find((value) => Boolean(value));
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

  private syncAtaExternalBalance(ataId: string, itemId?: string): void {
    if (!ataId || this.syncingAtaId()) {
      return;
    }

    this.syncingAtaId.set(ataId);
    this.syncError.set('');
    this.successMessage.set('');
    this.ataBalanceService
      .syncAtaExternalBalance(ataId)
      .subscribe({
        next: (response) => {
          const warnings = this.responseWarnings(response);
          const syncedComparisons = this.externalComparisonItems(response);

          this.applyAtaExternalComparisons(ataId, syncedComparisons, response);
          this.successMessage.set(this.syncSuccessMessage(warnings));

          this.ataBalanceService
            .getAtaExternalBalance(ataId)
            .pipe(finalize(() => this.syncingAtaId.set('')))
            .subscribe({
              next: (confirmedResponse) => {
                this.applyAtaExternalComparisons(ataId, this.externalComparisonItems(confirmedResponse), confirmedResponse);
                this.successMessage.set(this.syncSuccessMessage(warnings));
              },
              error: (error) => {
                const message = getErrorMessage(error, 'Nao foi possivel confirmar o saldo externo atualizado desta ATA.');
                this.successMessage.set(this.syncSuccessMessage([...warnings, message]));

                if (itemId) {
                  this.externalComparisonErrors.update((errors) => ({
                    ...errors,
                    [itemId]: message,
                  }));
                }
              },
            });
        },
        error: (error) => {
          const message = getErrorMessage(error, 'Nao foi possivel sincronizar o saldo externo desta ATA.');
          this.syncError.set(message);
          this.syncingAtaId.set('');

          if (itemId) {
            this.externalComparisonErrors.update((errors) => ({
              ...errors,
              [itemId]: message,
            }));
          }
        },
      });
  }

  private loadAtaExternalBalance(ataId: string): void {
    const ataItems = this.items().filter((item) => this.ataId(item) === ataId);

    if (!ataId || !ataItems.length) {
      return;
    }

    this.externalLoading.set(true);
    this.ataBalanceService
      .getAtaExternalBalance(ataId)
      .pipe(finalize(() => this.externalLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.applyAtaExternalComparisons(ataId, this.externalComparisonItems(response), response);
        },
        error: (error) => {
          const message = getErrorMessage(error, 'Nao foi possivel carregar a comparacao externa desta ATA.');
          this.externalComparisonErrors.update((errors) => {
            const nextErrors = { ...errors };
            ataItems.forEach((item) => {
              nextErrors[item.id] = message;
            });
            return nextErrors;
          });
        },
      });
  }

  private loadExternalComparisons(items: AtaBalanceItem[]): void {
    const uniqueItems = items.filter((item, index, source) => source.findIndex((entry) => entry.id === item.id) === index);

    if (!uniqueItems.length) {
      return;
    }

    this.externalLoading.set(true);

    forkJoin(
      uniqueItems.map((item) =>
        this.ataBalanceService.getItemBalanceComparison(item.id).pipe(
          catchError((error) => {
            this.externalComparisonErrors.update((errors) => ({
              ...errors,
              [item.id]: getErrorMessage(error, 'Nao foi possivel carregar a comparacao externa deste item.'),
            }));
            return of(null);
          }),
        ),
      ),
    )
      .pipe(finalize(() => this.externalLoading.set(false)))
      .subscribe((comparisons) => {
        const nextComparisons = { ...this.externalComparisons() };
        const nextErrors = { ...this.externalComparisonErrors() };

        comparisons.forEach((comparison, index) => {
          const item = uniqueItems[index];
          nextComparisons[item.id] = comparison;

          if (comparison) {
            delete nextErrors[item.id];
          }
        });

        this.externalComparisons.set(nextComparisons);
        this.externalComparisonErrors.set(nextErrors);
      });
  }

  private loadItemBalanceComparison(item: AtaBalanceItem): void {
    this.externalLoading.set(true);
    this.externalComparisons.update((comparisons) => {
      const nextComparisons = { ...comparisons };
      delete nextComparisons[item.id];
      return nextComparisons;
    });
    this.externalComparisonErrors.update((errors) => {
      const nextErrors = { ...errors };
      delete nextErrors[item.id];
      return nextErrors;
    });

    this.ataBalanceService
      .getItemBalanceComparison(item.id)
      .pipe(finalize(() => this.externalLoading.set(false)))
      .subscribe({
        next: (comparison) => {
          this.externalComparisons.update((comparisons) => ({
            ...comparisons,
            [item.id]: comparison,
          }));
        },
        error: (error) => {
          this.externalComparisonErrors.update((errors) => ({
            ...errors,
            [item.id]: getErrorMessage(error, 'Nao foi possivel carregar a comparacao externa deste item.'),
          }));
        },
      });
  }

  private applyAtaExternalComparisons(
    ataId: string,
    comparisons: AtaExternalBalanceComparison[],
    response?: AtaExternalBalanceListResponse | AtaExternalBalanceComparison[],
  ): void {
    const ataItems = this.items().filter((item) => this.ataId(item) === ataId);

    if (!ataItems.length) {
      return;
    }

    if (response && !Array.isArray(response)) {
      this.externalComparisonMeta.update((meta) => ({
        ...meta,
        [ataId]: response,
      }));
    }

    const nextComparisons = { ...this.externalComparisons() };
    const nextErrors = { ...this.externalComparisonErrors() };

    ataItems.forEach((item, index) => {
      const comparison = this.findComparisonForItem(comparisons, item, index);

      if (comparison) {
        nextComparisons[item.id] = this.withResponseLastSyncFallback(comparison, response);
        delete nextErrors[item.id];
      }
    });

    this.externalComparisons.set(nextComparisons);
    this.externalComparisonErrors.set(nextErrors);

    const selected = this.selectedItem();
    if (selected && this.ataId(selected) === ataId) {
      this.selectedItem.set(this.items().find((item) => item.id === selected.id) ?? selected);
    }
  }

  private withResponseLastSyncFallback(
    comparison: AtaExternalBalanceComparison,
    response?: AtaExternalBalanceListResponse | AtaExternalBalanceComparison[],
  ): AtaExternalBalanceComparison {
    const comparedAt = Array.isArray(response) ? null : response?.comparedAt;

    if (comparison.lastSyncAt || !comparedAt) {
      return comparison;
    }

    return {
      ...comparison,
      lastSyncAt: comparedAt,
    };
  }

  private findComparisonForItem(
    comparisons: AtaExternalBalanceComparison[],
    item: AtaBalanceItem,
    index: number,
  ): AtaExternalBalanceComparison | null {
    return (
      comparisons.find((entry) => [entry.itemId, entry.ataItemId, entry.id].includes(item.id)) ??
      comparisons[index] ??
      null
    );
  }

  private responseWarnings(response: AtaExternalBalanceListResponse): string[] {
    const entries = [...(response.warnings ?? []), ...(response.errors ?? [])];
    return entries
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        return entry.message || entry.detail || '';
      })
      .filter(Boolean);
  }

  private syncSuccessMessage(warnings: string[]): string {
    if (!warnings.length) {
      return 'Saldo externo da ATA sincronizado com sucesso.';
    }

    return `Saldo externo da ATA sincronizado com sucesso parcial. Avisos: ${warnings.join(' | ')}`;
  }

  private focusMovementPanel(): void {
    setTimeout(() => {
      if (typeof document === 'undefined') {
        return;
      }

      document.getElementById('ata-movement-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private externalComparisonItems(
    response: AtaExternalBalanceListResponse | AtaExternalBalanceComparison[],
  ): AtaExternalBalanceComparison[] {
    if (Array.isArray(response)) {
      return response;
    }

    return response.items ?? response.comparisons ?? [];
  }

  private ataStringField(ata: Ata | null | undefined, keys: string[]): string {
    if (!ata) {
      return '';
    }

    const record = ata as unknown as Record<string, unknown>;
    const value = keys.map((key) => record[key]).find((entry) => typeof entry === 'string' || typeof entry === 'number');
    return value == null ? '' : String(value);
  }

  private biddingLabel(ata: Ata): string {
    const number = this.ataStringField(ata, ['numeroPregao', 'biddingNumber', 'pregaoNumber', 'auctionNumber']);
    const year = this.ataStringField(ata, ['anoPregao', 'biddingYear', 'pregaoYear', 'auctionYear']);

    return [number, year].filter(Boolean).join('/');
  }
}
