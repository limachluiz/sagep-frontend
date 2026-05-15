import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
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
import { Ata } from '../atas/ata.model';
import { AtasService } from '../atas/atas.service';
import {
  AtaBalanceItem,
  AtaBalanceListResponse,
  AtaBalanceMovement,
  AtaExternalAdhesionBalance,
  AtaExternalBalanceCommitment,
  AtaExternalBalanceComparison,
  AtaExternalBalanceListResponse,
  AtaExternalBalancePayload,
  AtaExternalManagedBalance,
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

      @if (selectedAtaRateLimitMessage()) {
        <div class="form-alert warning">{{ selectedAtaRateLimitMessage() }}</div>
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
            [disabled]="!selectedAtaId() || isSelectedAtaSyncing() || isAtaSyncCoolingDown(selectedAtaId())"
          >
            {{ isSelectedAtaSyncing() ? 'Sincronizando...' : 'Sincronizar saldo da ATA' }}
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
            <ng-template appResponsiveTableCell="syncStatus" let-item>
              <span class="badge" [class]="syncStatusClass(syncStatus(item))">
                {{ syncStatusLabel(syncStatus(item)) }}
              </span>
            </ng-template>
            <ng-template appResponsiveTableCell="externalSituation" let-item>
              <span class="badge" [class]="externalUsageStatusClass(externalUsageStatus(item))">
                {{ externalUsageStatusLabel(externalUsageStatus(item)) }}
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
                  [disabled]="syncingItemId() === item.id || isItemSyncCoolingDown(item.id)"
                >
                  {{ syncingItemId() === item.id ? 'Sincronizando...' : 'Sincronizar item' }}
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
            <div class="ata-movement-modal" (click)="closeMovements()">
            <section
              class="ata-movement-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ata-movement-title"
              (click)="$event.stopPropagation()"
            >
              <div class="ata-movement-panel__head">
                <div>
                  <p class="document-action-label">Movimentações do saldo</p>
                  <h3 id="ata-movement-title">{{ itemCode(selectedItem()!) }} - {{ selectedItem()?.description || 'Descrição não informada' }}</h3>
                  <p>{{ ataLabel(selectedItem()!) }}</p>
                </div>
                <button type="button" (click)="closeMovements()" class="btn btn-sm btn-ghost">
                  Fechar
                </button>
              </div>

              <section class="ata-balance-block">
                <div class="ata-movement-panel__head">
                  <div>
                    <h3>Controle interno do SAGEP</h3>
                    <p>Dados salvos no banco do SAGEP: reservas, consumos e saldo controlados pelo sistema.</p>
                  </div>
                </div>
                <div class="detail-grid">
                  <div class="detail-item">
                    <label>Quantidade cadastrada no SAGEP</label>
                    <b>{{ quantityLabel(initialQuantity(selectedItem()!), selectedItem()?.unit) }}</b>
                  </div>
                  <div class="detail-item">
                    <label>Reservado no SAGEP</label>
                    <b>{{ quantityLabel(reservedQuantity(selectedItem()!), selectedItem()?.unit) }}</b>
                  </div>
                  <div class="detail-item">
                    <label>Consumido no SAGEP</label>
                    <b>{{ quantityLabel(consumedQuantity(selectedItem()!), selectedItem()?.unit) }}</b>
                  </div>
                  <div class="detail-item highlight">
                    <label>Disponível no SAGEP</label>
                    <b>{{ quantityLabel(availableQuantity(selectedItem()!), selectedItem()?.unit) }}</b>
                  </div>
                  <div class="detail-item">
                    <label>Valor disponível no SAGEP</label>
                    <b>{{ formatCurrency(availableAmount(selectedItem()!)) }}</b>
                  </div>
                  <div class="detail-item">
                    <label>Status interno</label>
                    <b>{{ statusLabel(balanceStatus(selectedItem()!)) }}</b>
                  </div>
                </div>
              </section>

              <div class="ata-external-comparison">
                <div class="ata-movement-panel__head">
                  <div>
                    <h3>Consulta oficial Compras.gov.br</h3>
                    <p>Dados consultados na fonte oficial. Servem para conferência e não alteram o banco do SAGEP automaticamente.</p>
                  </div>
                  @if (ataId(selectedItem()!)) {
                    <button
                      type="button"
                      (click)="syncExternalBalance(selectedItem()!)"
                      class="btn btn-sm btn-gold"
                      [disabled]="syncingItemId() === selectedItem()!.id || isItemSyncCoolingDown(selectedItem()!.id)"
                    >
                      {{ syncingItemId() === selectedItem()!.id ? 'Sincronizando...' : 'Sincronizar item' }}
                    </button>
                  }
                </div>
                @if (comparisonLoading(selectedItem()!)) {
                  <app-loading-state variant="list" [count]="1" />
                } @else if (comparisonError(selectedItem()!)) {
                  <div class="form-alert">{{ comparisonError(selectedItem()!) }}</div>
                } @else if (!comparison(selectedItem()!)) {
                  <div class="form-alert warning">Ainda não sincronizado com Compras.gov.br.</div>
                } @else {
                  <div class="detail-grid">
                    <div class="detail-item">
                      <label>Quantidade registrada na fonte oficial</label>
                      <b>{{ externalRegisteredQuantityLabel(selectedItem()!) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Quantidade usada na fonte oficial</label>
                      <b>{{ externalCommittedQuantityLabel(selectedItem()!) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Saldo informado pela fonte oficial</label>
                      <b>{{ externalQuantityLabel(selectedItem()!) }}</b>
                      @if (isNoCommitmentStatus(selectedItem()!)) {
                        <small class="detail-note">Sem empenho registrado</small>
                      }
                    </div>
                    <div class="detail-item">
                      <label>Diferença entre SAGEP e fonte oficial</label>
                      <b>{{ externalDifferenceLabel(selectedItem()!) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Última sincronização</label>
                      <b>{{ externalLastSyncedLabel(selectedItem()!) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Status da consulta</label>
                      <b>{{ syncStatusLabel(syncStatus(selectedItem()!)) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Situação na fonte oficial</label>
                      <b>{{ externalUsageStatusLabel(externalUsageStatus(selectedItem()!)) }}</b>
                    </div>
                    <div class="detail-item">
                      <label>Valor estimado</label>
                      <b>{{ externalEstimatedAmountLabel(selectedItem()!) }}</b>
                    </div>
                  </div>
                  @if (isNoCommitmentStatus(selectedItem()!)) {
                    <div class="form-alert success">
                      Saldo baseado na quantidade registrada importada. Nenhum empenho externo encontrado.
                    </div>
                  }
                  @if (hasExternalDifferenceAlert(selectedItem()!)) {
                    <div class="form-alert warning">
                      Há diferença entre o controle interno do SAGEP e a fonte oficial. Revise antes de lançar qualquer baixa no sistema.
                    </div>
                  }
                  @if (externalUsageAlert(selectedItem()!); as usageAlert) {
                    <div class="form-alert warning">
                      {{ usageAlert }}
                    </div>
                  }
                  @if (itemRateLimitMessage(selectedItem()!)) {
                    <div class="form-alert warning">
                      {{ itemRateLimitMessage(selectedItem()!) }}
                    </div>
                  }
                  @if (hasManagedBalanceDetails(selectedItem()!)) {
                    <section class="ata-commitments ata-balance-block">
                      <div class="ata-movement-panel__head">
                        <div>
                          <h3>Saldo da gerenciadora</h3>
                        </div>
                      </div>
                      <div class="detail-grid">
                        <div class="detail-item">
                          <label>Unidade gerenciadora</label>
                          <b>{{ managedBalanceUnitLabel(selectedItem()!) }}</b>
                        </div>
                        <div class="detail-item">
                          <label>Quantidade contratada</label>
                          <b>{{ managedBalanceRegisteredQuantityLabel(selectedItem()!) }}</b>
                        </div>
                        <div class="detail-item">
                          <label>Quantidade empenhada</label>
                          <b>{{ managedBalanceCommittedQuantityLabel(selectedItem()!) }}</b>
                        </div>
                        <div class="detail-item">
                          <label>Saldo para empenho</label>
                          <b>{{ managedBalanceAvailableQuantityLabel(selectedItem()!) }}</b>
                        </div>
                        <div class="detail-item">
                          <label>Status de sincronização</label>
                          <b>{{ syncStatusLabel(syncStatus(selectedItem()!)) }}</b>
                        </div>
                        <div class="detail-item">
                          <label>Situação externa</label>
                          <b>{{ externalUsageStatusLabel(externalUsageStatus(selectedItem()!)) }}</b>
                        </div>
                      </div>
                    </section>
                  }
                  @if (managedExternalCommitments(selectedItem()!).length) {
                    <section class="ata-commitments">
                      <div class="ata-movement-panel__head">
                        <div>
                          <h3>Empenhos da gerenciadora</h3>
                        </div>
                      </div>
                      <div class="ata-commitment-table-wrap">
                        <table class="ata-commitment-table">
                          <thead>
                            <tr>
                              <th>NE</th>
                              <th>Unidade</th>
                              <th>Fornecedor</th>
                              <th>Data</th>
                              <th>Quantidade</th>
                              <th>Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                        @for (commitment of managedExternalCommitments(selectedItem()!); track commitmentTrack(commitment, $index)) {
                          <tr>
                            <td>{{ commitmentNumberLabel(commitment) }}</td>
                            <td>{{ commitmentUnitLabel(commitment) }}</td>
                            <td>{{ commitmentSupplierLabel(commitment) }}</td>
                            <td>{{ commitmentDateLabel(commitment) }}</td>
                            <td>{{ commitmentQuantityLabel(commitment, selectedItem()?.unit) }}</td>
                            <td>{{ commitmentValueLabel(commitment) }}</td>
                          </tr>
                        }
                          </tbody>
                        </table>
                      </div>
                    </section>
                  }
                  @if (hasAdhesionBalanceDetails(selectedItem()!)) {
                    <section class="ata-commitments ata-balance-block">
                      <div class="ata-movement-panel__head">
                        <div>
                          <h3>Adesões / caronas</h3>
                        </div>
                      </div>
                      <div class="detail-grid">
                        <div class="detail-item">
                          <label>Limite para adesão</label>
                          <b>{{ adhesionLimitQuantityLabel(selectedItem()!) }}</b>
                        </div>
                        <div class="detail-item">
                          <label>Aprovado por adesão</label>
                          <b>{{ adhesionApprovedQuantityLabel(selectedItem()!) }}</b>
                        </div>
                        <div class="detail-item">
                          <label>Empenhado por adesão</label>
                          <b>{{ adhesionCommittedQuantityLabel(selectedItem()!) }}</b>
                        </div>
                        <div class="detail-item">
                          <label>Saldo para adesão</label>
                          <b>{{ adhesionAvailableQuantityLabel(selectedItem()!) }}</b>
                        </div>
                        <div class="detail-item detail-item--wide">
                          <label>Órgãos que aderiram</label>
                          <b>{{ adhesionOrganizationsCountLabel(selectedItem()!) }}</b>
                          <p>{{ adhesionOrganizationsLabel(selectedItem()!) }}</p>
                        </div>
                      </div>
                    </section>
                  }
                  @if (nonParticipantExternalCommitments(selectedItem()!).length) {
                    <section class="ata-commitments">
                      <div class="ata-movement-panel__head">
                        <div>
                          <h3>Empenhos de adesões/caronas</h3>
                        </div>
                      </div>
                      <div class="ata-commitment-table-wrap">
                        <table class="ata-commitment-table">
                          <thead>
                            <tr>
                              <th>NE</th>
                              <th>Unidade</th>
                              <th>Fornecedor</th>
                              <th>Data</th>
                              <th>Quantidade</th>
                              <th>Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                        @for (commitment of nonParticipantExternalCommitments(selectedItem()!); track commitmentTrack(commitment, $index)) {
                          <tr>
                            <td>{{ commitmentNumberLabel(commitment) }}</td>
                            <td>{{ commitmentUnitLabel(commitment) }}</td>
                            <td>{{ commitmentSupplierLabel(commitment) }}</td>
                            <td>{{ commitmentDateLabel(commitment) }}</td>
                            <td>{{ commitmentQuantityLabel(commitment, selectedItem()?.unit) }}</td>
                            <td>{{ commitmentValueLabel(commitment) }}</td>
                          </tr>
                        }
                          </tbody>
                        </table>
                      </div>
                    </section>
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
            </div>
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
  readonly externalRateLimitMessages = signal<Record<string, string>>({});
  readonly syncCooldownUntil = signal<Record<string, number>>({});
  readonly cooldownTick = signal(0);
  readonly externalLoading = signal(false);
  readonly syncingAtaId = signal('');
  readonly syncingItemId = signal('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 20, 50];

  readonly columns: ResponsiveTableColumn[] = [
    { key: 'ata', label: 'ATA' },
    { key: 'item', label: 'Item' },
    { key: 'description', label: 'Descrição' },
    { key: 'localInitialQuantity', label: 'Qtd. inicial local' },
    { key: 'externalRegisteredQuantity', label: 'Contratada externa' },
    { key: 'externalCommittedQuantity', label: 'Consumida externa total' },
    { key: 'externalBalance', label: 'Saldo externo informativo' },
    { key: 'balanceDifference', label: 'Diferença' },
    { key: 'syncStatus', label: 'Sync' },
    { key: 'externalSituation', label: 'Situação externa' },
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

  @HostListener('document:keydown.escape')
  closeMovementsOnEscape(): void {
    if (this.selectedItem()) {
      this.closeMovements();
    }
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
      },
      error: (error) => {
        this.forbidden.set(isForbiddenError(error));
        this.errorMessage.set(getErrorMessage(error, 'Falha ao consultar o saldo da ATA.'));
        this.items.set([]);
        this.externalComparisons.set({});
        this.externalComparisonErrors.set({});
        this.externalComparisonMeta.set({});
        this.externalRateLimitMessages.set({});
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
  }

  syncSelectedAta(): void {
    const ataId = this.selectedAtaId();

    if (!ataId) {
      return;
    }

    this.syncAtaExternalBalance(ataId);
  }

  isSelectedAtaSyncing(): boolean {
    const ataId = this.selectedAtaId();
    return Boolean(ataId) && this.syncingAtaId() === ataId;
  }

  syncExternalBalance(item: AtaBalanceItem): void {
    this.syncItemExternalBalance(item);
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

  selectedAtaRateLimitMessage(): string {
    const ataId = this.selectedAtaId();
    return ataId ? this.externalRateLimitMessages()[this.ataRateLimitKey(ataId)] || '' : '';
  }

  itemRateLimitMessage(item: AtaBalanceItem): string {
    return this.externalRateLimitMessages()[this.itemRateLimitKey(item.id)] || '';
  }

  localComparisonLabel(item: AtaBalanceItem): string {
    const comparison = this.comparison(item);
    const value = comparison?.localBalance ?? comparison?.localAvailableQuantity ?? comparison?.availableQuantity;
    return this.quantityLabel(value == null ? this.availableQuantity(item) : this.numberValue(value), item.unit);
  }

  externalRegisteredQuantityLabel(item: AtaBalanceItem): string {
    const comparison = this.comparison(item);
    const value = this.getManagedRegisteredQuantity(comparison);
    return value == null ? this.externalQuantityFieldLabel(item, 'registeredQuantity') : this.quantityLabel(value, item.unit);
  }

  externalCommittedQuantityLabel(item: AtaBalanceItem): string {
    const comparison = this.comparison(item);
    const value = this.getTotalExternalCommittedQuantity(comparison);
    return value == null ? this.externalQuantityFieldLabel(item, 'committedQuantity') : this.quantityLabel(value, item.unit);
  }

  externalQuantityLabel(item: AtaBalanceItem): string {
    const comparison = this.comparison(item);
    const informativeValue = this.getInformativeExternalAvailableQuantity(comparison);
    const value = informativeValue ?? this.externalAvailableQuantityValue(item);

    return value == null ? this.externalMissingLabel(item) : this.quantityLabel(this.numberValue(value), item.unit);
  }

  externalDifferenceLabel(item: AtaBalanceItem): string {
    const comparison = this.comparison(item);
    const informativeValue = this.getExternalDifferenceQuantity(comparison);
    const value = informativeValue ?? comparison?.difference ?? comparison?.balanceDifference;

    if (value == null) {
      return this.externalMissingLabel(item);
    }

    return this.quantityLabel(this.numberValue(value), item.unit);
  }

  externalAvailableLabel(item: AtaBalanceItem): string {
    return this.usesTotalExternalView(this.comparison(item)) ? 'Saldo externo informativo' : 'Saldo externo';
  }

  syncStatus(item: AtaBalanceItem): string {
    const comparison = this.comparison(item);

    if (!comparison && this.itemRateLimitMessage(item)) {
      return 'RATE_LIMIT_COMPRAS_GOV';
    }

    return this.explicitSyncStatus(item) || this.legacySyncStatus(item) || 'NAO_SINCRONIZADO';
  }

  syncStatusLabel(status: string): string {
    const normalized = status.toUpperCase();
    return {
      SINCRONIZADO: 'Sincronizado',
      OK: 'Sincronizado',
      NAO_SINCRONIZADO: 'Não sincronizado',
      NOT_SYNCED: 'Não sincronizado',
      ERRO_CONSULTA_EXTERNA: 'Erro na consulta externa',
      RATE_LIMIT_COMPRAS_GOV: 'Limite da API',
      NOT_FOUND: 'Não sincronizado',
      NAO_ENCONTRADO: 'Não sincronizado',
    }[normalized] ?? formatLabel(status);
  }

  syncStatusClass(status: string): string {
    const normalized = status.toUpperCase();

    if (normalized === 'SINCRONIZADO' || normalized === 'OK') return 'b-ok';
    if (normalized === 'NAO_SINCRONIZADO' || normalized === 'NOT_SYNCED') return 'b-info';
    if (normalized === 'RATE_LIMIT_COMPRAS_GOV') return 'b-warn';
    if (normalized === 'ERRO_CONSULTA_EXTERNA') return 'b-danger';
    if (normalized === 'NOT_FOUND' || normalized === 'NAO_ENCONTRADO') return 'b-info';
    return 'b-info';
  }

  externalUsageStatusLabel(status: string): string {
    const normalized = status.toUpperCase();
    return {
      SEM_USO_EXTERNO: 'OK',
      OK: 'OK',
      ADESAO_DETECTADA: 'Adesão detectada',
      CONSUMO_GERENCIADORA_DETECTADO: 'Consumo da gerenciadora',
      CONSUMO_GERENCIADORA_E_ADESAO_DETECTADOS: 'Consumo gerenciadora + adesão',
      CONSUMO_EXTERNO_DETECTADO: 'Consumo externo detectado',
      EXTERNAL_CONSUMPTION_DETECTED: 'Consumo externo detectado',
    }[normalized] ?? 'OK';
  }

  externalUsageStatusClass(status: string): string {
    const normalized = status.toUpperCase();

    if (!normalized || normalized === 'SEM_USO_EXTERNO' || normalized === 'OK') return 'b-ok';
    if (
      normalized === 'ADESAO_DETECTADA' ||
      normalized === 'CONSUMO_GERENCIADORA_DETECTADO' ||
      normalized === 'CONSUMO_GERENCIADORA_E_ADESAO_DETECTADOS' ||
      normalized === 'CONSUMO_EXTERNO_DETECTADO' ||
      normalized === 'EXTERNAL_CONSUMPTION_DETECTED'
    ) return 'b-warn';
    return 'b-ok';
  }

  externalLastSyncedLabel(item: AtaBalanceItem): string {
    return formatDate(this.externalLastSyncValue(item));
  }

  isNoCommitmentStatus(item: AtaBalanceItem): boolean {
    const status = this.legacySyncStatus(item).toUpperCase();
    return status === 'SEM_EMPENHO_REGISTRADO' && !this.itemRateLimitMessage(item);
  }

  externalUsageAlert(item: AtaBalanceItem): string {
    const status = this.externalUsageStatus(item).toUpperCase();

    return {
      ADESAO_DETECTADA: 'Adesão detectada por órgão não participante.',
      CONSUMO_GERENCIADORA_DETECTADO: 'Consumo da gerenciadora detectado.',
      CONSUMO_GERENCIADORA_E_ADESAO_DETECTADOS: 'Consumo da gerenciadora e adesão externa detectados.',
    }[status] ?? '';
  }

  hasExternalDifferenceAlert(item: AtaBalanceItem): boolean {
    const comparison = this.comparison(item);
    const informativeValue = this.getExternalDifferenceQuantity(comparison);

    if (informativeValue != null) {
      return informativeValue > 0;
    }

    const legacyValue = comparison?.difference ?? comparison?.balanceDifference;
    return this.numberValue(legacyValue) > 0;
  }

  isAtaSyncCoolingDown(ataId: string): boolean {
    this.cooldownTick();
    return this.cooldownSeconds(this.ataRateLimitKey(ataId)) > 0;
  }

  isItemSyncCoolingDown(itemId: string): boolean {
    this.cooldownTick();
    return this.cooldownSeconds(this.itemRateLimitKey(itemId)) > 0;
  }

  managedExternalCommitments(item: AtaBalanceItem): AtaExternalBalanceCommitment[] {
    const externalBalance = this.externalBalanceObject(item);

    const managedCommitments = externalBalance?.managedBalance?.commitments;

    if (managedCommitments?.length) {
      return managedCommitments;
    }

    return (externalBalance?.commitments ?? []).filter((commitment) => commitment.affectsManagedBalance !== false);
  }

  nonParticipantExternalCommitments(item: AtaBalanceItem): AtaExternalBalanceCommitment[] {
    const externalBalance = this.externalBalanceObject(item);

    const adhesionCommitments = [
      ...(externalBalance?.adhesionBalance?.commitments ?? []),
      ...(externalBalance?.adhesionBalance?.adhesions ?? []),
    ];

    if (adhesionCommitments.length) {
      return adhesionCommitments;
    }

    return [
      ...(externalBalance?.nonParticipantCommitments ?? []),
      ...(externalBalance?.adhesions ?? []),
      ...(externalBalance?.commitments ?? []).filter((commitment) => commitment.affectsManagedBalance === false),
    ];
  }

  commitmentTrack(commitment: AtaExternalBalanceCommitment, index: number): string | number {
    return commitment.numeroEmpenho ?? commitment.commitmentNumber ?? commitment.number ?? commitment.empenhoNumber ?? index;
  }

  commitmentNumberLabel(commitment: AtaExternalBalanceCommitment): string {
    const value = commitment.numeroEmpenho ?? commitment.commitmentNumber ?? commitment.number ?? commitment.empenhoNumber;
    return value == null || value === '' ? 'NE não informada pela API' : String(value);
  }

  commitmentUnitLabel(commitment: AtaExternalBalanceCommitment): string {
    return this.textValue(commitment.unit ?? commitment.unitName ?? commitment.unidade);
  }

  commitmentSupplierLabel(commitment: AtaExternalBalanceCommitment): string {
    return this.textValue(
      commitment.supplier ?? commitment.supplierName ?? commitment.vendor ?? commitment.vendorName,
      'Fornecedor não informado',
    );
  }

  commitmentDateLabel(commitment: AtaExternalBalanceCommitment): string {
    const value = commitment.commitmentDate ?? commitment.date ?? commitment.empenhoDate;
    return value ? formatDate(value) : 'Não informado';
  }

  commitmentIncludedQuantityLabel(commitment: AtaExternalBalanceCommitment, unit?: string | null): string {
    return this.optionalQuantityLabel(commitment.includedQuantity ?? commitment.quantityIncluded, unit);
  }

  commitmentCommittedQuantityLabel(commitment: AtaExternalBalanceCommitment, unit?: string | null): string {
    return this.optionalQuantityLabel(commitment.committedQuantity ?? commitment.quantityCommitted, unit);
  }

  commitmentQuantityLabel(commitment: AtaExternalBalanceCommitment, unit?: string | null): string {
    return this.optionalQuantityLabel(
      commitment.committedQuantity ??
      commitment.quantityCommitted ??
      commitment.includedQuantity ??
      commitment.quantityIncluded,
      unit,
    );
  }

  commitmentValueLabel(commitment: AtaExternalBalanceCommitment): string {
    const value = commitment.value ?? commitment.amount ?? commitment.totalValue;
    return value == null ? 'Não informado' : formatCurrency(value);
  }

  externalEstimatedAmountLabel(item: AtaBalanceItem): string {
    const value = this.externalBalanceObject(item)?.estimatedAmount;
    return value == null ? 'Não informado' : formatCurrency(value);
  }

  hasManagedBalanceDetails(item: AtaBalanceItem): boolean {
    const managedBalance = this.managedBalance(item);

    return Boolean(
      managedBalance &&
      (
        this.hasTextValue(managedBalance.unit ?? managedBalance.unitName ?? managedBalance.unidade) ||
        this.hasNumericValue(managedBalance.registeredQuantity ?? managedBalance.contractedQuantity) ||
        this.hasNumericValue(managedBalance.committedQuantity ?? managedBalance.pledgedQuantity) ||
        this.hasNumericValue(managedBalance.availableQuantity ?? managedBalance.balanceQuantity) ||
        this.managedExternalCommitments(item).length
      ),
    );
  }

  managedBalanceUnitLabel(item: AtaBalanceItem): string {
    const managedBalance = this.managedBalance(item);
    return this.textValue(managedBalance?.unit ?? managedBalance?.unitName ?? managedBalance?.unidade, 'Não informado');
  }

  managedBalanceRegisteredQuantityLabel(item: AtaBalanceItem): string {
    const managedBalance = this.managedBalance(item);
    return this.optionalQuantityLabel(
      managedBalance?.registeredQuantity ?? managedBalance?.contractedQuantity,
      item.unit,
    );
  }

  managedBalanceCommittedQuantityLabel(item: AtaBalanceItem): string {
    const managedBalance = this.managedBalance(item);
    return this.optionalQuantityLabel(
      managedBalance?.committedQuantity ?? managedBalance?.pledgedQuantity,
      item.unit,
    );
  }

  managedBalanceAvailableQuantityLabel(item: AtaBalanceItem): string {
    const managedBalance = this.managedBalance(item);
    return this.optionalQuantityLabel(
      managedBalance?.availableQuantity ?? managedBalance?.balanceQuantity,
      item.unit,
    );
  }

  hasAdhesionBalanceDetails(item: AtaBalanceItem): boolean {
    const adhesionBalance = this.adhesionBalance(item);

    return Boolean(
      adhesionBalance &&
      (
        this.hasNumericValue(adhesionBalance.limitQuantity ?? adhesionBalance.registeredQuantity ?? adhesionBalance.contractedQuantity) ||
        this.hasNumericValue(adhesionBalance.approvedQuantity ?? adhesionBalance.adhesionApprovedQuantity) ||
        this.hasNumericValue(adhesionBalance.committedQuantity ?? adhesionBalance.pledgedQuantity) ||
        this.hasNumericValue(adhesionBalance.availableQuantity ?? adhesionBalance.balanceQuantity) ||
        this.adhesionOrganizations(item).length ||
        this.nonParticipantExternalCommitments(item).length
      ),
    );
  }

  adhesionLimitQuantityLabel(item: AtaBalanceItem): string {
    const adhesionBalance = this.adhesionBalance(item);
    return this.optionalQuantityLabel(
      adhesionBalance?.limitQuantity ?? adhesionBalance?.registeredQuantity ?? adhesionBalance?.contractedQuantity,
      item.unit,
    );
  }

  adhesionApprovedQuantityLabel(item: AtaBalanceItem): string {
    const adhesionBalance = this.adhesionBalance(item);
    return this.optionalQuantityLabel(
      adhesionBalance?.approvedQuantity ?? adhesionBalance?.adhesionApprovedQuantity,
      item.unit,
    );
  }

  adhesionCommittedQuantityLabel(item: AtaBalanceItem): string {
    const adhesionBalance = this.adhesionBalance(item);
    return this.optionalQuantityLabel(
      adhesionBalance?.committedQuantity ?? adhesionBalance?.pledgedQuantity,
      item.unit,
    );
  }

  adhesionAvailableQuantityLabel(item: AtaBalanceItem): string {
    const adhesionBalance = this.adhesionBalance(item);
    return this.optionalQuantityLabel(
      adhesionBalance?.availableQuantity ?? adhesionBalance?.balanceQuantity,
      item.unit,
    );
  }

  adhesionOrganizationsCountLabel(item: AtaBalanceItem): string {
    const organizations = this.adhesionOrganizations(item);
    return organizations.length ? String(organizations.length) : 'Não informado';
  }

  adhesionOrganizationsLabel(item: AtaBalanceItem): string {
    const organizations = this.adhesionOrganizations(item);
    return organizations.length ? organizations.join(', ') : 'Não informado';
  }

  getManagedRegisteredQuantity(comparison: AtaExternalBalanceComparison | null): number | null {
    const externalBalance = this.externalBalanceFromComparison(comparison);

    if (!externalBalance?.managedBalance) {
      return null;
    }

    const value = externalBalance.managedBalance.registeredQuantity ?? externalBalance.managedBalance.contractedQuantity;
    return value == null ? 0 : this.numberValue(value);
  }

  getManagedCommittedQuantity(comparison: AtaExternalBalanceComparison | null): number | null {
    const externalBalance = this.externalBalanceFromComparison(comparison);

    if (!externalBalance?.managedBalance) {
      return null;
    }

    const value = externalBalance.managedBalance.committedQuantity ?? externalBalance.managedBalance.pledgedQuantity;
    return value == null ? 0 : this.numberValue(value);
  }

  getAdhesionCommittedQuantity(comparison: AtaExternalBalanceComparison | null): number | null {
    const externalBalance = this.externalBalanceFromComparison(comparison);

    if (!externalBalance?.adhesionBalance) {
      return null;
    }

    const value = externalBalance.adhesionBalance.committedQuantity ?? externalBalance.adhesionBalance.pledgedQuantity;
    return value == null ? 0 : this.numberValue(value);
  }

  getTotalExternalCommittedQuantity(comparison: AtaExternalBalanceComparison | null): number | null {
    const managedRegistered = this.getManagedRegisteredQuantity(comparison);

    if (managedRegistered == null) {
      return null;
    }

    return (this.getManagedCommittedQuantity(comparison) ?? 0) + (this.getAdhesionCommittedQuantity(comparison) ?? 0);
  }

  getInformativeExternalAvailableQuantity(comparison: AtaExternalBalanceComparison | null): number | null {
    const managedRegistered = this.getManagedRegisteredQuantity(comparison);
    const totalCommitted = this.getTotalExternalCommittedQuantity(comparison);

    if (managedRegistered == null || totalCommitted == null) {
      return null;
    }

    return managedRegistered - totalCommitted;
  }

  getExternalDifferenceQuantity(comparison: AtaExternalBalanceComparison | null): number | null {
    const totalCommitted = this.getTotalExternalCommittedQuantity(comparison);
    return totalCommitted == null ? null : totalCommitted;
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
    const externalBalance = this.externalBalanceObject(item);

    if (!externalBalance) {
      return undefined;
    }

    if (field === 'registeredQuantity') {
      return externalBalance.managedBalance?.registeredQuantity ??
        externalBalance.managedBalance?.contractedQuantity ??
        externalBalance[field];
    }

    if (field === 'committedQuantity') {
      return externalBalance.managedBalance?.committedQuantity ??
        externalBalance.managedBalance?.pledgedQuantity ??
        externalBalance[field];
    }

    return externalBalance.managedBalance?.availableQuantity ??
      externalBalance.managedBalance?.balanceQuantity ??
      externalBalance[field];
  }

  private externalAvailableQuantityValue(item: AtaBalanceItem): string | number | null | undefined {
    return this.externalBalanceValue(item, 'availableQuantity');
  }

  private externalMissingLabel(item: AtaBalanceItem): string {
    const normalized = this.syncStatus(item).toUpperCase();
    return normalized === 'NOT_FOUND' || normalized === 'NAO_ENCONTRADO' ? 'Não encontrado' : 'Não sincronizado';
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

  optionalQuantityLabel(value: string | number | null | undefined, unit?: string | null): string {
    return value == null ? 'Não informado' : this.quantityLabel(this.numberValue(value), unit);
  }

  textValue(value: string | number | null | undefined, fallback = 'Não informado'): string {
    return value == null || value === '' ? fallback : String(value);
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

  private externalBalanceObject(item: AtaBalanceItem): AtaExternalBalancePayload | null {
    const externalBalance = this.comparison(item)?.externalBalance;
    return externalBalance && typeof externalBalance === 'object' ? externalBalance as AtaExternalBalancePayload : null;
  }

  private externalBalanceFromComparison(comparison: AtaExternalBalanceComparison | null): AtaExternalBalancePayload | null {
    const externalBalance = comparison?.externalBalance;
    return externalBalance && typeof externalBalance === 'object' ? externalBalance as AtaExternalBalancePayload : null;
  }

  private managedBalance(item: AtaBalanceItem): AtaExternalManagedBalance | null {
    return this.externalBalanceObject(item)?.managedBalance ?? null;
  }

  private adhesionBalance(item: AtaBalanceItem): AtaExternalAdhesionBalance | null {
    return this.externalBalanceObject(item)?.adhesionBalance ?? null;
  }

  private adhesionOrganizations(item: AtaBalanceItem): string[] {
    const adhesionBalance = this.adhesionBalance(item);
    const source = adhesionBalance?.adheringOrganizations ?? adhesionBalance?.organizations ?? adhesionBalance?.units ?? [];

    return source
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }

        return String(
          entry?.name ??
          entry?.organizationName ??
          entry?.organization ??
          entry?.unitName ??
          entry?.unit ??
          entry?.unidade ??
          entry?.agency ??
          '',
        ).trim();
      })
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index);
  }

  externalUsageStatus(item: AtaBalanceItem): string {
    const explicitStatus = this.externalBalanceObject(item)?.externalUsageStatus;
    if (explicitStatus) {
      return explicitStatus;
    }

    const legacyStatus = String(this.comparison(item)?.status || '').toUpperCase();

    if (
      legacyStatus === 'ADESAO_DETECTADA' ||
      legacyStatus === 'CONSUMO_GERENCIADORA_DETECTADO' ||
      legacyStatus === 'CONSUMO_GERENCIADORA_E_ADESAO_DETECTADOS' ||
      legacyStatus === 'CONSUMO_EXTERNO_DETECTADO' ||
      legacyStatus === 'EXTERNAL_CONSUMPTION_DETECTED'
    ) {
      return legacyStatus;
    }

    return 'SEM_USO_EXTERNO';
  }

  private explicitSyncStatus(item: AtaBalanceItem): string {
    return this.comparison(item)?.syncStatus || this.externalBalanceObject(item)?.syncStatus || '';
  }

  private legacySyncStatus(item: AtaBalanceItem): string {
    const rawStatus = String(this.comparison(item)?.status || '').toUpperCase();

    if (!rawStatus) {
      return '';
    }

    if (
      rawStatus === 'ADESAO_DETECTADA' ||
      rawStatus === 'CONSUMO_GERENCIADORA_DETECTADO' ||
      rawStatus === 'CONSUMO_GERENCIADORA_E_ADESAO_DETECTADOS' ||
      rawStatus === 'CONSUMO_EXTERNO_DETECTADO' ||
      rawStatus === 'EXTERNAL_CONSUMPTION_DETECTED'
    ) {
      return 'SINCRONIZADO';
    }

    if (rawStatus === 'SEM_EMPENHO_REGISTRADO' || rawStatus === 'OK') {
      return 'SINCRONIZADO';
    }

    if (rawStatus === 'NOT_FOUND' || rawStatus === 'NAO_ENCONTRADO' || rawStatus === 'NOT_SYNCED') {
      return 'NAO_SINCRONIZADO';
    }

    return rawStatus;
  }

  private hasTextValue(value: string | null | undefined): boolean {
    return Boolean(value && value.trim());
  }

  private hasNumericValue(value: string | number | null | undefined): boolean {
    return value != null && value !== '';
  }

  private usesTotalExternalView(comparison: AtaExternalBalanceComparison | null): boolean {
    return this.getManagedRegisteredQuantity(comparison) != null;
  }

  private listItems<T>(response: { items: T[] } | T[]): T[] {
    return Array.isArray(response) ? response : response.items ?? [];
  }

  private syncAtaExternalBalance(ataId: string): void {
    if (!ataId || this.syncingAtaId()) {
      return;
    }
    if (this.isAtaSyncCoolingDown(ataId)) {
      return;
    }

    this.syncingAtaId.set(ataId);
    this.syncError.set('');
    this.successMessage.set('');
    this.ataBalanceService
      .syncAtaExternalBalance(ataId)
      .pipe(finalize(() => this.syncingAtaId.set('')))
      .subscribe({
        next: (response) => {
          if (this.handleAtaRateLimitResponse(ataId, response)) {
            return;
          }

          const warnings = this.responseWarnings(response);
          const syncedComparisons = this.externalComparisonItems(response);

          this.applyAtaExternalComparisons(ataId, syncedComparisons, response);
          this.successMessage.set(this.syncSuccessMessage(warnings));
        },
        error: (error) => {
          if (this.handleAtaRateLimitResponse(ataId, error?.error)) {
            return;
          }

          const message = getErrorMessage(error, 'Nao foi possivel sincronizar o saldo externo desta ATA.');
          this.syncError.set(message);
        },
      });
  }

  private syncItemExternalBalance(item: AtaBalanceItem): void {
    if (!item.id || this.syncingItemId()) {
      return;
    }
    if (this.isItemSyncCoolingDown(item.id)) {
      return;
    }

    this.syncingItemId.set(item.id);
    this.syncError.set('');
    this.successMessage.set('');
    this.externalComparisonErrors.update((errors) => {
      const nextErrors = { ...errors };
      delete nextErrors[item.id];
      return nextErrors;
    });

    this.ataBalanceService
      .syncItemExternalBalance(item.id)
      .pipe(finalize(() => this.syncingItemId.set('')))
      .subscribe({
        next: (comparison) => {
          if (this.handleItemRateLimitResponse(item.id, comparison)) {
            return;
          }

          this.applyItemExternalComparison(item.id, comparison);
          this.successMessage.set('Saldo externo do item sincronizado com sucesso.');
        },
        error: (error) => {
          if (this.handleItemRateLimitResponse(item.id, error?.error)) {
            return;
          }

          const message = getErrorMessage(error, 'Nao foi possivel sincronizar o saldo externo deste item.');
          this.syncError.set(message);
          this.externalComparisonErrors.update((errors) => ({
            ...errors,
            [item.id]: message,
          }));
        },
      });
  }

  private loadItemBalanceComparison(item: AtaBalanceItem): void {
    this.externalLoading.set(true);
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
          if (this.handleItemRateLimitResponse(item.id, comparison)) {
            return;
          }

          this.externalComparisons.update((comparisons) => ({
            ...comparisons,
            [item.id]: comparison,
          }));
        },
        error: (error) => {
          if (this.handleItemRateLimitResponse(item.id, error?.error)) {
            return;
          }

          this.externalComparisonErrors.update((errors) => ({
            ...errors,
            [item.id]: getErrorMessage(error, 'Nao foi possivel carregar a comparacao externa deste item.'),
          }));
        },
      });
  }

  private handleAtaRateLimitResponse(
    ataId: string,
    response: AtaExternalBalanceListResponse | AtaExternalBalanceComparison[] | null | undefined,
  ): boolean {
    if (!response || Array.isArray(response) || !this.isRateLimitResponse(response)) {
      return false;
    }

    const retryAfterSeconds = this.retryAfterSeconds(response);
    this.setRateLimit(this.ataRateLimitKey(ataId), retryAfterSeconds);
    this.items()
      .filter((item) => this.ataId(item) === ataId)
      .forEach((item) => this.setRateLimit(this.itemRateLimitKey(item.id), retryAfterSeconds));
    return true;
  }

  private handleItemRateLimitResponse(itemId: string, response: AtaExternalBalanceComparison | null | undefined): boolean {
    if (!response || !this.isRateLimitResponse(response)) {
      return false;
    }

    this.setRateLimit(this.itemRateLimitKey(itemId), this.retryAfterSeconds(response));
    return true;
  }

  private isRateLimitResponse(response: AtaExternalBalanceListResponse | AtaExternalBalanceComparison): boolean {
    return String(response.status || '').toUpperCase() === 'RATE_LIMIT_COMPRAS_GOV';
  }

  private retryAfterSeconds(response: AtaExternalBalanceListResponse | AtaExternalBalanceComparison): number {
    const seconds = Number(response.retryAfterSeconds);
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
  }

  private setRateLimit(key: string, retryAfterSeconds: number): void {
    const message = this.rateLimitMessage(retryAfterSeconds);
    this.externalRateLimitMessages.update((messages) => ({
      ...messages,
      [key]: message,
    }));

    if (retryAfterSeconds > 0) {
      const until = Date.now() + retryAfterSeconds * 1000;
      this.syncCooldownUntil.update((cooldowns) => ({
        ...cooldowns,
        [key]: until,
      }));
      setTimeout(() => this.cooldownTick.update((value) => value + 1), retryAfterSeconds * 1000);
    }
  }

  private clearRateLimit(key: string): void {
    this.externalRateLimitMessages.update((messages) => {
      const nextMessages = { ...messages };
      delete nextMessages[key];
      return nextMessages;
    });
    this.syncCooldownUntil.update((cooldowns) => {
      const nextCooldowns = { ...cooldowns };
      delete nextCooldowns[key];
      return nextCooldowns;
    });
  }

  private rateLimitMessage(retryAfterSeconds: number): string {
    const seconds = retryAfterSeconds || 0;
    return `Limite de consultas do Compras.gov.br atingido. Tente novamente em ${seconds} segundos.`;
  }

  private cooldownSeconds(key: string): number {
    const until = this.syncCooldownUntil()[key] ?? 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }

  private ataRateLimitKey(ataId: string): string {
    return `ata:${ataId}`;
  }

  private itemRateLimitKey(itemId: string): string {
    return `item:${itemId}`;
  }

  private applyItemExternalComparison(itemId: string, comparison: AtaExternalBalanceComparison): void {
    this.clearRateLimit(this.itemRateLimitKey(itemId));
    this.externalComparisons.update((comparisons) => ({
      ...comparisons,
      [itemId]: comparison,
    }));
    this.externalComparisonErrors.update((errors) => {
      const nextErrors = { ...errors };
      delete nextErrors[itemId];
      return nextErrors;
    });

    const selected = this.selectedItem();
    if (selected?.id === itemId) {
      this.selectedItem.set(this.items().find((item) => item.id === itemId) ?? selected);
    }
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
      this.clearRateLimit(this.ataRateLimitKey(ataId));
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
        this.clearRateLimit(this.itemRateLimitKey(item.id));
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
